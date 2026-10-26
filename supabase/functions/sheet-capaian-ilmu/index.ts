// Baca & tulis Capaian Ilmu (deskriptif, per anak x per bidang, bulanan) ke Google Sheets.
// KA : baris = anak (A=No, B=Nama, bisa RENGGANG antar anak), kolom C..I = 7 bidang. Kolom kadang
//      di-MERGE (1 kalimat sekelas) -> read: nilai top-left disebar; write: unmerge dulu.
// Qonuni : kolom = anak (nama depan di header+1 mulai kolom C, bisa BOLONG antar anak), baris = bidang (A=grup, B=sub).
// Tab = bulan (nama kadang ada spasi -> match trim+lowercase).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
const SERVICE_ACCOUNT_JSON = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SCAN_RANGE = "A1:R60";
const KA_BIDANG = ["talaqqi", "baghdadiyah", "kisah", "calis", "berhitung", "doa_harian", "olahraga"];
const KA_LABEL: Record<string, string> = { talaqqi: "Talaqqi", baghdadiyah: "Baghdadiyah", kisah: "Kisah", calis: "Calis", berhitung: "Berhitung", doa_harian: "Doa Harian", olahraga: "Olahraga" };
const QO_BIDANG = ["ziyadah", "murojaah_ziyadah", "wirid", "ahsanul_akhlak", "urjuzah_shaghirah", "tauhid_wal_iman", "urjuzah_miiyyah", "ar_rusyd_al_qarib", "membaca", "menulis", "berhitung", "zikir_setelah_shalat", "zikir_pagi", "zikir_sore", "berenang", "jiujitsu", "keakhwatan"];
const QO_LABEL: Record<string, string> = { ziyadah: "Ziyadah", murojaah_ziyadah: "Muroja'ah Ziyadah", wirid: "Wirid", ahsanul_akhlak: "Ahsanul Akhlak", urjuzah_shaghirah: "Urjuzah Shaghirah", tauhid_wal_iman: "Tauhid wal Iman", urjuzah_miiyyah: "Urjuzah Mi'iyyah", ar_rusyd_al_qarib: "Ar Rusyd Al Qarib", membaca: "Membaca", menulis: "Menulis", berhitung: "Berhitung", zikir_setelah_shalat: "Zikir Setelah Shalat", zikir_pagi: "Zikir Pagi", zikir_sore: "Sore", berenang: "Berenang", jiujitsu: "JiuJitsu", keakhwatan: "Keakhwatan" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function colLetter(idx0: number): string {
  let n = idx0 + 1; let s = "";
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
function norm(s: string): string { return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

function base64url(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = ""; for (const b of arr) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function getAccessToken(): Promise<string> {
  if (!SERVICE_ACCOUNT_JSON) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON belum di-set di Supabase secrets — fitur simpan otomatis belum aktif.");
  const sa = JSON.parse(SERVICE_ACCOUNT_JSON);
  const now = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const unsigned = `${base64url(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })))}.${base64url(enc.encode(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/spreadsheets", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })))}`;
  const pem = sa.private_key.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s/g, "");
  const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(unsigned));
  const jwt = `${unsigned}.${base64url(signature)}`;
  const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }) });
  if (!res.ok) throw new Error(`Gagal ambil access token Google: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token as string;
}

type SheetMeta = { sheetId: number; title: string; merges: { sr: number; er: number; sc: number; ec: number }[] };
async function getMeta(fileId: string, token: string): Promise<SheetMeta[]> {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${fileId}?fields=sheets(properties(sheetId,title),merges)`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(`Sheets API error ${res.status}: ${JSON.stringify(data)}`);
  return (data.sheets ?? []).map((s: any) => ({ sheetId: s.properties.sheetId, title: s.properties.title, merges: (s.merges ?? []).map((m: any) => ({ sr: m.startRowIndex, er: m.endRowIndex, sc: m.startColumnIndex, ec: m.endColumnIndex })) }));
}
function resolveTab(metas: SheetMeta[], bulan: string): SheetMeta {
  const want = norm(bulan);
  const m = metas.find((x) => norm(x.title) === want);
  if (!m) throw new Error(`Bulan "${bulan}" belum ada tab-nya (tab: ${metas.map((x) => x.title.trim()).join(", ")})`);
  return m;
}
async function fetchRows(fileId: string, tabTitle: string, token: string): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/${encodeURIComponent(`${tabTitle}!${SCAN_RANGE}`)}?majorDimension=ROWS`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Sheets API error ${res.status}: ${await res.text()}`);
  return ((await res.json()).values ?? []) as string[][];
}

type Anak = { idx: number; nama: string; row0?: number; col0?: number };
type Layout = {
  level: "ka" | "qonuni"; namaGuru: string; kelas: string; bulan: string; headerRow: number;
  anak: Anak[]; values: Record<string, string[]>;
  ka?: { firstAnakRow0: number; rowStep: number; bidangCol: Record<string, number> };
  qo?: { firstAnakCol0: number; bidangRow0: Record<string, number> };
};

function parseLayout(rows: string[][], merges: SheetMeta["merges"] = []): Layout {
  const cell = (r: number, c: number) => (rows[r] && rows[r][c] != null ? String(rows[r][c]) : "");
  let namaGuru = "", kelas = "", bulan = "";
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const b = cell(r, 1); const c = cell(r, 2); const bl = b.toLowerCase();
    if (bl.startsWith("nama guru")) namaGuru = (b.replace(/nama guru\s*:?\s*/i, "").trim() || c).trim();
    else if (bl.startsWith("kelas")) kelas = (b.replace(/kelas\s*:?\s*/i, "").trim() || c).trim();
    else if (bl.startsWith("bulan")) bulan = (b.replace(/bulan\s*:?\s*/i, "").trim() || c).trim();
  }
  let headerRow = -1, anakInCol = -1;
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    for (let c = 0; c < 5; c++) { if (norm(cell(r, c)) === "nama anak") { headerRow = r; anakInCol = c; break; } }
    if (headerRow >= 0) break;
  }
  if (headerRow < 0) throw new Error("Nggak nemu baris header 'Nama Anak' di sheet");

  const level: "ka" | "qonuni" = anakInCol === 1 ? "ka" : "qonuni";
  const flat = (level === "ka" ? KA_BIDANG : QO_BIDANG).map((key) => ({ key, label: (level === "ka" ? KA_LABEL : QO_LABEL)[key] }));

  if (level === "ka") {
    const bidangCol: Record<string, number> = {};
    for (let j = 0; j < flat.length; j++) bidangCol[flat[j].key] = 2 + j;
    const firstAnakRow0 = headerRow + 2;
    const anak: Anak[] = [];
    const anakRows: number[] = [];
    let blanks = 0;
    for (let r = firstAnakRow0; r < rows.length && anak.length < 40; r++) {
      const nama = cell(r, 1).trim();
      if (/^format capaian/i.test(nama) || nama.toLowerCase().startsWith("notes")) break;
      if (!nama) { if (++blanks > 6) break; continue; }
      blanks = 0;
      anak.push({ idx: anak.length, nama, row0: r });
      anakRows.push(r);
    }
    const rowStep = anakRows.length >= 2 ? Math.max(1, anakRows[1] - anakRows[0]) : 1;
    const values: Record<string, string[]> = {};
    for (const b of flat) values[b.key] = anakRows.map((r) => cell(r, bidangCol[b.key]));
    for (let j = 0; j < flat.length; j++) {
      const col = 2 + j;
      for (const m of merges) {
        if (m.sc <= col && col < m.ec) {
          const v = cell(m.sr, col);
          anakRows.forEach((r, i) => { if (r >= m.sr && r < m.er && v) values[flat[j].key][i] = v; });
        }
      }
    }
    return { level, namaGuru, kelas, bulan, headerRow, anak, values, ka: { firstAnakRow0, rowStep, bidangCol } };
  }

  const nameRow = headerRow + 1;
  const firstAnakCol0 = 2;
  const anak: Anak[] = [];
  // Nama anak bisa BOLONG (mis. guru menyimpan santri ke-2 lebih dulu, kolom santri ke-1 masih kosong): kolom kosong
  // dilewati, bukan dianggap akhir daftar. Dulu berhenti di kolom kosong pertama -> isian santri sesudahnya tidak
  // terbaca (terlihat seperti "tidak tersimpan"). idx = urutan di daftar; col0 = kolom fisik di sheet.
  let kolomKosong = 0;
  for (let c = firstAnakCol0; c < 20; c++) {
    const nm = cell(nameRow, c).trim();
    if (!nm) { if (++kolomKosong > 3) break; continue; }
    kolomKosong = 0;
    anak.push({ idx: anak.length, nama: nm, col0: c });
  }
  const bidangRow0: Record<string, number> = {};
  const firstBidangRow0 = headerRow + 2;
  for (const b of flat) {
    const target = norm(b.label);
    for (let r = firstBidangRow0; r < Math.min(rows.length, firstBidangRow0 + 40); r++) {
      if (norm(cell(r, 1)) === target || (b.key === "keakhwatan" && norm(cell(r, 0)) === target)) { bidangRow0[b.key] = r; break; }
    }
  }
  const values: Record<string, string[]> = {};
  for (const b of flat) {
    values[b.key] = [];
    const br = bidangRow0[b.key];
    for (const a of anak) values[b.key].push(br == null ? "" : cell(br, a.col0!));
  }
  return { level, namaGuru, kelas, bulan, headerRow, anak, values, qo: { firstAnakCol0, bidangRow0 } };
}

async function readTab(fileId: string, bulan: string) {
  const token = await getAccessToken();
  const metas = await getMeta(fileId, token);
  const meta = resolveTab(metas, bulan);
  const rows = await fetchRows(fileId, meta.title, token);
  const L = parseLayout(rows, meta.merges);
  return { level: L.level, namaGuru: L.namaGuru, kelas: L.kelas, bulan: L.bulan || bulan, anak: L.anak, values: L.values };
}

async function writeCells(fileId: string, bulan: string, cells: { bidangKey: string; anakIdx: number; value: string }[], names: { anakIdx: number; nama: string }[]) {
  const token = await getAccessToken();
  const metas = await getMeta(fileId, token);
  const meta = resolveTab(metas, bulan);
  const rows = await fetchRows(fileId, meta.title, token);
  const L = parseLayout(rows, meta.merges);

  const anakRow0 = (i: number): number => {
    if (L.anak[i]?.row0 != null) return L.anak[i].row0!;
    const last = L.anak[L.anak.length - 1];
    const base = last?.row0 ?? L.ka!.firstAnakRow0 - L.ka!.rowStep;
    return base + L.ka!.rowStep * (i - (L.anak.length - 1));
  };
  const anakCol0 = (i: number): number => {
    if (L.anak[i]?.col0 != null) return L.anak[i].col0!;
    const last = L.anak[L.anak.length - 1];
    return (last?.col0 ?? L.qo!.firstAnakCol0 - 1) + (i - (L.anak.length - 1));
  };

  type Cel = { row0: number; col0: number; value: string };
  const targets: Cel[] = [];
  for (const c of cells) {
    if (L.level === "ka") { const col0 = L.ka!.bidangCol[c.bidangKey]; if (col0 == null) continue; targets.push({ row0: anakRow0(c.anakIdx), col0, value: c.value }); }
    else { const row0 = L.qo!.bidangRow0[c.bidangKey]; if (row0 == null) continue; targets.push({ row0, col0: anakCol0(c.anakIdx), value: c.value }); }
  }
  for (const n of names) {
    if (L.level === "ka") targets.push({ row0: anakRow0(n.anakIdx), col0: 1, value: n.nama });
    else targets.push({ row0: L.headerRow + 1, col0: anakCol0(n.anakIdx), value: n.nama });
  }
  if (targets.length === 0) return;

  const toUnmerge = meta.merges.filter((m) => targets.some((t) => t.row0 >= m.sr && t.row0 < m.er && t.col0 >= m.sc && t.col0 < m.ec) && !(m.er - m.sr === 1 && m.ec - m.sc === 1));
  if (toUnmerge.length > 0) {
    const reqs = toUnmerge.map((m) => ({ unmergeCells: { range: { sheetId: meta.sheetId, startRowIndex: m.sr, endRowIndex: m.er, startColumnIndex: m.sc, endColumnIndex: m.ec } } }));
    const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${fileId}:batchUpdate`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ requests: reqs }) });
    if (!r.ok) throw new Error(`Gagal unmerge: ${r.status} ${await r.text()}`);
  }

  const data = targets.map((t) => ({ range: `${meta.title}!${colLetter(t.col0)}${t.row0 + 1}`, values: [[t.value]] }));
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values:batchUpdate`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ valueInputOption: "USER_ENTERED", data }) });
  if (!res.ok) throw new Error(`Sheets API error ${res.status}: ${await res.text()}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!GOOGLE_API_KEY) return json({ error: "GOOGLE_API_KEY belum di-set di Supabase secrets" }, 500);
  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const fileId = url.searchParams.get("fileId");
      const bulan = url.searchParams.get("bulan");
      if (!fileId || !bulan) return json({ error: "fileId, bulan wajib diisi" }, 400);
      return json({ result: await readTab(fileId, bulan) });
    }
    if (req.method === "POST") {
      const body = await req.json();
      const { fileId, bulan, cells, names } = body;
      if (!fileId || !bulan || !Array.isArray(cells)) return json({ error: "fileId, bulan, cells wajib" }, 400);
      await writeCells(fileId, bulan, cells, Array.isArray(names) ? names : []);
      return json({ ok: true });
    }
    return json({ error: "Method tidak didukung" }, 405);
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
