import { supabase } from "./supabaseClient";
import { ramahkanGalat } from "./jaringan";
import { PEKAN_TARGET_QURAN, type RpbQuranRow } from "./rpbSheet";

// Rincian rencana Al-Qur'an PER PEKAN per santri (mulai Desember), disimpan di tabel `rpb_quran_pekan`:
//   ziyadah (= Talaqqi di Kuttab Awwal) / murojaah / wirid (Qonuni) atau baghdadiyah (Kuttab Awwal)
//   isi    = teks rencana pekan itu (tidak dinilai)
//   target = angka (dipakai wirid: target putaran per pekan; kategori lain tidak dipakai)
// Target ANGKA ziyadah per pekan tetap di sheet RPB (kolom H..L), lihat RpbQuranRow.targetPekan.

export type KategoriPekan = "ziyadah" | "murojaah" | "wirid" | "baghdadiyah";
export type RincianPekan = { isi: string[]; target: string[] };
export type RincianSantri = Partial<Record<KategoriPekan, RincianPekan>>;

/** Kategori untuk tiga isian rencana per santri (urut sesuai label): Qonuni Ziyadah/Murojaah/Wirid, KA Talaqqi/Murojaah Jama'i/Baghdadiyah. */
export const kategoriRencana = (qonuni: boolean): KategoriPekan[] => ["ziyadah", "murojaah", qonuni ? "wirid" : "baghdadiyah"];

const kosongPekan = (): RincianPekan => ({ isi: Array(PEKAN_TARGET_QURAN).fill(""), target: Array(PEKAN_TARGET_QURAN).fill("") });
export const rincianKosong = (kats: KategoriPekan[]): RincianSantri => Object.fromEntries(kats.map((k) => [k, kosongPekan()]));

const normNama = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

type Baris = { kelas: string; santri: string; kategori: KategoriPekan; pekan: number; isi: string; target: number | null };

function susun(rows: Baris[]): Map<string, RincianSantri> {
  const out = new Map<string, RincianSantri>();
  for (const r of rows) {
    const k = normNama(r.santri);
    const s = out.get(k) ?? {};
    const rp = s[r.kategori] ?? kosongPekan();
    rp.isi[r.pekan - 1] = r.isi ?? "";
    rp.target[r.pekan - 1] = r.target != null ? String(r.target).replace(".", ",") : "";
    s[r.kategori] = rp;
    out.set(k, s);
  }
  return out;
}

/** Rincian satu kelas untuk satu bulan: nama santri (dinormalkan) -> rincian. */
export async function bacaRincianKelas(kelas: string, bulan: string): Promise<Map<string, RincianSantri>> {
  const { data, error } = await supabase.from("rpb_quran_pekan").select("kelas, santri, kategori, pekan, isi, target").eq("kelas", kelas).eq("bulan", bulan);
  if (error) throw new Error(ramahkanGalat(error.message));
  return susun((data ?? []) as Baris[]);
}

/** Rincian semua kelas untuk satu bulan (laporan): kelas -> santri -> rincian. */
export async function bacaRincianBulan(bulan: string): Promise<Map<string, Map<string, RincianSantri>>> {
  const { data, error } = await supabase.from("rpb_quran_pekan").select("kelas, santri, kategori, pekan, isi, target").eq("bulan", bulan);
  if (error) throw new Error(ramahkanGalat(error.message));
  const per = new Map<string, Baris[]>();
  for (const r of (data ?? []) as Baris[]) per.set(r.kelas, [...(per.get(r.kelas) ?? []), r]);
  return new Map([...per].map(([k, rows]) => [k, susun(rows)]));
}

/** Gabungkan rincian dari database ke baris santri hasil baca sheet. */
export function gabungRincian(quran: RpbQuranRow[], peta: Map<string, RincianSantri>): RpbQuranRow[] {
  return quran.map((q) => ({ ...q, rincian: peta.get(normNama(q.nama)) ?? q.rincian }));
}

const angka = (v: string): number | null => {
  const m = (v ?? "").replace(",", ".").match(/\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};

/** Simpan rincian pekan semua santri di kelas+bulan itu. Isian yang dikosongkan dihapus. Dibaca balik; kalau tidak sama, dilempar galat. */
export async function simpanRincianKelas(kelas: string, bulan: string, quran: RpbQuranRow[]): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesi login habis, coba masuk lagi.");

  const baru: (Baris & { bulan: string; user_id: string })[] = [];
  for (const q of quran) {
    for (const [kat, rp] of Object.entries(q.rincian ?? {}) as [KategoriPekan, RincianPekan][]) {
      for (let p = 0; p < PEKAN_TARGET_QURAN; p++) {
        const isi = (rp.isi[p] ?? "").trim();
        const t = angka(rp.target[p] ?? "");
        if (isi || t != null) baru.push({ kelas, bulan, santri: q.nama, kategori: kat, pekan: p + 1, isi, target: t, user_id: user.id });
      }
    }
  }
  const kunci = (r: { santri: string; kategori: string; pekan: number }) => `${r.santri}|${r.kategori}|${r.pekan}`;
  const adaBaru = new Set(baru.map(kunci));

  const { data: lama, error: eLama } = await supabase.from("rpb_quran_pekan").select("id, santri, kategori, pekan").eq("kelas", kelas).eq("bulan", bulan);
  if (eLama) throw new Error(ramahkanGalat(eLama.message));

  if (baru.length) {
    const { error } = await supabase.from("rpb_quran_pekan").upsert(baru, { onConflict: "kelas,bulan,santri,kategori,pekan" });
    if (error) throw new Error(ramahkanGalat(error.message));
  }
  const hapus = (lama ?? []).filter((r) => !adaBaru.has(kunci(r as never))).map((r) => r.id as string);
  if (hapus.length) {
    const { error } = await supabase.from("rpb_quran_pekan").delete().in("id", hapus);
    if (error) throw new Error(ramahkanGalat(error.message));
  }

  const { data: cek, error: eCek } = await supabase.from("rpb_quran_pekan").select("santri, kategori, pekan, isi, target").eq("kelas", kelas).eq("bulan", bulan);
  if (eCek) throw new Error(ramahkanGalat(eCek.message));
  const peta = new Map((cek ?? []).map((r) => [kunci(r as never), r]));
  const beda = baru.filter((b) => {
    const r = peta.get(kunci(b));
    return !r || (r.isi ?? "") !== b.isi || (r.target != null ? Number(r.target) : null) !== b.target;
  }).length;
  if (peta.size !== baru.length || beda > 0) throw new Error("Rincian per pekan belum tercatat di server. Ketikanmu masih aman di perangkat; tekan Simpan sekali lagi.");
}
