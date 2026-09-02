import { supabase } from "./supabaseClient";

export type DriveNode =
  | { type: "file"; id: string; name: string; mimeType: string }
  | { type: "folder"; id: string; name: string; children: DriveNode[] };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Cache ringan di memori (per sesi tab) — isi Instrumen Ilmu jarang berubah, jadi
// gak perlu fetch ulang tiap kali guru bolak-balik ke halaman yang sama.
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 menit
const cache = new Map<string, { at: number; data: Record<string, DriveNode[]> }>();

/** List isi beberapa folder Google Drive sekaligus (rekursif, sudah termasuk sub-folder)
 *  lewat edge function `drive-list` — 1 request buat semua folderId biar gak lambat,
 *  dan di-cache sebentar biar kunjungan berikutnya instan. */
export async function listDriveFolders(folderIds: string[]): Promise<Record<string, DriveNode[]>> {
  const cacheKey = folderIds.join(",");
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const res = await fetch(`${SUPABASE_URL}/functions/v1/drive-list?folderIds=${encodeURIComponent(cacheKey)}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session?.access_token ?? SUPABASE_ANON_KEY}`,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Gagal memuat folder (${res.status})`);
  }

  const json = await res.json();
  const data = (json.result ?? {}) as Record<string, DriveNode[]>;
  cache.set(cacheKey, { at: Date.now(), data });
  return data;
}

/** Cari langsung satu sub-folder anak berdasarkan nama (match awal kata, case-insensitive). */
export function findChildFolder(nodes: DriveNode[], name: string): (DriveNode & { type: "folder" }) | null {
  const found = nodes.find(
    (n): n is DriveNode & { type: "folder" } => n.type === "folder" && n.name.toLowerCase().startsWith(name.toLowerCase())
  );
  return found ?? null;
}
