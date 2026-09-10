import { supabase } from "./supabaseClient";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export type RpbTabData = {
  namaGuru: string;
  kelas: string;
  level: string;
  bulan: string;
  jumlahPertemuan: string;
  tableB: string[][];
  tableC: string[][];
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

/** Baca isi tab RPB (kelas) di file bulan tertentu, lewat edge function `sheet-rpb`. */
export async function readRpbTab(fileId: string, sheetName: string): Promise<RpbTabData> {
  const headers = await authHeaders();
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/sheet-rpb?fileId=${encodeURIComponent(fileId)}&sheetName=${encodeURIComponent(sheetName)}`,
    { headers }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || `Gagal memuat RPB (${res.status})`);
  return json.result as RpbTabData;
}

/** Simpan isi tab RPB — butuh GOOGLE_SERVICE_ACCOUNT_JSON di-set di Supabase secrets. */
export async function writeRpbTab(fileId: string, sheetName: string, payload: RpbTabData): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/sheet-rpb`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ fileId, sheetName, ...payload }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || `Gagal menyimpan RPB (${res.status})`);
}
