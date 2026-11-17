import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { C, LOGO } from "../data";
import { GoldDivider } from "../components/PortalComponents";
import { useAuth } from "../contexts/AuthContext";
import { masukDenganSidikJari, perangkatPunyaSidikJari, sidikJariDidukung } from "../lib/passkey";

export default function LoginPage() {
  const { session, signIn, loading } = useAuth();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Tombol sidik jari hanya muncul di HP yang sudah pernah mengaktifkannya (dari menu profil setelah login biasa).
  const [bisaJari, setBisaJari] = useState(false);
  useEffect(() => {
    if (perangkatPunyaSidikJari()) sidikJariDidukung().then(setBisaJari);
  }, []);

  async function masukJari() {
    setError(null);
    setSubmitting(true);
    const r = await masukDenganSidikJari();
    setSubmitting(false);
    if (!r.ok) setError(r.error ?? "Sidik jari tidak berhasil. Masuk dengan username dan PIN.");
  }

  if (!loading && session) {
    const from = (location.state as any)?.from || "/home";
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await signIn(username, pin);
    setSubmitting(false);
    if (error) {
      // Gagal karena jaringan (bukan salah PIN): jangan membuat guru mengira PIN-nya salah.
      setError(
        /failed to fetch|networkerror|load failed|network request failed|aborted|timeout/i.test(error)
          ? "Tidak ada sinyal. Login butuh sinyal; coba lagi di tempat yang sinyalnya lebih baik. Setelah berhasil masuk, aplikasi tetap bisa dibuka saat sinyal jelek."
          : "Username atau PIN salah. Coba lagi."
      );
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4" style={{ background: C.mist, color: C.ink }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <img src={LOGO} alt="Logo Kuttab Budi Ashari" className="logo-login mx-auto w-44 h-auto" />
          <div className="max-w-xs mx-auto mt-3">
            <GoldDivider />
          </div>
          <h1
            className="text-lg font-semibold mt-3"
            style={{ color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Portal Guru
          </h1>
        </div>

        {bisaJari && (
          <div className="mb-3">
            <button
              type="button"
              onClick={masukJari}
              disabled={submitting}
              className="w-full py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: C.card, border: `1.5px solid ${C.green}`, color: C.green }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 4a6 6 0 0 0-6 6v1.5M12 4a6 6 0 0 1 6 6v2.5c0 2.2.5 4 1.5 5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                <path d="M9 20c.8-1.6 1.2-3.3 1.2-5.2V10a1.8 1.8 0 0 1 3.6 0v4.5c0 1.6.4 3 1.2 4.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                <path d="M6 14.5c0 2-.4 3.6-1.2 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              Masuk dengan Sidik Jari
            </button>
            <p className="text-center text-[11px] mt-2" style={{ color: C.muted }}>atau masuk dengan username dan PIN</p>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-3 p-5 rounded-2xl"
          style={{ background: C.card, border: `1px solid ${C.line}` }}
        >
          <div>
            <label className="text-xs font-semibold" style={{ color: C.muted }}>Username</label>
            <input
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full mt-1 px-3.5 py-2.5 rounded-xl text-sm outline-none focus:ring-2"
              style={{ background: C.mist, border: `1px solid ${C.line}`, "--tw-ring-color": C.gold } as any}
              placeholder="Masukkan username Anda"
            />
          </div>
          <div>
            <label className="text-xs font-semibold" style={{ color: C.muted }}>PIN</label>
            <input
              type="password"
              inputMode="numeric"
              required
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full mt-1 px-3.5 py-2.5 rounded-xl text-sm outline-none focus:ring-2 tracking-widest"
              style={{ background: C.mist, border: `1px solid ${C.line}`, "--tw-ring-color": C.gold } as any}
              placeholder="••••••"
            />
          </div>

          {error && (
            <p className="text-xs px-1" style={{ color: "var(--c-bahayaTeks)" }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: C.green, color: "#FFF" }}
          >
            {submitting ? "Memproses…" : "Masuk"}
          </button>
        </form>

        <p className="text-center text-xs mt-4" style={{ color: C.muted }}>
          Lupa username atau PIN? Hubungi koordinator kurikulum.
        </p>
      </div>
    </div>
  );
}
