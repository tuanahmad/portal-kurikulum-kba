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

// ————— Cocokin Tabel C (Rencana Materi Tiap Pekan) ke Bidang Ilmu-nya berdasarkan NAMA —————
// Di sheet ASLI (yang udah dipakai guru dari sebelum ada app ini), Tabel C disusun PER PEKAN:
// 5 baris bidang ilmu berturut-turut buat Pekan 1 (urutannya ngikutin Tabel B), lalu 5 baris lagi
// buat Pekan 2, dst — bukan "5 baris pekan per 1 bidang ilmu" kayak yang sempat diasumsikan app
// (assumption itu bikin rekap/form nunjukin isi pekan yang ketuker sama bidang ilmu lain kalau
// bidang-nya lebih dari 1). Kolom Pekan & Bidang Ilmu juga suka "nyambung" — kosong di baris
// lanjutan, ngikutin nilai di baris sebelumnya (kayak sel yang di-merge visualnya).
//
// HANYA berlaku buat Kuttab Awwal — struktur kolom Tabel B/C punya Qonuni ternyata beda (ada
// kolom ekstra buat sub-topik per bidang ilmu, gak ketangkep sama range tetap C11:E15 di
// sheet-rpb), jadi belum aman dicocokin dengan cara yang sama di sini.
export type PekanEntry = { subIlmu: string; metode: string };

function normBidangName(s: string): string {
  return (s || "").trim().toLowerCase();
}

/** Parse tableC mentah (urutan pekan-major, sticky carry-forward) jadi lookup by nama bidang
 *  ilmu -> nomor pekan -> isian. Bisa lebih dari 1 isian per (bidang, pekan) kalau baris-nya
 *  kebetulan diulang/ada sub-topik — ditangani di lookupPekanEntry, bukan di sini. */
export function parseTableCByBidang(tableC: string[][]): Map<string, Map<number, PekanEntry[]>> {
  const result = new Map<string, Map<number, PekanEntry[]>>();
  let curPekan = 0;
  let curBidang = "";
  for (const row of tableC) {
    const pekanCell = (row[0] ?? "").trim();
    const bidangCell = (row[1] ?? "").trim();
    const subIlmu = (row[2] ?? "").trim();
    const metode = (row[3] ?? "").trim();
    if (pekanCell) {
      const n = parseInt(pekanCell, 10);
      if (Number.isFinite(n) && n >= 1) curPekan = n;
    }
    if (bidangCell) curBidang = bidangCell;
    if (!curPekan || !curBidang || (!subIlmu && !metode)) continue;
    const key = normBidangName(curBidang);
    if (!result.has(key)) result.set(key, new Map());
    const byPekan = result.get(key)!;
    if (!byPekan.has(curPekan)) byPekan.set(curPekan, []);
    byPekan.get(curPekan)!.push({ subIlmu, metode });
  }
  return result;
}

/** Ambil isian (bidang, pekan) dari hasil parseTableCByBidang, cocokin by NAMA (bukan posisi).
 *  Exact match dulu; kalau gak ketemu, coba substring (salah satu nama "termuat" di nama yang
 *  lain) — nama bidang ilmu di Tabel B & Tabel C kadang beda panjang buat bidang yang SAMA
 *  ("kisah para nabi" di Tabel B vs cuma "kisah" di Tabel C, "Huruf besar" vs "Huruf"), guru yang
 *  sama cuma ngetik beda singkat/panjang di 2 tabel itu. Kalau ada lebih dari 1 baris buat
 *  kombinasi itu, digabung jadi satu supaya tetep muat di 1 field sub-ilmu / metode. */
export function lookupPekanEntry(
  parsed: Map<string, Map<number, PekanEntry[]>>,
  bidangName: string,
  pekan: number
): PekanEntry {
  const target = normBidangName(bidangName);
  let byPekan = parsed.get(target);
  if (!byPekan && target) {
    for (const [key, val] of parsed) {
      if (key && (key.includes(target) || target.includes(key))) {
        byPekan = val;
        break;
      }
    }
  }
  const entries = byPekan?.get(pekan) ?? [];
  if (entries.length === 0) return { subIlmu: "", metode: "" };
  if (entries.length === 1) return entries[0];
  return {
    subIlmu: entries.map((e) => e.subIlmu).filter(Boolean).join(" · "),
    metode: entries.map((e) => e.metode).filter(Boolean).join("\n\n"),
  };
}

/** Bangun ulang tableC dalam urutan PEKAN-MAJOR (samain format sama sheet asli) buat ditulis
 *  balik ke sheet — `bidangSlots` bidang ilmu per pekan (blok tetap, biar batas tiap pekan bisa
 *  ditebak lagi kalau perlu), diisi dari `getEntry(bidangIndex, pekan)`. */
export function buildTableCPekanMajor(
  tableB: string[][],
  bidangSlots: number,
  getEntry: (bidangIndex: number, pekan: number) => PekanEntry,
  totalRows: number,
  pekanCount = 5
): string[][] {
  const rows: string[][] = [];
  for (let w = 1; w <= pekanCount; w++) {
    for (let bi = 0; bi < bidangSlots; bi++) {
      const bidangName = tableB[bi]?.[0] ?? "";
      const { subIlmu, metode } = getEntry(bi, w);
      rows.push([String(w), bidangName, subIlmu, metode]);
    }
  }
  while (rows.length < totalRows) rows.push(["", "", "", ""]);
  return rows.slice(0, totalRows);
}
