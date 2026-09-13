// Tool admin sementara — dump mentah 1 spreadsheet (daftar tab + isi tiap tab) lewat OAuth
// service account, biar bisa lihat struktur sheet manapun yang udah di-share ke service account
// (bukan cuma yang link-shareable, beda dari GOOGLE_API_KEY-only reads di fungsi lain).
// GET ?fileId=... -> { sheets: [{ title, values }] }
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

async function getAccessToken(): Promise<string> {
  if (!SERVICE_ACCOUNT_JSON) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON belum di-set.");
  const sa = JSON.parse(SERVICE_ACCOUNT_JSON);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
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

    const token = await getAccessToken();
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
