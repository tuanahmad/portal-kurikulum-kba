// Baca & tulis form RPB (Rencana Pembelajaran Bulanan) langsung ke tab Google Sheets
// yang sesuai kelas guru — dipakai oleh RpbFormPage & RpbPage.
//
// Baca (GET)  : pakai GOOGLE_API_KEY (read-only, sheet-nya link-shareable jadi API key cukup).
// Tulis (POST): butuh GOOGLE_SERVICE_ACCOUNT_JSON (secret Supabase, format JSON key service account
//               Google Cloud) karena Sheets API TIDAK bisa nulis cuma pakai API key. Kalau secret ini
//               belum di-set, endpoint tulis akan balas error yang jelas (bukan diam-diam gagal).
//
// Nama tab dicocokkan LONGGAR (buang semua spasi + case-insensitive) terhadap judul tab asli
// di spreadsheet sebelum dipakai buat baca/tulis — sheet hasil convert Excel->Sheets kadang punya
// spasi nyasar di nama tab ("Kuttab Awwal 1 A", " Qonuni 2 Ikhwan") yang bikin lookup exact-match
// gagal walau sheet-nya sendiri OK. Kalau gak ketemu yang cocok, tetep pakai nama aslinya biar
// error dari Sheets API jelas (bukan disembunyikan).
//
// ————— BACA (dinamis, bukan range tetap) —————
// Awalnya pakai range tetap (C3:C7 / C11:E15+C60:E62 / B19:E58), tapi ternyata beda guru nulis
// RPB dengan format yang beda-beda (terutama Qonuni):
//  - Info header kadang "Label" (kolom B) + "Value" (kolom C) terpisah, kadang digabung jadi
//    1 sel "Label: Value" di kolom B doang — headerValue() cek kolom C dulu, baru fallback ke
//    kolom B dengan potong di titik dua pertama.
//  - Jumlah baris Tabel B & Tabel C beda-beda per kelas/guru (Qonuni bisa jauh lebih panjang
//    dari 5+3 baris yang diasumsikan sebelumnya) — batasnya sekarang dicari dengan nemuin teks
//    marker-nya ("B. Target Pembelajaran" / "C. Rencana Materi Tiap Pekan"), bukan angka baris
//    tetap, jadi otomatis nyesuaiin berapa pun panjangnya.
//  - Sebagian kelas Qonuni punya kolom TAMBAHAN di Tabel B buat sub-topik/nama-santri per
//    bidang ilmu (mis. "Ziyadah"/"Wirid"/"Tilawah" di bawah "Al-Qur'an"), sebagian lagi nggak
//    (strukturnya sama kayak Kuttab Awwal). Baca kolom lebar (C..G) apa adanya di sini — nggak
//    nebak kolom mana artinya apa; itu diinterpretasikan di klien (RpbPage.tsx) berdasarkan
//    berapa kolom yang keisi di baris itu, bukan asumsi posisi tetap.
//
// ————— TULIS (masih range tetap) —————
// writeTab masih pakai posisi tetap (C3:C7, C11:E15+C60:E62, B19:E58) — CUMA aman buat Kuttab
// Awwal, yang formatnya udah diverifikasi konsisten. RpbFormPage sengaja gak manggil ini buat
// kelas Qonuni (ditolak di klien) karena format Tabel B/C-nya beda-beda antar guru — nulis
// otomatis ke posisi tetap berisiko nimpa data yang strukturnya beda dari yang diasumsikan.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
const SERVICE_ACCOUNT_JSON = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HEADER_RANGE = "C3:C7"; // Nama Guru, Kelas, Level, Bulan, Jumlah Pertemuan (buat TULIS)
const TABLE_B_RANGE = "C11:E15"; // Bidang Ilmu 1-5 (buat TULIS — Kuttab Awwal aja)
const TABLE_B_EXTRA_RANGE = "C60:E62"; // Bidang Ilmu 6-8 (buat TULIS — Kuttab Awwal aja)
const TABLE_C_RANGE = "B19:E58"; // 8 Bidang Ilmu x 5 Pekan (buat TULIS — Kuttab Awwal aja)
const FULL_SCAN_RANGE = "A1:J200"; // buat BACA — cukup lebar/panjang buat nangkep sheet manapun

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normTabName(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

/** Cari judul tab ASLI yang paling cocok (longgar) sama `requested`. Kalau gak ketemu,
 *  balikin `requested` apa adanya biar error selanjutnya jelas nyebut nama yang diminta. */
async function resolveSheetName(fileId: string, requested: string, auth: { apiKey?: string; token?: string }): Promise<string> {
  const url = auth.token
    ? `https://sheets.googleapis.com/v4/spreadsheets/${fileId}?fields=sheets.properties.title`
    : `https://sheets.googleapis.com/v4/spreadsheets/${fileId}?fields=sheets.properties.title&key=${auth.apiKey}`;
  const res = await fetch(url, auth.token ? { headers: { Authorization: `Bearer ${auth.token}` } } : undefined);
  if (!res.ok) return requested; // biarin gagal di request berikutnya dengan pesan yang jelas
  const data = await res.json();
  const titles: string[] = (data.sheets ?? []).map((s: { properties: { title: string } }) => s.properties.title);
  const target = normTabName(requested);
  const exact = titles.find((t) => t === requested);
  if (exact) return exact;
  const loose = titles.find((t) => normTabName(t) === target);
  return loose ?? requested;
}

// ————— GET: baca isi tab (dinamis) —————
function cellAt(rows: string[][], r: number, c: number): string {
  return (rows[r]?.[c] ?? "").toString();
}

function findMarkerRow(rows: string[][], marker: string): number {
  const m = marker.toLowerCase();
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].some((v) => (v ?? "").toString().toLowerCase().includes(m))) return i;
  }
  return -1;
}

/** Nilai 1 field header — cek kolom C dulu (format lama: Label|Value kepisah), fallback ke
 *  kolom B dipotong di titik dua pertama (format baru: "Label: Value" digabung 1 sel). */
function headerValue(rows: string[][], row: number): string {
  const c = cellAt(rows, row, 2).trim();
  if (c) return c;
  const b = cellAt(rows, row, 1).trim();
  const idx = b.indexOf(":");
  return idx >= 0 ? b.slice(idx + 1).trim() : "";
}

async function fetchGrid(fileId: string, sheetName: string): Promise<string[][]> {
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/` +
    `${encodeURIComponent(`${sheetName}!${FULL_SCAN_RANGE}`)}?key=${GOOGLE_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets API error ${res.status}: ${body}`);
  }
  const data = await res.json();
  return (data.values ?? []) as string[][];
}

async function readTab(fileId: string, sheetNameRaw: string) {
  const sheetName = await resolveSheetName(fileId, sheetNameRaw, { apiKey: GOOGLE_API_KEY });
  const rows = await fetchGrid(fileId, sheetName);

  const namaGuru = headerValue(rows, 2);
  const kelas = headerValue(rows, 3);
  const level = headerValue(rows, 4);
  const bulan = headerValue(rows, 5);
  const jumlahPertemuan = headerValue(rows, 6);

  const bMarker = findMarkerRow(rows, "b. target pembelajaran");
  const cMarker = findMarkerRow(rows, "c. rencana materi");

  // Tabel B: mulai 2 baris setelah marker-nya (lewatin baris header "No/Bidang Ilmu/..."),
  // sampai marker C (atau abis baris kalau marker C gak ketemu). Kolom C..G (lebar) biar
  // nangkep kolom tambahan Qonuni juga, gak cuma C..E.
  const tableB: string[][] = [];
  if (bMarker >= 0) {
    const start = bMarker + 2;
    const end = cMarker >= 0 ? cMarker : rows.length;
    for (let r = start; r < end; r++) {
      const row = [2, 3, 4, 5, 6].map((c) => cellAt(rows, r, c));
      if (row.some((v) => v.trim())) tableB.push(row);
    }
  }

  // Tabel C: mulai 2 baris setelah marker-nya (lewatin baris header "Pekan/Bidang Ilmu/...").
  const tableC: string[][] = [];
  if (cMarker >= 0) {
    const start = cMarker + 2;
    for (let r = start; r < rows.length; r++) {
      const row = [1, 2, 3, 4].map((c) => cellAt(rows, r, c));
      if (row.some((v) => v.trim())) tableC.push(row);
    }
  }

  return { namaGuru, kelas, level, bulan, jumlahPertemuan, tableB, tableC };
}

// ————— OAuth service account (buat POST) —————
function base64url(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = "";
  for (const b of arr) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken(): Promise<string> {
  if (!SERVICE_ACCOUNT_JSON) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON belum di-set di Supabase secrets — fitur simpan otomatis belum aktif."
    );
  }
  const sa = JSON.parse(SERVICE_ACCOUNT_JSON);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const enc = new TextEncoder();
  const unsigned = `${base64url(enc.encode(JSON.stringify(header)))}.${base64url(enc.encode(JSON.stringify(claims)))}`;

  const pem = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const keyBytes = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(unsigned));
  const jwt = `${unsigned}.${base64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gagal ambil access token Google: ${res.status} ${body}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

// ————— POST: tulis isi tab (Kuttab Awwal aja, lihat catatan di atas) —————
async function writeTab(
  fileId: string,
  sheetNameRaw: string,
  payload: {
    namaGuru: string;
    kelas: string;
    level: string;
    bulan: string;
    jumlahPertemuan: string;
    tableB: string[][]; // selalu 8 baris dari sisi app (5 utama + 3 tambahan)
    tableC: string[][];
  }
) {
  const accessToken = await getAccessToken();
  const sheetName = await resolveSheetName(fileId, sheetNameRaw, { token: accessToken });
  const tableBMain = payload.tableB.slice(0, 5);
  const tableBExtra = payload.tableB.slice(5, 8);
  const data = [
    {
      range: `${sheetName}!${HEADER_RANGE}`,
      values: [[payload.namaGuru], [payload.kelas], [payload.level], [payload.bulan], [payload.jumlahPertemuan]],
    },
    { range: `${sheetName}!${TABLE_B_RANGE}`, values: tableBMain },
    { range: `${sheetName}!${TABLE_B_EXTRA_RANGE}`, values: tableBExtra },
    { range: `${sheetName}!${TABLE_C_RANGE}`, values: payload.tableC },
  ];
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ valueInputOption: "RAW", data }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets API error ${res.status}: ${body}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!GOOGLE_API_KEY) {
    return json({ error: "GOOGLE_API_KEY belum di-set di Supabase secrets" }, 500);
  }

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const fileId = url.searchParams.get("fileId");
      const sheetName = url.searchParams.get("sheetName");
      if (!fileId || !sheetName) {
        return json({ error: "fileId dan sheetName wajib diisi" }, 400);
      }
      const result = await readTab(fileId, sheetName);
      return json({ result });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { fileId, sheetName, ...payload } = body;
      if (!fileId || !sheetName) {
        return json({ error: "fileId dan sheetName wajib diisi" }, 400);
      }
      await writeTab(fileId, sheetName, payload);
      return json({ ok: true });
    }

    return json({ error: "Method tidak didukung" }, 405);
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
