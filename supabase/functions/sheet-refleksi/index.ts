// Baca & tulis form Refleksi Bulanan langsung ke tab Google Sheets yang sesuai kelas guru —
// dipakai oleh RefleksiFormPage. Pola sama persis kayak sheet-rpb (lihat komentar di situ buat
// detail kenapa GET pakai API key tapi POST butuh service account).
//
// Layout tab Refleksi (hasil observasi manual sheet asli, lihat komentar di RefleksiFormPage.tsx):
//   B3:B6   -> Nama Guru, Kelas, Level, Bulan
//   B10:E13 -> A. Capaian Target — 4 komponen x (Ya, Sebagian, Belum, Keterangan)
//   B16:B17 -> B. Analisis Keberhasilan — 2 jawaban teks
//   A21:C25 -> C. Analisis Kendala — 5 baris x (Kendala, Dampak, Penyebab)
//   B28:B35 -> D. Evaluasi Diri Guru — 8 nilai (1-4)
//   B38:B40 -> E. Refleksi Guru — 3 jawaban teks
//   A44:C47 -> F. Rencana Perbaikan — 4 baris x (Permasalahan, Solusi, Target Waktu)
//   A51:D70 -> G. Refleksi Perkembangan Murid — 20 baris x (Nama Murid, Perkembangan, Tantangan,
//              Rencana Pendampingan). Nama Murid diisi otomatis dari roster (SANTRI_LIST di app),
//              bukan diketik guru — lihat komentar di RefleksiFormPage.tsx.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
const SERVICE_ACCOUNT_JSON = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HEADER_RANGE = "B3:B6";
const SECTION_A_RANGE = "B10:E13";
const SECTION_B_RANGE = "B16:B17";
const SECTION_C_RANGE = "A21:C25";
const SECTION_D_RANGE = "B28:B35";
const SECTION_E_RANGE = "B38:B40";
const SECTION_F_RANGE = "A44:C47";
const SECTION_G_RANGE = "A51:D70";

const ALL_RANGES = [
  HEADER_RANGE,
  SECTION_A_RANGE,
  SECTION_B_RANGE,
  SECTION_C_RANGE,
  SECTION_D_RANGE,
  SECTION_E_RANGE,
  SECTION_F_RANGE,
  SECTION_G_RANGE,
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ————— GET: baca isi tab —————
async function readTab(fileId: string, sheetName: string) {
  const ranges = ALL_RANGES.map((r) => `${sheetName}!${r}`);
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
  const [header, capaianTarget, keberhasilan, kendala, evaluasiDiri, refleksiGuru, rencanaPerbaikan, perkembanganMurid] =
    (data.valueRanges ?? []).map((vr: { values?: string[][] }) => vr.values ?? []);
  return {
    namaGuru: header?.[0]?.[0] ?? "",
    kelas: header?.[1]?.[0] ?? "",
    level: header?.[2]?.[0] ?? "",
    bulan: header?.[3]?.[0] ?? "",
    capaianTarget,
    keberhasilan: keberhasilan.map((r: string[]) => r[0] ?? ""),
    kendala,
    evaluasiDiri: evaluasiDiri.map((r: string[]) => r[0] ?? ""),
    refleksiGuru: refleksiGuru.map((r: string[]) => r[0] ?? ""),
    rencanaPerbaikan,
    perkembanganMurid,
  };
}

// ————— OAuth service account (buat POST) — sama persis kayak sheet-rpb —————
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
  sheetName: string,
  payload: {
    namaGuru: string;
    kelas: string;
    level: string;
    bulan: string;
    capaianTarget: string[][];
    keberhasilan: string[];
    kendala: string[][];
    evaluasiDiri: string[];
    refleksiGuru: string[];
    rencanaPerbaikan: string[][];
    perkembanganMurid: string[][];
  }
) {
  const accessToken = await getAccessToken();
  const data = [
    { range: `${sheetName}!${HEADER_RANGE}`, values: [[payload.namaGuru], [payload.kelas], [payload.level], [payload.bulan]] },
    { range: `${sheetName}!${SECTION_A_RANGE}`, values: payload.capaianTarget },
    { range: `${sheetName}!${SECTION_B_RANGE}`, values: payload.keberhasilan.map((v) => [v]) },
    { range: `${sheetName}!${SECTION_C_RANGE}`, values: payload.kendala },
    { range: `${sheetName}!${SECTION_D_RANGE}`, values: payload.evaluasiDiri.map((v) => [v]) },
    { range: `${sheetName}!${SECTION_E_RANGE}`, values: payload.refleksiGuru.map((v) => [v]) },
    { range: `${sheetName}!${SECTION_F_RANGE}`, values: payload.rencanaPerbaikan },
    { range: `${sheetName}!${SECTION_G_RANGE}`, values: payload.perkembanganMurid },
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
