// Absen guru lewat NOTIFIKASI (pusat). Satu fungsi, tiga aksi:
//   ?aksi=kirim  (dipanggil pg_cron, header x-cron-secret)  -> kirim notifikasi "Isi absen sekarang" ke guru yang belum absen
//                                                              (sesi pagi/siang: jam datang/pulang; sesi olahraga: Hadir hari itu, Senin-Rabu)
//   ?aksi=uji    (header x-cron-secret)                     -> kirim notifikasi uji ke SATU akun; tombolnya tidak mengubah data
//   aksi=isi     (POST {token}, tanpa login)                -> dipanggil service worker saat guru menekan tombol di notifikasi
//
// Keamanan tombol: token HMAC (ditandatangani dengan kunci turunan service role) berisi guru, sesi, jenis, tanggal, kedaluwarsa.
// Token hanya ada di dalam notifikasi yang dikirim ke perangkat guru itu sendiri, berlaku sampai batas jam sesi tersebut,
// dan tidak pernah menimpa isian yang sudah ada (jam yang sudah tercatat tidak diubah; izin/sakit/cuti tidak ditimpa).
// Jam yang dicatat = jam server (WIB) saat tombol ditekan -- tidak bisa diisi mundur/maju.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
// Kunci VAPID hanya dipasang saat benar-benar mengirim (aksi isi/uji-token tetap jalan walau kunci belum ada).
let vapidSiap = false;
function siapkanVapid() {
  if (vapidSiap) return;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) throw new Error("VAPID keys belum di-set");
  webpush.setVapidDetails("mailto:kurikulum.kba@gmail.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  vapidSiap = true;
}
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

type Sesi = "pagi" | "siang" | "olahraga";
type Jenis = "datang" | "pulang" | "hadir";
/** Pasangan sesi-jenis yang sah. Olahraga hanya mencatat Hadir per hari (tanpa jam datang/pulang). */
const SAH: Record<Sesi, Jenis[]> = { pagi: ["datang", "pulang"], siang: ["datang", "pulang"], olahraga: ["hadir"] };
const sah = (s: unknown, j: unknown) => typeof s === "string" && typeof j === "string" && (SAH as Record<string, string[]>)[s]?.includes(j) === true;
type Isi = { u: string; s: Sesi; j: Jenis; t: string; x: number; d?: 1 };

/* ───────── token ───────── */
const enc = new TextEncoder();
const dec = new TextDecoder();
function b64u(buf: ArrayBuffer | Uint8Array) {
  const a = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of a) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64u(s: string) {
  const p = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(p), (c) => c.charCodeAt(0));
}
async function kunci() {
  const h = await crypto.subtle.digest("SHA-256", enc.encode("absen-notif:" + SERVICE_ROLE_KEY));
  return crypto.subtle.importKey("raw", h, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function buatToken(p: Isi) {
  const body = b64u(enc.encode(JSON.stringify(p)));
  const sig = await crypto.subtle.sign("HMAC", await kunci(), enc.encode(body));
  return `${body}.${b64u(sig)}`;
}
async function bacaToken(tok: unknown): Promise<Isi | null> {
  if (typeof tok !== "string" || tok.length > 2000) return null;
  const [body, sig] = tok.split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await kunci(), unb64u(sig), enc.encode(body));
    return ok ? (JSON.parse(dec.decode(unb64u(body))) as Isi) : null;
  } catch {
    return null;
  }
}

/* ───────── waktu (WIB) ───────── */
const pad = (n: number) => String(n).padStart(2, "0");
const wib = (d = new Date()) => new Date(d.getTime() + 7 * 3600 * 1000);
const ymdW = (w: Date) => `${w.getUTCFullYear()}-${pad(w.getUTCMonth() + 1)}-${pad(w.getUTCDate())}`;
const hmW = (w: Date) => `${pad(w.getUTCHours())}:${pad(w.getUTCMinutes())}`;
/** Batas akhir tombol berlaku (jam WIB) menurut sesi dan jenis. */
const BATAS: Record<Sesi, Partial<Record<Jenis, number>>> = { pagi: { datang: 9, pulang: 13 }, siang: { datang: 16, pulang: 19 }, olahraga: { hadir: 19 } };
const expEpoch = (w: Date, s: Sesi, j: Jenis) => Math.floor(Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate(), (BATAS[s][j] ?? 19) - 7, 0, 0) / 1000);

const LABEL: Record<Sesi, Partial<Record<Jenis, { judul: string; isi: (nama: string) => string }>>> = {
  olahraga: {
    hadir: { judul: "Absen olahraga", isi: (n) => `Assalamu'alaikum, ${n}. Hari ini ada olahraga. Catat kehadiranmu sekarang.` },
  },
  pagi: {
    datang: { judul: "Absen datang · kelas pagi", isi: (n) => `Assalamu'alaikum, ${n}. Sudah sampai di kuttab? Catat jam datang sekarang.` },
    pulang: { judul: "Absen pulang · kelas pagi", isi: () => "Kelas pagi sudah selesai? Catat jam pulang sekarang." },
  },
  siang: {
    datang: { judul: "Absen datang · kelas siang", isi: () => "Waktunya kelas siang. Catat jam datang sekarang." },
    pulang: { judul: "Absen pulang · kelas siang", isi: () => "Kelas siang sudah selesai? Catat jam pulang sekarang." },
  },
};
const namaAbsen = (s: Sesi, j: Jenis) => (s === "olahraga" ? "absen olahraga" : `absen ${j} kelas ${s}`);

/* ───────── aksi: isi (dari tombol notifikasi) ───────── */
async function isi(req: Request) {
  const { token } = await req.json().catch(() => ({}));
  const p = await bacaToken(token);
  if (!p || !sah(p.s, p.j)) return json({ ok: false, pesan: "Tautan absen tidak sah. Isi lewat aplikasi." }, 400);

  const w = wib();
  if (Date.now() / 1000 > p.x || ymdW(w) !== p.t) return json({ ok: false, kadaluarsa: true, pesan: "Waktu absen lewat. Isi lewat aplikasi." }, 410);
  const jam = hmW(w);
  if (p.d) return json({ ok: true, uji: true, jam, pesan: `Uji berhasil: ${namaAbsen(p.s, p.j)} akan tercatat pukul ${jam}. Tidak ada data yang diubah.` });

  if (p.s === "olahraga") {
    const { data: po } = await admin.from("profiles").select("kelompok, role").eq("id", p.u).maybeSingle();
    if (!po || po.role !== "olahraga" || !po.kelompok) return json({ ok: false, pesan: "Akun tidak dikenali." }, 403);
    const { data: adaO } = await admin.from("absen_olahraga").select("status").eq("user_id", p.u).eq("tanggal", p.t).maybeSingle();
    if (adaO) return json({ ok: true, sudah: true, pesan: `Absen olahraga hari ini sudah tercatat (${adaO.status}). Tidak diubah.` });
    const { error: eo } = await admin.from("absen_olahraga").upsert(
      { user_id: p.u, kelompok: po.kelompok, tanggal: p.t, status: "hadir", keterangan: "", updated_at: new Date().toISOString() },
      { onConflict: "user_id,tanggal" }
    );
    const { data: cekO } = eo ? { data: null } : await admin.from("absen_olahraga").select("status").eq("user_id", p.u).eq("tanggal", p.t).maybeSingle();
    if (eo || !cekO) return json({ ok: false, pesan: "Belum tercatat. Isi lewat aplikasi." }, 500);
    return json({ ok: true, jam, pesan: `Absen olahraga tercatat (hadir) pukul ${jam}.` });
  }

  const statusF = `status_${p.s}`;
  const jamF = `jam_${p.j}_${p.s}`;
  const { data: ada } = await admin.from("absen_guru").select("*").eq("user_id", p.u).eq("tanggal", p.t).maybeSingle();
  if (ada) {
    if (ada[statusF] !== "hadir") return json({ ok: true, sudah: true, pesan: `Kelas ${p.s} sudah diisi (${ada[statusF]}). Tidak diubah.` });
    if (ada[jamF]) return json({ ok: true, sudah: true, jam: String(ada[jamF]).slice(0, 5), pesan: `Sudah tercatat pukul ${String(ada[jamF]).slice(0, 5)}.` });
  }
  const { data: prof } = await admin.from("profiles").select("kelas, role").eq("id", p.u).maybeSingle();
  if (!prof || prof.role !== "guru") return json({ ok: false, pesan: "Akun tidak dikenali." }, 403);

  const { error } = await admin.from("absen_guru").upsert(
    { user_id: p.u, kelas: prof.kelas, tanggal: p.t, [statusF]: "hadir", [jamF]: jam, updated_at: new Date().toISOString() },
    { onConflict: "user_id,tanggal" }
  );
  if (error) return json({ ok: false, pesan: "Belum tercatat. Isi lewat aplikasi." }, 500);

  const { data: cek } = await admin.from("absen_guru").select(`${statusF}, ${jamF}`).eq("user_id", p.u).eq("tanggal", p.t).maybeSingle();
  if (!cek || !(cek as Record<string, unknown>)[jamF]) return json({ ok: false, pesan: "Belum tercatat. Isi lewat aplikasi." }, 500);
  return json({ ok: true, jam, pesan: `${namaAbsen(p.s, p.j)} tercatat pukul ${jam}.` });
}

/* ───────── pengiriman ───────── */
async function kirimKe(subs: any[], payload: object): Promise<number> {
  siapkanVapid();
  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 3600 });
      sent++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) await admin.from("push_subscriptions").delete().eq("id", sub.id);
    }
  }
  return sent;
}

async function buatPayload(userId: string, nama: string, s: Sesi, j: Jenis, w: Date, uji: boolean) {
  const token = await buatToken({ u: userId, s, j, t: ymdW(w), x: uji ? Math.floor(Date.now() / 1000) + 1800 : expEpoch(w, s, j), ...(uji ? { d: 1 as const } : {}) });
  const l = LABEL[s][j]!;
  const olahraga = s === "olahraga";
  return {
    title: uji ? `UJI · ${l.judul}` : l.judul,
    body: l.isi(nama),
    tag: `absen-${s}-${j}`,
    requireInteraction: true,
    url: olahraga ? "/olahraga/absen" : `/absen-cepat?s=${s}&j=${j}`,
    urlBuka: olahraga ? "/olahraga/absen" : "/absen",
    aksi: { token, api: `${SUPABASE_URL}/functions/v1/absen-notif` },
    actions: [
      { action: "isi", title: "Isi absen sekarang" },
      { action: "buka", title: "Buka aplikasi" },
    ],
  };
}

function cekParam(url: URL) {
  const s = url.searchParams.get("sesi") as Sesi;
  const j = url.searchParams.get("jenis") as Jenis;
  if (!sah(s, j)) return null;
  return { s, j };
}

async function kirim(url: URL) {
  const pj = cekParam(url);
  if (!pj) return json({ error: "sesi/jenis tidak valid" }, 400);
  const { s, j } = pj;
  const dry = url.searchParams.get("dry") === "1";
  const filter = url.searchParams.get("filter") ?? "semua"; // semua | ka1ab | lain (kelas dengan jam pulang pagi berbeda)
  const tglUji = url.searchParams.get("tanggal");
  const w = tglUji && /^\d{4}-\d{2}-\d{2}$/.test(tglUji) ? new Date(`${tglUji}T05:00:00Z`) : wib();
  const dow = w.getUTCDay();
  if (dow === 0 || dow === 6) return json({ skipped: "weekend" });
  if (s === "olahraga" && dow > 3) return json({ skipped: "bukan hari olahraga (hanya Senin-Rabu)" });
  const today = ymdW(w);

  const { data: libur } = await admin.from("kalender_akademik").select("judul").eq("jenis", "libur").lte("tanggal_mulai", today).gte("tanggal_selesai", today).limit(1);
  if (libur && libur.length) return json({ skipped: "libur", judul: libur[0].judul });

  const { data: guru } = await admin.from("profiles").select("id, full_name, kelas").eq("role", s === "olahraga" ? "olahraga" : "guru");
  const ka1ab = (k: string | null) => k === "Kuttab Awwal 1A" || k === "Kuttab Awwal 1B";
  const dipilih = (guru ?? []).filter((g: any) => (filter === "ka1ab" ? ka1ab(g.kelas) : filter === "lain" ? !ka1ab(g.kelas) : true));

  const { data: baris } = await admin.from(s === "olahraga" ? "absen_olahraga" : "absen_guru").select("*").eq("tanggal", today);
  const byUser = new Map<string, any>((baris ?? []).map((r: any) => [r.user_id, r]));
  const { data: subs } = await admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth");
  const subsBy = new Map<string, any[]>();
  for (const x of subs ?? []) (subsBy.get(x.user_id) ?? subsBy.set(x.user_id, []).get(x.user_id)!).push(x);

  const hasil: any[] = [];
  for (const g of dipilih) {
    const r = byUser.get(g.id);
    const perlu = s === "olahraga" ? !r : !r ? true : r[`status_${s}`] === "hadir" && !r[`jam_${j}_${s}`];
    if (!perlu) continue;
    const mine = subsBy.get(g.id) ?? [];
    if (!mine.length) { hasil.push({ guru: g.full_name, sent: 0, alasan: "belum berlangganan notifikasi" }); continue; }
    const payload = await buatPayload(g.id, g.full_name ?? "Ustadz/ah", s, j, w, false);
    const sent = dry ? 0 : await kirimKe(mine, payload);
    hasil.push({ guru: g.full_name, sent, ...(dry ? { dry: true } : {}) });
  }
  return json({ today, sesi: s, jenis: j, filter, dry, hasil });
}

async function uji(url: URL) {
  const pj = cekParam(url);
  const userId = url.searchParams.get("user");
  if (!pj || !userId) return json({ error: "sesi, jenis, user wajib" }, 400);
  const { data: prof } = await admin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  const { data: subs } = await admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").eq("user_id", userId);
  if (!subs || !subs.length) return json({ error: "akun ini belum mengaktifkan notifikasi" }, 404);
  const payload = await buatPayload(userId, prof?.full_name ?? "Ustadz/ah", pj.s, pj.j, wib(), true);
  return json({ sent: await kirimKe(subs, payload), perangkat: subs.length });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = new URL(req.url);
    const aksi = url.searchParams.get("aksi") ?? "isi";
    if (aksi === "isi") return await isi(req);
    if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) return json({ error: "unauthorized" }, 401);
    if (aksi === "kirim") return await kirim(url);
    if (aksi === "uji") return await uji(url);
    if (aksi === "token") {
      // Hanya untuk pengujian: token "uji" (d=1, tidak pernah menulis data). ?kedaluwarsa=1 membuat token yang sudah lewat.
      const pj = cekParam(url);
      const u = url.searchParams.get("user");
      if (!pj || !u) return json({ error: "sesi, jenis, user wajib" }, 400);
      const x = Math.floor(Date.now() / 1000) + (url.searchParams.get("kedaluwarsa") === "1" ? -10 : 300);
      return json({ token: await buatToken({ u, s: pj.s, j: pj.j, t: ymdW(wib()), x, d: 1 }) });
    }
    return json({ error: "aksi tidak dikenal" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
