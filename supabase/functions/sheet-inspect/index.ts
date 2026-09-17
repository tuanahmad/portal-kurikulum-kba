// Tool admin sementara — dump mentah 1 spreadsheet (daftar tab + isi tiap tab) lewat OAuth
// service account, biar bisa lihat struktur sheet manapun yang udah di-share ke service account
// (bukan cuma yang link-shareable, beda dari GOOGLE_API_KEY-only reads di fungsi lain).
// GET ?fileId=... -> { sheets: [{ title, values }] }
// GET ?fileId=...&titlesOnly=1 -> { titles: [...] } (ringan, buat scan cepat banyak file)
// GET ?fileId=...&testCopy=1 -> coba copy+convert file itu (xlsx->Google Sheets native) ke
//   file BARU (source file sama sekali gak disentuh) - buat ngetes apakah service account bisa
//   convert Office file yang selama ini bikin Sheets API nolak baca RPB/Refleksi produksi.
// GET ?fileId=...&splitTab=1&sourceTitle=...&titleA=...&titleB=...  -> duplikat 1 tab JADI 2 tab
//   baru (nama sesuai titleA/titleB) lalu HAPUS tab sumbernya, semua dalam 1 batchUpdate atomik.
//   Dipakai buat mecah tab "Kuttab Awwal 1" (gabungan, belum di-split kayak 1A/1B di bulan lain)
//   jadi 2 tab terpisah kalau isinya masih TEMPLATE KOSONG (aman didupilkat, gak ada data ke-timpa) —
//   jangan pernah dipanggil ke tab yang udah ada isinya tanpa ngecek dulu.
// GET ?fileId=<parentFolderId>&createFolder=1&name=...  -> buat 1 folder Drive baru di dalam
//   fileId (dipakai sebagai parent id di sini, bukan file). Butuh Drive API nyala + service
//   account punya akses Editor ke folder induknya (kemungkinan gagal 403 kalau belum).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SERVICE_ACCOUNT_JSON = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function base64url(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = "";
  for (const b of arr) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken(scope: string): Promise<string> {
  if (!SERVICE_ACCOUNT_JSON) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON belum di-set.");
  const sa = JSON.parse(SERVICE_ACCOUNT_JSON);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const enc = new TextEncoder();
  const unsigned = `${base64url(enc.encode(JSON.stringify(header)))}.${base64url(enc.encode(JSON.stringify(claims)))}`;
  const pem = sa.private_key.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s/g, "");
  const keyBytes = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", keyBytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(unsigned));
  const jwt = `${unsigned}.${base64url(signature)}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!res.ok) throw new Error(`Gagal ambil access token: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token as string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const fileId = url.searchParams.get("fileId");
    if (!fileId) return json({ error: "fileId wajib diisi" }, 400);

    if (url.searchParams.get("testCopy")) {
      const token = await getAccessToken("https://www.googleapis.com/auth/drive");
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/copy`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "TEST-convert-" + Date.now(),
            mimeType: "application/vnd.google-apps.spreadsheet",
          }),
        }
      );
      const body = await res.json();
      return json({ status: res.status, body });
    }

    if (url.searchParams.get("createFolder")) {
      const name = url.searchParams.get("name");
      if (!name) return json({ error: "name wajib diisi" }, 400);
      const token = await getAccessToken("https://www.googleapis.com/auth/drive");
      const res = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          mimeType: "application/vnd.google-apps.folder",
          parents: [fileId],
        }),
      });
      const body = await res.json();
      return json({ status: res.status, body });
    }

    if (url.searchParams.get("splitTab")) {
      const sourceTitle = url.searchParams.get("sourceTitle");
      const titleA = url.searchParams.get("titleA");
      const titleB = url.searchParams.get("titleB");
      if (!sourceTitle || !titleA || !titleB) {
        return json({ error: "sourceTitle, titleA, titleB wajib diisi" }, 400);
      }
      const token = await getAccessToken("https://www.googleapis.com/auth/spreadsheets");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

      const metaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${fileId}?fields=sheets.properties`,
        { headers }
      );
      if (!metaRes.ok) return json({ error: `Sheets API (metadata) ${metaRes.status}: ${await metaRes.text()}` }, 502);
      const meta = await metaRes.json();
      const src = (meta.sheets ?? []).find((s: any) => s.properties.title === sourceTitle);
      if (!src) return json({ error: `Tab "${sourceTitle}" tidak ditemukan` }, 404);
      const sheetId = src.properties.sheetId;
      const index = src.properties.index;

      const batchRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${fileId}:batchUpdate`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          requests: [
            { duplicateSheet: { sourceSheetId: sheetId, insertSheetIndex: index + 1, newSheetName: titleA } },
            { duplicateSheet: { sourceSheetId: sheetId, insertSheetIndex: index + 2, newSheetName: titleB } },
            { deleteSheet: { sheetId } },
          ],
        }),
      });
      const body = await batchRes.json();
      return json({ status: batchRes.status, body });
    }

    const token = await getAccessToken("https://www.googleapis.com/auth/spreadsheets.readonly");
    const headers = { Authorization: `Bearer ${token}` };

    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${fileId}?fields=sheets.properties.title`,
      { headers }
    );
    if (!metaRes.ok) return json({ error: `Sheets API (metadata) ${metaRes.status}: ${await metaRes.text()}` }, 502);
    const meta = await metaRes.json();
    const titles: string[] = (meta.sheets ?? []).map((s: any) => s.properties.title);

    if (url.searchParams.get("titlesOnly")) return json({ titles });

    const sheets: { title: string; values: string[][] }[] = [];
    for (const title of titles) {
      const r = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/${encodeURIComponent(title + "!A1:Z100")}`,
        { headers }
      );
      if (!r.ok) {
        sheets.push({ title, values: [[`ERROR ${r.status}: ${await r.text()}`]] });
        continue;
      }
      const d = await r.json();
      sheets.push({ title, values: d.values ?? [] });
    }

    return json({ sheets });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
