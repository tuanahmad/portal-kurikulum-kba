import { supabase } from "./supabaseClient";

// Masuk dengan sidik jari / kunci layar HP (WebAuthn passkey), seperti m-banking. Username + PIN tetap berlaku; ini pilihan tambahan yang
// diaktifkan SESUDAH login biasa. Server: fungsi `passkey` (kunci privat tidak pernah keluar dari HP).

const URL_FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/passkey`;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;
/** Dimatikan sementara (2026-11-17): di HP uji pendaftaran selalu NotAllowedError. Semua tombol/kartu sidik jari mengikuti fungsi
 *  `sidikJariDidukung`, jadi cukup ubah ke true untuk menyalakan lagi. Login username + PIN tidak terpengaruh. */
const FITUR_SIDIK_JARI_AKTIF = false;
/** "1" kalau HP ini sudah pernah mendaftarkan sidik jari (supaya layar login menampilkan tombolnya). */
const KUNCI_PERANGKAT = "passkey-perangkat";
const kunciId = (uid: string) => `passkey-id:${uid}`;

type Hasil = { ok: boolean; error?: string };

function ke64u(buf: ArrayBuffer | ArrayBufferView): string {
  const b = buf instanceof ArrayBuffer ? new Uint8Array(buf) : new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function dari64u(s: string): ArrayBuffer {
  const p = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(p);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function simpanLokal(kunci: string, nilai: string | null) {
  try {
    if (nilai === null) localStorage.removeItem(kunci);
    else localStorage.setItem(kunci, nilai);
  } catch {
    /* abaikan */
  }
}
function bacaLokal(kunci: string): string | null {
  try {
    return localStorage.getItem(kunci);
  } catch {
    return null;
  }
}

/** HP ini punya sensor sidik jari / kunci layar yang bisa dipakai? */
export async function sidikJariDidukung(): Promise<boolean> {
  if (!FITUR_SIDIK_JARI_AKTIF) return false;
  try {
    return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

/** Sudah pernah diaktifkan di HP ini? (dipakai layar login untuk memutuskan menampilkan tombol) */
export const perangkatPunyaSidikJari = () => bacaLokal(KUNCI_PERANGKAT) === "1";

async function panggil(aksi: string, body: unknown, token?: string): Promise<{ ok: boolean; json: any }> {
  const res = await fetch(`${URL_FN}?aksi=${aksi}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok && json?.ok !== false, json };
}

function pesanGalat(e: unknown): string {
  const nama = (e as { name?: string })?.name;
  const rinci = ` (${nama ?? "?"}: ${String((e as { message?: string })?.message ?? "").slice(0, 90)})`;
  if (nama === "NotAllowedError" || nama === "AbortError") return `Dibatalkan, waktunya habis, atau HP menolak. Pastikan kunci layar/sidik jari HP sudah diatur dan tidak sedang berbagi layar, lalu coba lagi.${rinci}`;
  if (nama === "InvalidStateError") return "Sidik jari di HP ini sudah terdaftar untuk akun ini.";
  if (nama === "NotSupportedError") return "HP ini belum mendukung sidik jari/kunci layar untuk aplikasi.";
  if (e instanceof TypeError) return "Tidak ada sinyal. Coba lagi.";
  return e instanceof Error ? e.message : "Terjadi kesalahan.";
}

function namaPerangkat(): string {
  const ua = navigator.userAgent;
  const os = /android/i.test(ua) ? "Android" : /iphone|ipad/i.test(ua) ? "iPhone/iPad" : /windows/i.test(ua) ? "Windows" : /mac/i.test(ua) ? "Mac" : "Perangkat";
  const peramban = /edg/i.test(ua) ? "Edge" : /chrome|crios/i.test(ua) ? "Chrome" : /safari/i.test(ua) ? "Safari" : "Peramban";
  return `${os} · ${peramban}`;
}

/** Daftarkan sidik jari HP ini ke akun yang sedang login. */
export async function aktifkanSidikJari(): Promise<Hasil> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return { ok: false, error: "Masuk dulu dengan username dan PIN." };
    const o = await panggil("daftar-opsi", {}, session.access_token);
    if (!o.ok) return { ok: false, error: o.json?.pesan || "Gagal menyiapkan sidik jari." };
    const opts = o.json;
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: dari64u(opts.challenge),
        rp: opts.rp,
        user: { id: dari64u(opts.user.id), name: opts.user.name, displayName: opts.user.displayName ?? opts.user.name },
        pubKeyCredParams: opts.pubKeyCredParams,
        timeout: opts.timeout,
        attestation: opts.attestation,
        excludeCredentials: (opts.excludeCredentials ?? []).map((c: any) => ({ ...c, id: dari64u(c.id) })),
        authenticatorSelection: opts.authenticatorSelection,
      },
    })) as PublicKeyCredential | null;
    if (!cred) return { ok: false, error: "Dibatalkan." };
    const r = cred.response as AuthenticatorAttestationResponse;
    const v = await panggil(
      "daftar-verifikasi",
      {
        namaPerangkat: namaPerangkat(),
        response: {
          id: cred.id,
          rawId: ke64u(cred.rawId),
          type: cred.type,
          clientExtensionResults: cred.getClientExtensionResults(),
          authenticatorAttachment: (cred as any).authenticatorAttachment,
          response: { clientDataJSON: ke64u(r.clientDataJSON), attestationObject: ke64u(r.attestationObject), transports: r.getTransports?.() ?? [] },
        },
      },
      session.access_token
    );
    if (!v.ok) return { ok: false, error: v.json?.pesan || "Sidik jari tidak dapat didaftarkan." };
    simpanLokal(KUNCI_PERANGKAT, "1");
    simpanLokal(kunciId(session.user.id), v.json.credentialId ?? cred.id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: pesanGalat(e) };
  }
}

/** Masuk memakai sidik jari (tanpa mengetik username/PIN). Berhasil -> sesi terbuka, AuthContext otomatis menangkapnya. */
export async function masukDenganSidikJari(): Promise<Hasil> {
  try {
    const o = await panggil("masuk-opsi", {});
    if (!o.ok) return { ok: false, error: o.json?.pesan || "Gagal menyiapkan sidik jari." };
    const opts = o.json;
    const cred = (await navigator.credentials.get({
      publicKey: { challenge: dari64u(opts.challenge), rpId: opts.rpId, timeout: opts.timeout, userVerification: "required", allowCredentials: [] },
    })) as PublicKeyCredential | null;
    if (!cred) return { ok: false, error: "Dibatalkan." };
    const r = cred.response as AuthenticatorAssertionResponse;
    const v = await panggil("masuk-verifikasi", {
      response: {
        id: cred.id,
        rawId: ke64u(cred.rawId),
        type: cred.type,
        clientExtensionResults: cred.getClientExtensionResults(),
        response: {
          clientDataJSON: ke64u(r.clientDataJSON),
          authenticatorData: ke64u(r.authenticatorData),
          signature: ke64u(r.signature),
          userHandle: r.userHandle ? ke64u(r.userHandle) : null,
        },
      },
    });
    if (!v.ok) return { ok: false, error: v.json?.pesan || "Sidik jari tidak dikenali." };
    const { error } = await supabase.auth.verifyOtp({ token_hash: v.json.token_hash, type: "magiclink" });
    if (error) return { ok: false, error: "Gagal membuka sesi. Masuk dengan username dan PIN." };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: pesanGalat(e) };
  }
}

/** Sidik jari HP ini aktif untuk akun yang sedang login? (cek lokal, lalu pastikan barisnya masih ada di server) */
export async function sidikJariAktif(userId: string): Promise<boolean> {
  const id = bacaLokal(kunciId(userId));
  if (!id) return false;
  try {
    const { data, error } = await supabase.from("passkeys").select("id").eq("credential_id", id).maybeSingle();
    if (error) return true; // gagal membaca (mis. tanpa sinyal): percayai catatan lokal
    if (!data) {
      simpanLokal(kunciId(userId), null);
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

/** Matikan sidik jari HP ini untuk akun yang sedang login (hapus kuncinya dari server). */
export async function matikanSidikJari(userId: string): Promise<Hasil> {
  const id = bacaLokal(kunciId(userId));
  try {
    if (id) {
      const { error } = await supabase.from("passkeys").delete().eq("credential_id", id);
      if (error) return { ok: false, error: "Gagal mematikan. Coba lagi." };
    }
    simpanLokal(kunciId(userId), null);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: pesanGalat(e) };
  }
}
