import { supabase } from "./supabaseClient";
import { ramahkanGalat } from "./jaringan";
import type { RpbTabData } from "./rpbSheet";

// Tanda ketercapaian tiap target ilmu di RPB ("Sudah" / "Belum" + keterangan), diisi guru di form Capaian Ilmu.
// Disimpan di tabel ilmu_target_status (bukan di Google Sheet). Dipakai Sajian Data untuk menghitung ketercapaian
// target ilmu tanpa harus membaca kalimat capaian satu per satu.

export type TargetIlmu = { urutan: number; bidang: string; target: string };
export type StatusTarget = "sudah" | "belum";
export type TandaTarget = { status: StatusTarget; keterangan: string };
export type TandaTersimpan = TandaTarget & { urutan: number; bidang: string; target: string };

/** Bidang Al-Qur'an dinilai di bagian Al-Qur'an (dari Capaian Al-Qur'an), bukan di Ilmu. Baghdadiyah tetap Ilmu. */
export function bidangAlQuran(bidang: string): boolean {
  return /qur|quran|talaqq?i|ziyadah|muroja|wirid|tilawah|tahfi/i.test(bidang) && !/baghdad/i.test(bidang);
}

const rapi = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Kunci pencocokan tanda <-> target: bidang + teks target (bukan posisi baris), supaya tanda tidak pindah ke target
 *  lain kalau guru menyisipkan/menghapus baris di RPB. */
export const kunciTarget = (bidang: string, target: string) => `${rapi(bidang)}|${rapi(target)}`;

/** Daftar target ilmu dari Tabel B RPB: tiap baris yang punya isi target = 1 target. Nama bidang yang kosong ikut bidang
 *  di atasnya (pola Qonuni: beberapa baris detail di bawah 1 bidang). urutan = posisi baris di Tabel B. */
export function daftarTargetIlmu(rpb: RpbTabData | null | undefined): TargetIlmu[] {
  const out: TargetIlmu[] = [];
  let bidang = "";
  (rpb?.tableB ?? []).forEach((row, i) => {
    const b = (row[0] ?? "").trim();
    if (b) bidang = b;
    const isi = row.slice(1).map((x) => (x ?? "").trim()).filter(Boolean);
    if (!isi.length || !bidang || bidangAlQuran(bidang)) return;
    // 3 kolom terisi (pola Qonuni: sub-item | target | indikator) -> "sub-item: target"; selain itu kolom pertama = target.
    const target = isi.length >= 3 ? `${isi[0]}: ${isi[1]}` : isi[0];
    out.push({ urutan: i, bidang, target });
  });
  return out;
}

/** Tanda yang tersimpan untuk 1 kelas 1 bulan, dipetakan per kunciTarget. */
export async function bacaTandaTarget(kelas: string, bulan: string): Promise<Map<string, TandaTersimpan>> {
  const { data, error } = await supabase
    .from("ilmu_target_status")
    .select("urutan, bidang, target, status, keterangan")
    .eq("kelas", kelas)
    .eq("bulan", bulan);
  if (error) throw new Error(ramahkanGalat(error.message));
  return new Map((data ?? []).map((r) => [kunciTarget(r.bidang as string, r.target as string), r as TandaTersimpan]));
}

/** Semua tanda untuk 1 bulan (semua kelas) -- untuk Sajian Data (management). Peta kelas -> (kunciTarget -> tanda). */
export async function bacaTandaTargetBulan(bulan: string): Promise<Map<string, Map<string, TandaTersimpan>>> {
  const { data, error } = await supabase
    .from("ilmu_target_status")
    .select("kelas, urutan, bidang, target, status, keterangan")
    .eq("bulan", bulan);
  if (error) throw new Error(ramahkanGalat(error.message));
  const out = new Map<string, Map<string, TandaTersimpan>>();
  for (const r of data ?? []) {
    const k = r.kelas as string;
    if (!out.has(k)) out.set(k, new Map());
    out.get(k)!.set(kunciTarget(r.bidang as string, r.target as string), r as TandaTersimpan);
  }
  return out;
}

/** Simpan tanda semua target 1 kelas 1 bulan sekaligus. Target tanpa tanda -> catatannya dihapus. Sesudahnya dibaca
 *  balik; kalau tidak sama dengan yang dikirim, dilempar galat (jangan ada "Tersimpan" palsu). */
export async function simpanTandaTarget(kelas: string, bulan: string, daftar: (TargetIlmu & { tanda: TandaTarget | null })[]): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesi login habis, coba masuk lagi.");

  const isi = daftar.filter((d) => d.tanda);
  if (isi.length) {
    const { error } = await supabase.from("ilmu_target_status").upsert(
      isi.map((d) => ({
        user_id: user.id,
        kelas,
        bulan,
        urutan: d.urutan,
        bidang: d.bidang,
        target: d.target,
        status: d.tanda!.status,
        keterangan: d.tanda!.keterangan.trim(),
      })),
      { onConflict: "kelas,bulan,urutan" }
    );
    if (error) throw new Error(ramahkanGalat(error.message));
  }
  // Baris lain milik kelas+bulan ini (target tanpa tanda, atau posisi yang sudah tidak ada di RPB) dihapus.
  const simpanUrutan = isi.map((d) => d.urutan);
  let hapus = supabase.from("ilmu_target_status").delete().eq("kelas", kelas).eq("bulan", bulan);
  if (simpanUrutan.length) hapus = hapus.not("urutan", "in", `(${simpanUrutan.join(",")})`);
  const { error: errHapus } = await hapus;
  if (errHapus) throw new Error(ramahkanGalat(errHapus.message));

  const terbaca = await bacaTandaTarget(kelas, bulan);
  const salah = daftar.filter((d) => {
    const t = terbaca.get(kunciTarget(d.bidang, d.target));
    if (!d.tanda) return !!t;
    return !t || t.status !== d.tanda.status || (t.keterangan ?? "").trim() !== d.tanda.keterangan.trim();
  }).length;
  if (salah > 0) throw new Error(`${salah} tanda target belum tercatat di server. Pilihanmu masih aman di perangkat; tekan Simpan sekali lagi.`);
}
