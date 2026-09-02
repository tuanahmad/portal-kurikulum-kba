import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { C, LOGO } from "../data";
import { GoldDivider } from "../components/PortalComponents";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const { session, signIn, loading } = useAuth();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    if (error) setError("Username atau PIN salah. Coba lagi.");
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4" style={{ background: C.mist, color: C.ink }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <img src={LOGO} alt="Logo Kuttab Budi Ashari" className="mx-auto w-44 h-auto" style={{ mixBlendMode: "multiply" }} />
          <div className="max-w-xs mx-auto mt-3">
            <GoldDivider />
          </div>
          <h1
            className="text-lg font-semibold mt-3"
            style={{ color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Portal Kurikulum
          </h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-3 p-5 rounded-2xl"
          style={{ background: "#FFF", border: `1px solid ${C.line}` }}
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
              placeholder="misal: awalsatu"
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
            <p className="text-xs px-1" style={{ color: "#B3441C" }}>{error}</p>
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
