// Baca & tulis form RPB (Rencana Pembelajaran Bulanan) langsung ke tab Google Sheets
// yang sesuai kelas guru — dipakai oleh RpbFormPage.
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
// Layout tab RPB (hasil observasi sheet asli, lihat komentar di RpbFormPage.tsx untuk detail):
//   C3:C7   -> Nama Guru, Kelas, Level, Bulan, Jumlah Pertemuan
//   C11:E15 -> Tabel B "Target Pembelajaran" bagian 1 (Bidang Ilmu 1-5) — kolom B ("No") SENGAJA
//              gak disentuh, itu cuma label 1-5 tetap di template, bukan data guru.
//   C60:E62 -> Tabel B bagian 2 (Bidang Ilmu 6-8) — area TAMBAHAN di baris yang sebelumnya kosong
//              di sheet asli (dicek manual sampai row 66), dipisah dari bagian 1 karena baris
//              16-18 udah kepakai duluan sama header "C. Rencana Materi Tiap Pekan". Digabung jadi
//              1 array 8 baris di sisi app (lihat readTab/writeTab).
//   B19:E58 -> Tabel C "Rencana Materi Tiap Pekan" (Pekan, Bidang Ilmu, Sub-Ilmu, Metode Pengajaran)
//              — 40 baris = 8 Bidang Ilmu x 5 Pekan tetap. Diperluas bertahap dari B19:E35 (17) ->
//              B19:E38 (20, 5x4) -> B19:E58 (40, 8x5). Baris 36-58 di sheet asli kosong (dicek
//              manual), aman dipakai — murni nambah range, gak ada insert baris di sheet fisiknya.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
const SERVICE_ACCOUNT_JSON = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HEADER_RANGE = "C3:C7"; // Nama Guru, Kelas, Level, Bulan, Jumlah Pertemuan
const TABLE_B_RANGE = "C11:E15"; // Bidang Ilmu 1-5
const TABLE_B_EXTRA_RANGE = "C60:E62"; // Bidang Ilmu 6-8
const TABLE_C_RANGE = "B19:E58"; // 8 Bidang Ilmu x 5 Pekan

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

// ————— GET: baca isi tab —————
async function readTab(fileId: string, sheetNameRaw: string) {
  const sheetName = await resolveSheetName(fileId, sheetNameRaw, { apiKey: GOOGLE_API_KEY });
  const ranges = [HEADER_RANGE, TABLE_B_RANGE, TABLE_B_EXTRA_RANGE, TABLE_C_RANGE].map(
    (r) => `${sheetName}!${r}`
  );
  const params = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join("&");
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values:batchGet` +
    `?${params}&key=${GOOGLE_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets API error ${res.status}: ${body}`);
  }
  const data = await res.json();
  const [header, tableBMain, tableBExtra, tableC] = (data.valueRanges ?? []).map(
    (vr: { values?: string[][] }) => vr.values ?? []
  );
  return {
    namaGuru: header?.[0]?.[0] ?? "",
    kelas: header?.[1]?.[0] ?? "",
    level: header?.[2]?.[0] ?? "",
    bulan: header?.[3]?.[0] ?? "",
    jumlahPertemuan: header?.[4]?.[0] ?? "",
    tableB: [...tableBMain, ...tableBExtra], // digabung jadi 1 array 8 baris di sisi app
    tableC,
  };
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

// ————— POST: tulis isi tab —————
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
