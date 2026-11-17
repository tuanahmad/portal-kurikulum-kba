// Masuk dengan SIDIK JARI / kunci layar HP (WebAuthn "passkey"), seperti m-banking: pengguna tetap bisa masuk dengan username + PIN;
// sidik jari hanya pilihan tambahan yang diaktifkan SESUDAH login biasa.
//   daftar-opsi        (POST, login)     -> tantangan untuk mendaftarkan kunci perangkat ini ke akun yang sedang login
//   daftar-verifikasi  (POST, login)     -> memeriksa jawaban perangkat lalu menyimpan kunci PUBLIK (tidak ada rahasia yang disimpan)
//   masuk-opsi         (POST, tanpa login) -> tantangan masuk (tanpa mengetik username: HP yang memilih kunci miliknya)
//   masuk-verifikasi   (POST, tanpa login) -> memeriksa tanda tangan sidik jari; jika sah, mengeluarkan token sekali pakai untuk membuka sesi
// Keamanan: tantangan acak sekali pakai (3 menit, disimpan di tabel passkey_tantangan lalu dihapus saat dipakai); asal situs (Origin) harus salah
// satu domain aplikasi; verifikasi memaksa pemeriksaan identitas pengguna (sidik jari/kunci layar). Kunci privat tidak pernah meninggalkan HP.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "npm:@simplewebauthn/server@10.0.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const ORIGIN_SAH = ["https://portal-guru-kba.vercel.app", "https://portal-kurikulum-kba.vercel.app", "http://localhost:5173"];
const RP_NAME = "Portal Guru Kuttab Budi Ashari";
const PERAN_BOLEH = ["management", "guru", "olahraga"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const galat = (pesan: string, s = 400) => json({ ok: false, pesan }, s);

const enc = new TextEncoder();
const dec = new TextDecoder();
function ke64u(buf: Uint8Array) {
  let s = "";
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function dari64u(s: string) {
  const p = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(p), (c) => c.charCodeAt(0));
}

function asal(req: Request): { origin: string; rpID: string } | null {
  const o = req.headers.get("origin") ?? "";
  return ORIGIN_SAH.includes(o) ? { origin: o, rpID: new URL(o).hostname } : null;
}

async function penggunaLogin(req: Request): Promise<string | null> {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return null;
  const { data, error } = await admin.auth.getUser(jwt);
  return error || !data?.user ? null : data.user.id;
}

async function simpanTantangan(tantangan: string, userId: string | null, tipe: "daftar" | "masuk") {
  await admin.from("passkey_tantangan").delete().lt("kedaluwarsa", new Date().toISOString());
  const { count } = await admin.from("passkey_tantangan").select("id", { count: "exact", head: true });
  if ((count ?? 0) > 400) throw new Error("terlalu banyak permintaan");
  const { error } = await admin.from("passkey_tantangan").insert({ tantangan, user_id: userId, tipe, kedaluwarsa: new Date(Date.now() + 3 * 60 * 1000).toISOString() });
  if (error) throw new Error(error.message);
}

/** Ambil dan HAPUS tantangan (sekali pakai). Mengembalikan baris kalau masih berlaku dan cocok tipe/pengguna. */
async function pakaiTantangan(tantangan: string, tipe: "daftar" | "masuk", userId: string | null) {
  const { data } = await admin.from("passkey_tantangan").delete().eq("tantangan", tantangan).eq("tipe", tipe).select("user_id, kedaluwarsa").maybeSingle();
  if (!data || new Date(data.kedaluwarsa).getTime() < Date.now()) return false;
  return tipe === "daftar" ? data.user_id === userId : true;
}

function tantanganDari(resp: any): string | null {
  try {
    return JSON.parse(dec.decode(dari64u(resp.response.clientDataJSON))).challenge ?? null;
  } catch {
    return null;
  }
}

async function daftarOpsi(req: Request) {
  const a = asal(req);
  if (!a) return galat("Asal situs tidak dikenal.", 403);
  const userId = await penggunaLogin(req);
  if (!userId) return galat("Harus login dulu.", 401);
  const { data: u } = await admin.auth.admin.getUserById(userId);
  const { data: prof } = await admin.from("profiles").select("full_name, role").eq("id", userId).maybeSingle();
  if (!u?.user || !prof || !PERAN_BOLEH.includes(prof.role)) return galat("Akun tidak dikenali.", 403);
  const { data: ada } = await admin.from("passkeys").select("credential_id, transports").eq("user_id", userId);
  const opsi = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: a.rpID,
    userName: (u.user.email ?? userId).split("@")[0],
    userDisplayName: prof.full_name ?? undefined,
    userID: enc.encode(userId),
    attestationType: "none",
    excludeCredentials: (ada ?? []).map((c: any) => ({ id: c.credential_id, transports: c.transports ?? undefined })),
    authenticatorSelection: { residentKey: "required", userVerification: "required", authenticatorAttachment: "platform" },
  });
  await simpanTantangan(opsi.challenge, userId, "daftar");
  return json(opsi);
}

async function daftarVerifikasi(req: Request) {
  const a = asal(req);
  if (!a) return galat("Asal situs tidak dikenal.", 403);
  const userId = await penggunaLogin(req);
  if (!userId) return galat("Harus login dulu.", 401);
  const { response, namaPerangkat } = await req.json().catch(() => ({}));
  const tant = tantanganDari(response);
  if (!tant || !(await pakaiTantangan(tant, "daftar", userId))) return galat("Tantangan tidak berlaku atau sudah dipakai. Coba lagi.");
  const v = await verifyRegistrationResponse({ response, expectedChallenge: tant, expectedOrigin: a.origin, expectedRPID: a.rpID, requireUserVerification: true });
  if (!v.verified || !v.registrationInfo) return galat("Sidik jari tidak dapat diverifikasi.");
  const { credentialID, credentialPublicKey, counter } = v.registrationInfo;
  const { error } = await admin.from("passkeys").insert({
    user_id: userId,
    credential_id: ke64u(credentialID),
    public_key: ke64u(credentialPublicKey),
    counter,
    transports: response?.response?.transports ?? null,
    nama_perangkat: typeof namaPerangkat === "string" ? namaPerangkat.slice(0, 80) : null,
    rp_id: a.rpID,
  });
  if (error) return galat("Gagal menyimpan: " + error.message, 500);
  return json({ ok: true, credentialId: ke64u(credentialID) });
}

async function masukOpsi(req: Request) {
  const a = asal(req);
  if (!a) return galat("Asal situs tidak dikenal.", 403);
  const opsi = await generateAuthenticationOptions({ rpID: a.rpID, userVerification: "required", allowCredentials: [] });
  await simpanTantangan(opsi.challenge, null, "masuk");
  return json(opsi);
}

async function masukVerifikasi(req: Request) {
  const a = asal(req);
  if (!a) return galat("Asal situs tidak dikenal.", 403);
  const { response } = await req.json().catch(() => ({}));
  const tant = tantanganDari(response);
  if (!tant || typeof response?.id !== "string" || !(await pakaiTantangan(tant, "masuk", null))) return galat("Tantangan tidak berlaku atau sudah dipakai. Coba lagi.");
  const { data: kunci } = await admin.from("passkeys").select("*").eq("credential_id", response.id).eq("rp_id", a.rpID).maybeSingle();
  if (!kunci) return galat("Sidik jari ini belum terdaftar. Masuk dengan username dan PIN, lalu aktifkan dari menu profil.", 404);
  let v;
  try {
    v = await verifyAuthenticationResponse({
      response,
      expectedChallenge: tant,
      expectedOrigin: a.origin,
      expectedRPID: a.rpID,
      authenticator: { credentialID: dari64u(kunci.credential_id), credentialPublicKey: dari64u(kunci.public_key), counter: Number(kunci.counter), transports: kunci.transports ?? undefined },
      requireUserVerification: true,
    });
  } catch (e) {
    return galat("Verifikasi gagal: " + (e instanceof Error ? e.message : String(e)), 401);
  }
  if (!v.verified) return galat("Verifikasi sidik jari gagal.", 401);
  await admin.from("passkeys").update({ counter: v.authenticationInfo.newCounter, terakhir_dipakai: new Date().toISOString() }).eq("id", kunci.id);

  const { data: prof } = await admin.from("profiles").select("role").eq("id", kunci.user_id).maybeSingle();
  const { data: u } = await admin.auth.admin.getUserById(kunci.user_id);
  if (!prof || !PERAN_BOLEH.includes(prof.role) || !u?.user?.email) return galat("Akun tidak dapat masuk.", 403);
  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
  const token = link?.properties?.hashed_token;
  if (error || !token) return galat("Gagal membuka sesi.", 500);
  return json({ ok: true, token_hash: token, type: "magiclink" });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return galat("Metode tidak didukung.", 405);
  try {
    const aksi = new URL(req.url).searchParams.get("aksi");
    if (aksi === "daftar-opsi") return await daftarOpsi(req);
    if (aksi === "daftar-verifikasi") return await daftarVerifikasi(req);
    if (aksi === "masuk-opsi") return await masukOpsi(req);
    if (aksi === "masuk-verifikasi") return await masukVerifikasi(req);
    return galat("Aksi tidak dikenal.");
  } catch (e) {
    return json({ ok: false, pesan: e instanceof Error ? e.message : String(e) }, 500);
  }
});
