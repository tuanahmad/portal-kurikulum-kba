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

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("role, kelas, kelompok, full_name")
      .eq("id", userId)
      .single();
    if (!error && data) {
      setRole(data.role as Role);
      setKelas(data.kelas);
      setKelompok(data.kelompok);
      setFullName(data.full_name);
    } else {
      setRole(null);
      setKelas(null);
      setKelompok(null);
      setFullName(null);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) await loadProfile(session.user.id);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        await loadProfile(session.user.id);
      } else {
        setRole(null);
        setKelas(null);
        setKelompok(null);
        setFullName(null);
      }
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
