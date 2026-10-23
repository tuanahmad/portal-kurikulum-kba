import { supabase } from "./supabaseClient";

// Daftar santri per kelas disimpan di DATABASE (tabel santri_roster), bukan di kode -- supaya nama anak
// tidak ikut masuk repositori, dan tiap cabang punya daftar sendiri di database-nya sendiri. Dimuat sekali
// setelah login (lihat AuthContext); aturan akses (RLS) membatasi: guru hanya kelasnya, olahraga kelas
// Kuttab Awwal, management semua.

let cache: Record<string, string[]> | null = null;
// kelas -> (nama -> 'ikhwan' | 'akhwat'); dipakai Olahraga supaya santri hanya tampil di kelompoknya.
let kelompokCache: Record<string, Record<string, string>> | null = null;

/** Roster hasil muat dari database, atau null kalau belum/gagal dimuat (pemanggil pakai cadangan). */
export function rosterDariDb(): Record<string, string[]> | null {
  return cache;
}

/** Kelompok (ikhwan/akhwat) seorang santri menurut database, atau null kalau belum diketahui / roster belum termuat. */
export function kelompokSantri(kelas: string, nama: string): "ikhwan" | "akhwat" | null {
  const k = kelompokCache?.[kelas]?.[nama];
  return k === "ikhwan" || k === "akhwat" ? k : null;
}

export function kosongkanRoster() {
  cache = null;
  kelompokCache = null;
}

/** Muat roster dari database. Tidak pernah melempar error: kalau gagal, cache lama (atau null) dibiarkan. */
export async function muatRoster(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from("santri_roster")
      .select("kelas, urutan, nama, kelompok")
      .eq("aktif", true)
      .order("kelas", { ascending: true })
      .order("urutan", { ascending: true });
    if (error) throw error;
    const m: Record<string, string[]> = {};
    const kel: Record<string, Record<string, string>> = {};
    for (const r of data ?? []) {
      (m[r.kelas as string] ??= []).push(r.nama as string);
      if (r.kelompok) (kel[r.kelas as string] ??= {})[r.nama as string] = r.kelompok as string;
    }
    cache = m;
    kelompokCache = kel;
  } catch {
    /* gagal (jaringan/izin): biarkan, halaman memakai cadangan */
  }
}
