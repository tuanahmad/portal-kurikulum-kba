import { supabase } from "./supabaseClient";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export type CapaianIlmuData = {
  level: "ka" | "qonuni";
  namaGuru: string;
  kelas: string;
  bulan: string;
  anak: { idx: number; nama: string }[]; // slot di sheet (urut sheet)
  values: Record<string, string[]>; // bidangKey -> [per anak slot idx]
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

export async function readCapaianIlmu(fileId: string, bulan: string): Promise<CapaianIlmuData> {
  const headers = await authHeaders();
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/sheet-capaian-ilmu?fileId=${encodeURIComponent(fileId)}&bulan=${encodeURIComponent(bulan)}`,
    { headers }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || `Gagal memuat Capaian Ilmu (${res.status})`);
  return json.result as CapaianIlmuData;
}

export async function writeCapaianIlmu(params: {
  fileId: string;
  bulan: string;
  cells: { bidangKey: string; anakIdx: number; value: string }[];
  names?: { anakIdx: number; nama: string }[];
}): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/sheet-capaian-ilmu`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || `Gagal menyimpan Capaian Ilmu (${res.status})`);
}
