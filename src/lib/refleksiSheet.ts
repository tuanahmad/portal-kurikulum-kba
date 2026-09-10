import { supabase } from "./supabaseClient";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export type ReflectionData = {
  namaGuru: string;
  kelas: string;
  level: string;
  bulan: string;
  capaianTarget: string[][]; // 4 baris x [Ya, Sebagian, Belum, Keterangan]
  keberhasilan: string[]; // 2
  kendala: string[][]; // 5 baris x [Kendala, Dampak, Penyebab]
  evaluasiDiri: string[]; // 8
  refleksiGuru: string[]; // 3
  rencanaPerbaikan: string[][]; // 4 baris x [Permasalahan, Solusi, Target Waktu]
  perkembanganMurid: string[][]; // 20 baris x [Nama Murid, Perkembangan, Tantangan, Rencana Pendampingan]
};

async function authHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${session?.access_token ?? SUPABASE_ANON_KEY}`,
  };
}

export async function readReflectionTab(fileId: string, sheetName: string): Promise<ReflectionData> {
  const headers = await authHeaders();
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/sheet-refleksi?fileId=${encodeURIComponent(fileId)}&sheetName=${encodeURIComponent(sheetName)}`,
    { headers }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || `Gagal memuat Refleksi (${res.status})`);
  return json.result as ReflectionData;
}

export async function writeReflectionTab(fileId: string, sheetName: string, payload: ReflectionData): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/sheet-refleksi`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ fileId, sheetName, ...payload }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || `Gagal menyimpan Refleksi (${res.status})`);
}
