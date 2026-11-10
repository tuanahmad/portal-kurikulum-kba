import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { supabase } from "../lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";
import { muatRoster, kosongkanRoster, hapusSalinanRoster, pakaiSalinanRoster } from "../lib/roster";

// ───────── Tahan sinyal ─────────
// Tiket masuk (token) hanya berlaku sebentar. Kalau aplikasi dibuka saat sinyal jelek, pembaruan tiket gagal dan
// getSession() mengembalikan "tidak ada sesi" -> guru dilempar ke halaman Login yang justru butuh sinyal. Padahal sesinya
// masih tersimpan di HP. Solusi: kalau gagal karena jaringan (bukan karena ditolak server), pakai sesi tersimpan + profil
// terakhir ("mode tanpa sinyal"); pembaruan tiket terus dicoba di belakang layar dan beres sendiri saat sinyal kembali.
const KUNCI_PROFIL = "portal-profil:v1:";

type ProfilSalinan = { role: Role; kelas: string | null; kelompok: string | null; fullName: string | null };

function bacaProfilSalinan(userId: string): ProfilSalinan | null {
  try {
    const raw = localStorage.getItem(KUNCI_PROFIL + userId);
    return raw ? (JSON.parse(raw) as ProfilSalinan) : null;
  } catch {
    return null;
  }
}

function simpanProfilSalinan(userId: string, p: ProfilSalinan) {
  try {
    localStorage.setItem(KUNCI_PROFIL + userId, JSON.stringify(p));
  } catch {
    /* penyimpanan penuh / diblokir: abaikan */
  }
}

function hapusProfilSalinan() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(KUNCI_PROFIL)) localStorage.removeItem(k);
  } catch {
    /* abaikan */
  }
}

/** Sesi yang masih tersimpan di HP (dipakai supabase), atau null kalau tidak ada / sudah dibuang karena ditolak server. */
function sesiTersimpan(): Session | null {
  try {
    const kunci = Object.keys(localStorage).find((k) => /^sb-.+-auth-token$/.test(k));
    if (!kunci) return null;
    const s = JSON.parse(localStorage.getItem(kunci) ?? "null") as Session | null;
    return s?.refresh_token && s.user?.id ? s : null;
  } catch {
    return null;
  }
}

const tunggu = (ms: number) => new Promise<"lambat">((r) => setTimeout(() => r("lambat"), ms));

type Role = "management" | "guru" | "olahraga";

// Login pakai username + PIN, bukan email asli. Username dipetakan jadi email
// sintetis di domain ini (RFC 2606 — dijamin gak pernah nyata/bisa dikirimi email)
// supaya tetap bisa pakai Supabase Auth (password hashing, session, dst) apa adanya.
const AUTH_EMAIL_DOMAIN = "kba.invalid";

function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
}

interface AuthContextValue {
  session: Session | null;
  role: Role | null;
  kelas: string | null;
  kelompok: string | null;
  fullName: string | null;
  loading: boolean;
  /** true kalau daftar santri sudah dimuat (atau gagal/timeout dan halaman memakai cadangan). */
  rosterReady: boolean;
  /** true kalau aplikasi berjalan dari sesi tersimpan karena tiket belum bisa diperbarui (tanpa sinyal). */
  modeOffline: boolean;
  signIn: (username: string, pin: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [kelas, setKelas] = useState<string | null>(null);
  const [kelompok, setKelompok] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rosterReady, setRosterReady] = useState(false);
  const [modeOffline, setModeOffline] = useState(false);

  // Pengaman: kalau sudah login tapi daftar santri tak kunjung siap (mis. profil gagal dimuat), jangan biarkan
  // layar menunggu selamanya -- lepas setelah 8 detik, halaman memakai cadangan.
  useEffect(() => {
    if (!session || rosterReady) return;
    const t = setTimeout(() => setRosterReady(true), 8000);
    return () => clearTimeout(t);
  }, [session, rosterReady]);

  // Splash logo di index.html (tampil instan sebelum React siap) — begitu sesi login kelar
  // dicek, hilangin dengan fade lalu buang elemennya biar gak nyangkut di DOM. Ditahan minimal
  // 1 detik biar animasinya kelihatan (kalau cek sesi kelar kelewat cepat, jadi cuma kedip).
  const splashShownAt = useRef(Date.now());
  useEffect(() => {
    if (loading) return;
    const el = document.getElementById("app-splash");
    if (!el) return;
    const elapsed = Date.now() - splashShownAt.current;
    const remaining = Math.max(0, 1000 - elapsed);
    const hideTimer = setTimeout(() => {
      el.classList.add("app-splash-hide");
      setTimeout(() => el.remove(), 350);
    }, remaining);
    return () => clearTimeout(hideTimer);
  }, [loading]);

  // Terakhir kali profil BERHASIL dimuat -- dipakai buat gak nge-wipe role/kelas/kelompok cuma
  // gara-gara 1x gagal muat (mis. jaringan HP putus-nyambung pas token disegarkan). Kalau
  // role/kelompok sampai ke-null sesaat, halaman guru bisa langsung ganti jadi layar "akun belum
  // ditandai" dan form yang lagi diisi (beserta teks yang belum disimpan) hilang.
  const profileUserId = useRef<string | null>(null);

  async function loadProfile(userId: string) {
    // Dibatasi 6 detik: sinyal yang menggantung jangan membuat layar menunggu selamanya (jatuh ke salinan di HP).
    const hasil = await Promise.race([
      supabase.from("profiles").select("role, kelas, kelompok, full_name").eq("id", userId).single(),
      tunggu(5000),
    ]);
    const lambat = hasil === "lambat";
    const data = lambat ? null : hasil.data;
    const error = lambat ? ({ message: "lambat" } as const) : hasil.error;
    if (!error && data) {
      profileUserId.current = userId;
      setRole(data.role as Role);
      setKelas(data.kelas);
      setKelompok(data.kelompok);
      setFullName(data.full_name);
      simpanProfilSalinan(userId, { role: data.role as Role, kelas: data.kelas, kelompok: data.kelompok, fullName: data.full_name });
    } else if (profileUserId.current !== userId) {
      // Belum pernah berhasil muat profil user ini di sesi ini: pakai salinan terakhir di HP (tanpa sinyal). Salinan
      // sengaja TIDAK ditandai sebagai "sudah dimuat", jadi begitu sinyal kembali profil dimuat ulang dari server.
      const salinan = bacaProfilSalinan(userId);
      if (salinan) {
        setRole(salinan.role);
        setKelas(salinan.kelas);
        setKelompok(salinan.kelompok);
        setFullName(salinan.fullName);
      } else {
        setRole(null);
        setKelas(null);
        setKelompok(null);
        setFullName(null);
      }
    }
    // else: pernah berhasil & sekarang gagal -> pertahankan nilai terakhir yang valid

    // Daftar santri dari database (dibatasi RLS sesuai peran). Ditunggu maksimal 4 detik; kalau gagal/lambat,
    // halaman tetap jalan dengan daftar cadangan di kode.
    await Promise.race([muatRoster(), new Promise<void>((r) => setTimeout(r, 4000))]);
    setRosterReady(true);
  }

  useEffect(() => {
    (async () => {
      // Cek sesi, tapi jangan menunggu lebih dari 7 detik (sinyal menggantung).
      const hasil = await Promise.race([supabase.auth.getSession(), tunggu(3000)]);
      let sesi: Session | null = hasil === "lambat" ? null : hasil.data.session;
      let dariSalinan = false;
      if (!sesi) {
        // Tidak ada sesi yang bisa dipakai. Kalau sesi masih tersimpan di HP (gagal diperbarui karena jaringan, belum
        // dibuang karena ditolak server), tetap masuk dalam mode tanpa sinyal.
        const simpan = sesiTersimpan();
        if (simpan) {
          sesi = simpan;
          dariSalinan = true;
          setModeOffline(true);
        }
      }
      setSession(sesi);
      const salinan = dariSalinan && sesi?.user ? bacaProfilSalinan(sesi.user.id) : null;
      if (sesi?.user && salinan) {
        // Langsung masuk memakai profil + daftar santri terakhir di HP (tanpa menunggu server yang tak menjawab);
        // profil dimuat ulang di belakang layar dan beres sendiri begitu sinyal kembali.
        setRole(salinan.role);
        setKelas(salinan.kelas);
        setKelompok(salinan.kelompok);
        setFullName(salinan.fullName);
        pakaiSalinanRoster();
        setRosterReady(true);
        setLoading(false);
        void loadProfile(sesi.user.id);
        return;
      }
      if (sesi?.user) await loadProfile(sesi.user.id);
      else setRosterReady(true); // tidak login: tidak ada yang perlu dimuat
      setLoading(false);
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) {
        // "Tidak ada sesi" karena jaringan (bukan keluar akun / ditolak server): jangan hapus apa-apa, sesi tersimpan
        // tetap dipakai. Hanya SIGNED_OUT yang benar-benar mengeluarkan.
        if (event !== "SIGNED_OUT" && sesiTersimpan()) return;
        setSession(null);
        setModeOffline(false);
        profileUserId.current = null;
        kosongkanRoster();
        hapusSalinanRoster();
        hapusProfilSalinan();
        setRosterReady(false);
        setRole(null);
        setKelas(null);
        setKelompok(null);
        setFullName(null);
        return;
      }
      setSession(session);
      // Sesi sah dari server (tiket berhasil diperbarui / login): keluar dari mode tanpa sinyal.
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") setModeOffline(false);
      // Token cuma disegarkan (pindah tab / balik ke aplikasi) -> profil gak berubah, gak perlu
      // dimuat ulang. Dan JANGAN await query Supabase di dalam callback ini: callback jalan sambil
      // megang lock auth, query yang butuh token bisa nunggu lock yang sama -> permintaan macet.
      if (event === "TOKEN_REFRESHED" && profileUserId.current === session.user.id) return;
      const uid = session.user.id;
      setTimeout(() => { void loadProfile(uid); }, 0);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn(username: string, pin: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password: pin,
    });
    return { error: error ? error.message : null };
  }

  async function signOut() {
    // Tanpa sinyal, keluar akun lewat server bisa gagal/menggantung: batasi, lalu keluar secara lokal.
    await Promise.race([supabase.auth.signOut().catch(() => undefined), tunggu(4000)]);
    if (sesiTersimpan()) await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  }

  // Sinyal kembali: segera coba perbarui tiket (tanpa menunggu pemeriksaan berkala) supaya mode tanpa sinyal selesai.
  useEffect(() => {
    if (!modeOffline) return;
    const coba = () => {
      void supabase.auth.refreshSession().catch(() => undefined);
    };
    window.addEventListener("online", coba);
    document.addEventListener("visibilitychange", coba);
    const t = setInterval(coba, 20000);
    return () => {
      window.removeEventListener("online", coba);
      document.removeEventListener("visibilitychange", coba);
      clearInterval(t);
    };
  }, [modeOffline]);

  /** Muat ulang role/kelas/nama dari profiles — dipanggil abis guru ganti nama sendiri. */
  async function refreshProfile() {
    if (session?.user) await loadProfile(session.user.id);
  }

  return (
    <AuthContext.Provider value={{ session, role, kelas, kelompok, fullName, loading, rosterReady, modeOffline, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam AuthProvider");
  return ctx;
}
