import { supabase } from "./supabaseClient";

// Daftar santri per kelas disimpan di DATABASE (tabel santri_roster), bukan di kode -- supaya nama anak
// tidak ikut masuk repositori, dan tiap cabang punya daftar sendiri di database-nya sendiri. Dimuat sekali
// setelah login (lihat AuthContext); aturan akses (RLS) membatasi: guru hanya kelasnya, olahraga kelas
// Kuttab Awwal, management semua.

let cache: Record<string, string[]> | null = null;

/** Roster hasil muat dari database, atau null kalau belum/gagal dimuat (pemanggil pakai cadangan). */
export function rosterDariDb(): Record<string, string[]> | null {
  return cache;
}

export function kosongkanRoster() {
  cache = null;
}

/** Muat roster dari database. Tidak pernah melempar error: kalau gagal, cache lama (atau null) dibiarkan. */
export async function muatRoster(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from("santri_roster")
      .select("kelas, urutan, nama")
      .eq("aktif", true)
      .order("kelas", { ascending: true })
      .order("urutan", { ascending: true });
    if (error) throw error;
    const m: Record<string, string[]> = {};
    for (const r of data ?? []) (m[r.kelas as string] ??= []).push(r.nama as string);
    cache = m;
  } catch {
    /* gagal (jaringan/izin): biarkan, halaman memakai cadangan */
  }
}
