import { supabase } from "./supabaseClient";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export type CapaianQuranStudent = { row: number; nama: string; values: string[] };

export type CapaianQuranSection = {
  name: string;
  type: "pertemuan" | "pekan";
  slotCount: number;
  firstDataRow: number;
  notesRow: number;
  students: CapaianQuranStudent[];
};

export type CapaianQuranData = {
  namaGuru: string;
  kelas: string;
  level: string;
  bulan: string;
  sections: CapaianQuranSection[];
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

export async function readCapaianQuran(fileId: string, tab: string): Promise<CapaianQuranData> {
  const headers = await authHeaders();
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/sheet-capaian-quran?fileId=${encodeURIComponent(fileId)}&tab=${encodeURIComponent(tab)}`,
    { headers }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || `Gagal memuat Capaian Al-Qur'an (${res.status})`);
  return json.result as CapaianQuranData;
}

/** Tulis 1 slot (pertemuan/pekan ke-`slotIndex`, 1-based) untuk 1 section. */
export async function writeCapaianQuranSlot(params: {
  fileId: string;
  tab: string;
  sectionName: string;
  slotIndex: number;
  roster: string[];
  values: string[];
}): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/sheet-capaian-quran`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || `Gagal menyimpan Capaian Al-Qur'an (${res.status})`);
}
