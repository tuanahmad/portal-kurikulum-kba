import { supabase } from "./supabaseClient";

// Nama guru untuk tampilan MANAGEMENT: nama lengkap (profiles.nama_lengkap) kalau ada, kalau tidak nama di akun
// (full_name). Tampilan guru tidak memakai ini -- mereka tetap melihat nama panggilan yang mereka pilih.

export const namaTampilGuru = (p: { nama_lengkap?: string | null; full_name?: string | null; kelas?: string | null }): string =>
  (p.nama_lengkap || "").trim() || (p.full_name || "").trim() || (p.kelas || "") || "";

let simpanan: { waktu: number; data: Promise<Record<string, string>> } | null = null;

/** Peta kelas -> nama guru untuk management. Disimpan sementara 2 menit supaya tidak membaca berulang. */
export function bacaNamaGuruKelas(): Promise<Record<string, string>> {
  if (simpanan && Date.now() - simpanan.waktu < 2 * 60 * 1000) return simpanan.data;
  const data = (async () => {
    const { data, error } = await supabase.from("profiles").select("kelas, full_name, nama_lengkap").eq("role", "guru");
    if (error) throw new Error(error.message);
    const peta: Record<string, string> = {};
    for (const r of data ?? []) if (r.kelas && !peta[r.kelas as string]) peta[r.kelas as string] = namaTampilGuru(r as never);
    return peta;
  })();
  simpanan = { waktu: Date.now(), data };
  data.catch(() => {
    simpanan = null;
  });
  return data;
}
