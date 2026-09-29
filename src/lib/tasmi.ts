import { supabase } from "./supabaseClient";

export type TasmiRecord = {
  id: string;
  tanggal: string; // "YYYY-MM-DD"
  nama_santri: string;
  nama_ayah: string;
  usia_santri: string;
  nama_guru: string;
  juz: string;
  durasi: string;
  jumlah_kesalahan: number;
  updated_at?: string;
};

export type TasmiDraft = {
  tanggal: string;
  nama_santri: string;
  nama_ayah: string;
  usia_santri: string;
  nama_guru: string;
  juz: string;
  durasi: string;
  jumlah_kesalahan: number;
};

export const emptyTasmiDraft = (tanggal: string, namaGuru: string): TasmiDraft => ({
  tanggal,
  nama_santri: "",
  nama_ayah: "",
  usia_santri: "",
  nama_guru: namaGuru,
  juz: "",
  durasi: "",
  jumlah_kesalahan: 0,
});

/** Baca riwayat tasmi' 1 kelas, terbaru duluan. Guru cuma bisa baca punya dia sendiri (RLS),
 *  management bisa baca semua kelas -- makanya query di sini tetap filter `kelas` biar konsisten
 *  buat kedua role (guru juga kebetulan cuma punya 1 kelas). */
const SELECT_COLS = "id, tanggal, nama_santri, nama_ayah, usia_santri, nama_guru, juz, durasi, jumlah_kesalahan, updated_at";

export async function readTasmiByKelas(kelas: string): Promise<TasmiRecord[]> {
  const { data, error } = await supabase
    .from("tasmi_records")
    .select(SELECT_COLS)
    .eq("kelas", kelas)
    .order("tanggal", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as TasmiRecord[];
}

/** Baca 1 catatan by id -- dipakai halaman sertifikat (dibuka dari kartu riwayat, jadi RLS yang
 *  sama kayak readTasmiByKelas otomatis berlaku: guru cuma bisa buka punya kelasnya sendiri). */
export async function readTasmiById(id: string): Promise<TasmiRecord | null> {
  const { data, error } = await supabase.from("tasmi_records").select(SELECT_COLS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as TasmiRecord | null) ?? null;
}

export async function createTasmiRecord(kelas: string, draft: TasmiDraft): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesi login habis, coba masuk lagi.");

  const { error } = await supabase.from("tasmi_records").insert({
    user_id: user.id,
    kelas,
    tanggal: draft.tanggal,
    nama_santri: draft.nama_santri,
    nama_ayah: draft.nama_ayah.trim(),
    usia_santri: draft.usia_santri.trim(),
    nama_guru: draft.nama_guru.trim(),
    juz: draft.juz.trim(),
    durasi: draft.durasi.trim(),
    jumlah_kesalahan: draft.jumlah_kesalahan,
  });
  if (error) throw new Error(error.message);
}

export async function updateTasmiRecord(id: string, draft: TasmiDraft): Promise<void> {
  const { error } = await supabase
    .from("tasmi_records")
    .update({
      tanggal: draft.tanggal,
      nama_santri: draft.nama_santri,
      nama_ayah: draft.nama_ayah.trim(),
      usia_santri: draft.usia_santri.trim(),
      nama_guru: draft.nama_guru.trim(),
      juz: draft.juz.trim(),
      durasi: draft.durasi.trim(),
      jumlah_kesalahan: draft.jumlah_kesalahan,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteTasmiRecord(id: string): Promise<void> {
  const { error } = await supabase.from("tasmi_records").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export type TasmiRekapRow = { kelas: string; nama_santri: string; juz: string };

/** Baca SEMUA catatan tasmi' (semua kelas) dalam 1 tahun kalender -- buat rekap management.
 *  Cuma kolom yang perlu diagregasi (bukan SELECT_COLS lengkap) biar ringan. RLS: cuma
 *  management yang bisa baca lintas kelas kayak gini (guru cuma bisa baca punya kelasnya
 *  sendiri, lihat catatan di readTasmiByKelas). */
export async function readTasmiRekapTahun(year: number): Promise<TasmiRekapRow[]> {
  const { data, error } = await supabase
    .from("tasmi_records")
    .select("kelas, nama_santri, juz")
    .gte("tanggal", `${year}-01-01`)
    .lte("tanggal", `${year}-12-31`);
  if (error) throw new Error(error.message);
  return (data ?? []) as TasmiRekapRow[];
}
