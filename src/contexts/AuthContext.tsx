import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { supabase } from "../lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";

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
    const { data, error } = await supabase
      .from("profiles")
      .select("role, kelas, kelompok, full_name")
      .eq("id", userId)
      .single();
    if (!error && data) {
      profileUserId.current = userId;
      setRole(data.role as Role);
      setKelas(data.kelas);
      setKelompok(data.kelompok);
      setFullName(data.full_name);
    } else if (profileUserId.current !== userId) {
      // belum pernah berhasil muat profil user ini -> baru boleh dikosongin
      setRole(null);
      setKelas(null);
      setKelompok(null);
      setFullName(null);
    }
    // else: pernah berhasil & sekarang gagal -> pertahankan nilai terakhir yang valid
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) await loadProfile(session.user.id);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (!session?.user) {
        profileUserId.current = null;
        setRole(null);
        setKelas(null);
        setKelompok(null);
        setFullName(null);
        return;
      }
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
    await supabase.auth.signOut();
  }

  /** Muat ulang role/kelas/nama dari profiles — dipanggil abis guru ganti nama sendiri. */
  async function refreshProfile() {
    if (session?.user) await loadProfile(session.user.id);
  }

  return (
    <AuthContext.Provider value={{ session, role, kelas, kelompok, fullName, loading, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam AuthProvider");
  return ctx;
}
