// Baca & tulis Capaian Al-Qur'an (grid angka per pertemuan/pekan) langsung ke Google Sheets.
// Dinamis: tiap request SCAN isi tab (cari penanda "Format Capaian <X>", deteksi tipe section
// pertemuan-25 / pekan-4, petakan murid ke baris). Slot ke-N di kolom (C + N-1). Kolom Count &
// Total = rumus otomatis, jangan disentuh. Kolom Nama (B) = roster (SANTRI_LIST) sbg sumber
// kebenaran (guru nggak ngetik nama; baris dipetakan by posisi).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
const SERVICE_ACCOUNT_JSON = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SCAN_RANGE = "A1:AI220";

/** Google Sheet berbahasa Indonesia: "1,5" = angka, tetapi "1.5" dan "1/2" bisa dibaca sebagai TANGGAL (USER_ENTERED).
 *  Penjaga terakhir untuk semua penulis: titik -> koma, pecahan setengah/seperempat -> desimal koma, dan isian lain yang
 *  mirip tanggal (mis. "1-5") dipaksa jadi teks dengan tanda petik awal (tanda itu tidak ikut terbaca kembali). */
function amanTanggal(v: unknown): string {
  const asli = String(v ?? "");
  const t = asli.trim();
  if (!t) return asli;
  const pecahan = (b: number, a: number) => (b === 2 || b === 4) && a > 0 && a < b;
  let m = t.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (m && pecahan(Number(m[3]), Number(m[2]))) return String(Number(m[1]) + Number(m[2]) / Number(m[3])).replace(".", ",");
  m = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (m && pecahan(Number(m[2]), Number(m[1]))) return String(Number(m[1]) / Number(m[2])).replace(".", ",");
  if (/^\d+\.\d+$/.test(t)) return t.replace(".", ",");
  if (/^\d{1,4}\s*[\/.\-]\s*\d{1,4}(\s*[\/.\-]\s*\d{1,4})?$/.test(t)) return "'" + t;
  return asli;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function colLetter(idx0: number): string {
  let n = idx0 + 1;
  let s = "";
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function norm(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

type Section = {
  name: string;
  type: "pertemuan" | "pekan";
  slotCount: number;
  markerRow: number;
  headerRow: number;
  firstDataRow: number;
  notesRow: number;
  students: { row: number; nama: string; values: string[] }[];
};

function parseSections(rows: string[][]): Section[] {
  const cell = (r: number, c: number) => (rows[r] && rows[r][c] != null ? String(rows[r][c]) : "");
  const sections: Section[] = [];

  for (let i = 0; i < rows.length; i++) {
    const b = cell(i, 1).trim();
    const m = b.match(/^Format Capaian\s+(.+?)\s*$/i);
    if (!m) continue;
    const name = m[1].replace(/\s+/g, " ").trim();

    let h = -1;
    for (let j = i + 1; j < Math.min(i + 13, rows.length); j++) {
      if (cell(j, 0).trim().toLowerCase() === "no") { h = j; break; }
    }
    if (h < 0) continue;

    const slotRow = rows[h + 1] || [];
    let slotCount = 0;
    for (let k = 2; k < slotRow.length; k++) {
      const v = String(slotRow[k] ?? "").trim();
      if (/^\d+$/.test(v) && Number(v) === slotCount + 1) slotCount++;
      else break;
    }
    if (slotCount === 0) continue;
    const type: "pertemuan" | "pekan" = slotCount >= 10 ? "pertemuan" : "pekan";

    const firstDataRow0 = h + 2;
    let notes0 = -1;
    for (let r = firstDataRow0; r < rows.length; r++) {
      const a = cell(r, 0).trim().toLowerCase();
      const bb = cell(r, 1).trim();
      if (a.startsWith("notes") || bb.toLowerCase().startsWith("notes")) { notes0 = r; break; }
      if (/^Format Capaian\s+/i.test(bb)) { notes0 = r; break; }
    }
    if (notes0 < 0) notes0 = Math.min(firstDataRow0 + 30, rows.length);

    const students: Section["students"] = [];
    for (let r = firstDataRow0; r < notes0; r++) {
      const nama = cell(r, 1).trim();
      const values: string[] = [];
      for (let s = 0; s < slotCount; s++) values.push(cell(r, 2 + s));
      students.push({ row: r + 1, nama, values });
    }

    sections.push({ name, type, slotCount, markerRow: i + 1, headerRow: h + 1, firstDataRow: firstDataRow0 + 1, notesRow: notes0 + 1, students });
  }
  return sections;
}

async function fetchRows(fileId: string, tab: string, token: string | null): Promise<string[][]> {
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/` +
    `${encodeURIComponent(`${tab}!${SCAN_RANGE}`)}?majorDimension=ROWS` +
    (token ? "" : `&key=${GOOGLE_API_KEY}`);
  const res = await fetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
  if (!res.ok) { const body = await res.text(); throw new Error(`Sheets API error ${res.status}: ${body}`); }
  const data = await res.json();
  return (data.values ?? []) as string[][];
}

function base64url(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = "";
  for (const b of arr) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken(): Promise<string> {
  if (!SERVICE_ACCOUNT_JSON) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON belum di-set di Supabase secrets — fitur simpan otomatis belum aktif.");
  }
  const sa = JSON.parse(SERVICE_ACCOUNT_JSON);
  const now = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const unsigned = `${base64url(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })))}.${base64url(enc.encode(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/spreadsheets", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })))}`;
  const pem = sa.private_key.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s/g, "");
  const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(unsigned));
  const jwt = `${unsigned}.${base64url(signature)}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!res.ok) { const body = await res.text(); throw new Error(`Gagal ambil access token Google: ${res.status} ${body}`); }
  const data = await res.json();
  return data.access_token as string;
}

async function getTabSheetId(fileId: string, tab: string, token: string): Promise<number> {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${fileId}?fields=sheets.properties(sheetId,title)`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(`Sheets API error ${res.status}: ${JSON.stringify(data)}`);
  const s = (data.sheets ?? []).find((x: { properties: { title: string } }) => x.properties.title === tab);
  if (!s) throw new Error(`Tab "${tab}" nggak ketemu`);
  return s.properties.sheetId as number;
}

async function readTab(fileId: string, tab: string) {
  let rows: string[][];
  try { rows = await fetchRows(fileId, tab, null); }
  catch (_e) { const token = await getAccessToken(); rows = await fetchRows(fileId, tab, token); }
  const cell = (r: number, c: number) => (rows[r] && rows[r][c] != null ? String(rows[r][c]) : "");
  const sections = parseSections(rows);
  return {
    namaGuru: cell(2, 1).replace(/^Nama Guru\s*:?\s*/i, "").trim(),
    kelas: cell(3, 1).replace(/^Kelas\s*:?\s*/i, "").trim(),
    level: cell(4, 1).replace(/^Level\s*:?\s*/i, "").trim(),
    bulan: cell(5, 1).replace(/^Bulan\s*:?\s*/i, "").trim(),
    sections: sections.map((s) => ({ name: s.name, type: s.type, slotCount: s.slotCount, firstDataRow: s.firstDataRow, notesRow: s.notesRow, students: s.students })),
  };
}

async function writeSlot(fileId: string, tab: string, sectionName: string, slotIndex: number, roster: string[], values: string[]) {
  const token = await getAccessToken();
  const rows = await fetchRows(fileId, tab, token);
  const sections = parseSections(rows);
  const sec = sections.find((s) => norm(s.name) === norm(sectionName));
  if (!sec) throw new Error(`Section "${sectionName}" nggak ketemu di tab ${tab}`);
  if (slotIndex < 1 || slotIndex > sec.slotCount) throw new Error(`Slot ${slotIndex} di luar jangkauan (1-${sec.slotCount})`);

  const need = roster.length;
  const available = sec.notesRow - sec.firstDataRow;
  if (need > available) {
    const sheetId = await getTabSheetId(fileId, tab, token);
    const insertAt = sec.notesRow - 1;
    const addCount = need - available;
    const lastDataRow0 = insertAt - 1;
    const requests: unknown[] = [
      { insertDimension: { range: { sheetId, dimension: "ROWS", startIndex: insertAt, endIndex: insertAt + addCount }, inheritFromBefore: true } },
    ];
    if (lastDataRow0 >= 0) {
      requests.push({
        copyPaste: {
          source: { sheetId, startRowIndex: lastDataRow0, endRowIndex: lastDataRow0 + 1, startColumnIndex: 27, endColumnIndex: 33 },
          destination: { sheetId, startRowIndex: insertAt, endRowIndex: insertAt + addCount, startColumnIndex: 27, endColumnIndex: 33 },
          pasteType: "PASTE_NORMAL",
        },
      });
    }
    const insRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${fileId}:batchUpdate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ requests }),
    });
    if (!insRes.ok) { const body = await insRes.text(); throw new Error(`Gagal nambah baris: ${insRes.status} ${body}`); }
  }

  const slotCol = colLetter(2 + (slotIndex - 1));
  const startRow = sec.firstDataRow;
  const endRow = startRow + need - 1;
  const bValues = roster.map((n) => [n]);
  const data = [
    { range: `${tab}!B${startRow}:B${endRow}`, values: bValues },
    { range: `${tab}!${slotCol}${startRow}:${slotCol}${endRow}`, values: values.map((v) => [amanTanggal(v)]) },
  ];
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ valueInputOption: "USER_ENTERED", data }),
  });
  if (!res.ok) { const body = await res.text(); throw new Error(`Sheets API error ${res.status}: ${body}`); }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!GOOGLE_API_KEY) return json({ error: "GOOGLE_API_KEY belum di-set di Supabase secrets" }, 500);

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const fileId = url.searchParams.get("fileId");
      const tab = url.searchParams.get("tab");
      if (!fileId || !tab) return json({ error: "fileId dan tab wajib diisi" }, 400);
      return json({ result: await readTab(fileId, tab) });
    }
    if (req.method === "POST") {
      const body = await req.json();
      const { fileId, tab, sectionName, slotIndex, roster, values } = body;
      if (!fileId || !tab || !sectionName || !slotIndex || !Array.isArray(roster) || !Array.isArray(values)) {
        return json({ error: "fileId, tab, sectionName, slotIndex, roster, values wajib" }, 400);
      }
      if (roster.length !== values.length) return json({ error: "roster & values panjangnya harus sama" }, 400);
      await writeSlot(fileId, tab, sectionName, Number(slotIndex), roster, values);
      return json({ ok: true });
    }
    return json({ error: "Method tidak didukung" }, 405);
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
