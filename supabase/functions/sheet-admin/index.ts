// Alat admin Sheets (hanya management): lihat daftar tab, lihat isi mentah, dan menyiapkan tab RPB yang
// masih kosong dengan menyalin KERANGKA dari tab lain (penanda "Nama Guru", "B. Target Pembelajaran",
// "C. Rencana Materi") lalu mengosongkan sel isiannya.
// Pengamanan: verify_jwt:true DAN dicek di dalam kode bahwa pemanggil login sebagai role management.
// Tab target HARUS benar-benar kosong (A1:J200) -- kalau ada isi sedikit pun, ditolak. Tidak ada aksi hapus lain.
// Pengganti aman untuk `sheet-inspect` lama (yang terbuka tanpa login, sudah dinonaktifkan 2026-10-05).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SERVICE_ACCOUNT_JSON = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function isManagement(req: Request): Promise<boolean> {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return false;
  const userClient = createClient(SUPABASE_URL, ANON_KEY);
  const { data, error } = await userClient.auth.getUser(jwt);
  if (error || !data?.user) return false;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: prof } = await admin.from("profiles").select("role").eq("id", data.user.id).single();
  return prof?.role === "management";
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
  const enc = new TextEncoder();
  const unsigned = `${base64url(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })))}.${base64url(
    enc.encode(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/spreadsheets", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }))
  )}`;
  const pem = sa.private_key.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s/g, "");
  const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(unsigned));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${base64url(sig)}` }),
  });
  if (!res.ok) throw new Error(`Gagal ambil access token: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token as string;
}

const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";

async function listTabs(fileId: string, token: string): Promise<{ title: string; sheetId: number; index: number }[]> {
  const res = await fetch(`${SHEETS}/${fileId}?fields=sheets.properties(title,sheetId,index)`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
  return ((await res.json()).sheets ?? []).map((s: any) => s.properties);
}

async function readValues(fileId: string, token: string, title: string, range: string): Promise<string[][]> {
  const res = await fetch(`${SHEETS}/${fileId}/values/${encodeURIComponent(`${title}!${range}`)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
  return ((await res.json()).values ?? []) as string[][];
}

// Sel isian yang dikosongkan setelah kerangka disalin (sama dengan yang ditulis form RPB).
const CLEAR_RANGES = ["C3:C7", "C11:E15", "C60:E62", "C19:E58"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!(await isManagement(req))) return json({ error: "Hanya untuk akun management." }, 403);
    const token = await getAccessToken();

    if (req.method === "GET") {
      const u = new URL(req.url);
      const fileId = u.searchParams.get("fileId");
      const action = u.searchParams.get("action");
      if (!fileId) return json({ error: "fileId wajib" }, 400);
      if (action === "titles") return json({ tabs: await listTabs(fileId, token) });
      if (action === "raw") {
        const sheetName = u.searchParams.get("sheetName");
        if (!sheetName) return json({ error: "sheetName wajib" }, 400);
        return json({ values: await readValues(fileId, token, sheetName, u.searchParams.get("range") ?? "A1:J70") });
      }
      return json({ error: "action tidak dikenal" }, 400);
    }

    if (req.method === "POST") {
      const { fileId, tabTarget, tabSumber, dryRun } = await req.json();
      if (!fileId || !tabTarget || !tabSumber) return json({ error: "fileId, tabTarget, tabSumber wajib" }, 400);
      const tabs = await listTabs(fileId, token);
      const src = tabs.find((t) => t.title === tabSumber);
      if (!src) return json({ error: `Tab sumber "${tabSumber}" tidak ada` }, 404);
      const tgt = tabs.find((t) => t.title === tabTarget);

      if (tgt) {
        const isi = await readValues(fileId, token, tabTarget, "A1:J200");
        const adaIsi = isi.some((r) => r.some((c) => (c ?? "").toString().trim() !== ""));
        if (adaIsi) return json({ error: `Tab "${tabTarget}" TIDAK kosong -- ditolak, tidak ada yang diubah.` }, 409);
      }
      const rencana = tgt
        ? `Salin kerangka "${tabSumber}" menggantikan tab kosong "${tabTarget}" (urutan tab dipertahankan), lalu kosongkan sel isian.`
        : `Buat tab baru "${tabTarget}" dari kerangka "${tabSumber}", lalu kosongkan sel isian.`;
      if (dryRun) return json({ dryRun: true, rencana });

      const newSheetId = Math.floor(100000000 + Math.random() * 800000000);
      const tmpName = `__baru_${Date.now()}`;
      const requests: any[] = [
        { duplicateSheet: { sourceSheetId: src.sheetId, newSheetId, newSheetName: tmpName, insertSheetIndex: tgt ? tgt.index : tabs.length } },
      ];
      if (tgt) requests.push({ deleteSheet: { sheetId: tgt.sheetId } });
      requests.push({ updateSheetProperties: { properties: { sheetId: newSheetId, title: tabTarget }, fields: "title" } });

      const b = await fetch(`${SHEETS}/${fileId}:batchUpdate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ requests }),
      });
      if (!b.ok) return json({ error: `Sheets API (batchUpdate) ${b.status}: ${await b.text()}` }, 502);

      const c = await fetch(`${SHEETS}/${fileId}/values:batchClear`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ranges: CLEAR_RANGES.map((r) => `${tabTarget}!${r}`) }),
      });
      if (!c.ok) return json({ error: `Kerangka tersalin tapi gagal mengosongkan isian: ${c.status} ${await c.text()}` }, 502);
      return json({ ok: true, rencana });
    }

    return json({ error: "Method tidak didukung" }, 405);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
