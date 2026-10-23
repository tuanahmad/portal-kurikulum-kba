import { ramahkanGalat } from "./jaringan";
import { supabase } from "./supabaseClient";

export type JurnalEntry = {
  tanggal: string; // "YYYY-MM-DD"
  kondisi_guru: string;
  kondisi_santri: string;
  kabar_kendala: string;
  updated_at?: string;
};

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export const NAMA_BULAN = BULAN;

/** Tiga pertanyaan jurnal harian (dipakai form guru, tampilan management, dan PDF). */
export const PERTANYAAN_JURNAL: { key: "kondisi_guru" | "kondisi_santri" | "kabar_kendala"; label: string }[] = [
  { key: "kondisi_guru", label: "Bagaimana kondisi/kabarmu hari ini, wahai guru?" },
  { key: "kondisi_santri", label: "Bagaimana kondisi santri-santrimu pada hari ini, wahai guru?" },
  { key: "kabar_kendala", label: "Momen (baik/buruk) apa yang terjadi pada hari ini, dan bagaimana caramu menyikapinya?" },
];

/** Bulan paling awal yang bisa diunduh PDF-nya (awal tahun ajaran / awal pemakaian aplikasi). */
export const MULAI_JURNAL = { year: 2026, month0: 6 }; // Juli 2026

function pad(n: number) {
  return String(n).padStart(2, "0");
}
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Senin dari pekan yang memuat `d` (Sen=1 … Min=0 -> mundur ke Senin). */
export function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = x.getDay(); // 0=Min
  const diff = dow === 0 ? -6 : 1 - dow;
  x.setDate(x.getDate() + diff);
  return x;
}
/** [Senin..Jumat] dari pekan yang dimulai `monday`. */
export function weekdaysFrom(monday: Date): Date[] {
  return Array.from({ length: 5 }, (_, i) => {
    const x = new Date(monday);
    x.setDate(monday.getDate() + i);
    return x;
  });
}
export function labelHari(d: Date): string {
  return HARI[d.getDay()];
}
export function labelTanggal(d: Date): string {
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}
/** "7 – 11 September 2026" / "28 Sep – 2 Okt 2026". */
export function labelRentangPekan(days: Date[]): string {
  const a = days[0];
  const b = days[days.length - 1];
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (sameMonth) return `${a.getDate()} – ${b.getDate()} ${BULAN[a.getMonth()]} ${a.getFullYear()}`;
  const sameYear = a.getFullYear() === b.getFullYear();
  return `${a.getDate()} ${BULAN[a.getMonth()].slice(0, 3)} – ${b.getDate()} ${BULAN[b.getMonth()].slice(0, 3)} ${b.getFullYear()}${sameYear ? "" : ""}`;
}

const EMPTY = (tanggal: string): JurnalEntry => ({
  tanggal,
  kondisi_guru: "",
  kondisi_santri: "",
  kabar_kendala: "",
});

/** Baca jurnal dalam rentang tanggal. `by` = { userId } (guru: dirinya sendiri) atau { kelas }
 *  (manajemen: kelas tertentu). Balikin map tanggal -> entry (yang kosong tetap ada). */
export async function readJurnalRange(
  fromYmd: string,
  toYmd: string,
  by: { userId?: string; kelas?: string }
): Promise<Record<string, JurnalEntry>> {
  let q = supabase
    .from("jurnal_harian")
    .select("tanggal, kondisi_guru, kondisi_santri, kabar_kendala, updated_at")
    .gte("tanggal", fromYmd)
    .lte("tanggal", toYmd);
  if (by.userId) q = q.eq("user_id", by.userId);
  else if (by.kelas) q = q.eq("kelas", by.kelas);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const out: Record<string, JurnalEntry> = {};
  for (const row of data ?? []) out[row.tanggal] = row as JurnalEntry;
  return out;
}

export type JurnalHariItem = { userId: string; nama: string; kelas: string; entry: JurnalEntry | undefined };

/** Jurnal semua guru pada satu tanggal (management). Urut menurut `urutKelas`; kelas yang tidak ada di daftar menyusul menurut abjad. */
export async function readJurnalHari(tanggal: Date, urutKelas: string[]): Promise<JurnalHariItem[]> {
  const [g, r] = await Promise.all([
    supabase.from("profiles").select("id, full_name, kelas").eq("role", "guru"),
    supabase
      .from("jurnal_harian")
      .select("user_id, tanggal, kondisi_guru, kondisi_santri, kabar_kendala, updated_at")
      .eq("tanggal", ymd(tanggal)),
  ]);
  if (g.error) throw new Error(g.error.message);
  if (r.error) throw new Error(r.error.message);
  const byUser: Record<string, JurnalEntry> = {};
  for (const row of r.data ?? []) byUser[row.user_id as string] = row as unknown as JurnalEntry;
  const idx = (k: string) => {
    const i = urutKelas.indexOf(k);
    return i < 0 ? 9999 : i;
  };
  return (g.data ?? [])
    .filter((p) => !!p.kelas)
    .map((p) => ({ userId: p.id as string, nama: ((p.full_name as string) || (p.kelas as string)) ?? "", kelas: p.kelas as string, entry: byUser[p.id as string] }))
    .sort((a, b) => idx(a.kelas) - idx(b.kelas) || a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama));
}

export async function saveJurnalDay(params: {
  kelas: string;
  tanggal: string;
  kondisi_guru: string;
  kondisi_santri: string;
  kabar_kendala: string;
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesi login habis, coba masuk lagi.");

  const { data, error } = await supabase
    .from("jurnal_harian")
    .upsert(
      {
        user_id: user.id,
        kelas: params.kelas,
        tanggal: params.tanggal,
        kondisi_guru: params.kondisi_guru,
        kondisi_santri: params.kondisi_santri,
        kabar_kendala: params.kabar_kendala,
      },
      { onConflict: "user_id,tanggal" }
    )
    .select("kondisi_guru, kondisi_santri, kabar_kendala")
    .maybeSingle();
  if (error) throw new Error(ramahkanGalat(error.message));
  // Cek ulang: baris harus benar-benar ada dan isinya sama dengan yang dikirim.
  if (!data || data.kondisi_guru !== params.kondisi_guru || data.kondisi_santri !== params.kondisi_santri || data.kabar_kendala !== params.kabar_kendala) {
    throw new Error("Jurnal belum tercatat di server. Ketikanmu masih aman di perangkat; tekan Simpan sekali lagi.");
  }
}

export function isEntryFilled(e: JurnalEntry | undefined): boolean {
  return !!e && !!(e.kondisi_guru.trim() || e.kondisi_santri.trim() || e.kabar_kendala.trim());
}

export const emptyEntry = EMPTY;
