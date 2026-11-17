import { useEffect, useState } from "react";
import { C } from "../data";
import { useAuth } from "../contexts/AuthContext";
import { sidikJariDidukung, sidikJariAktif, aktifkanSidikJari, matikanSidikJari } from "../lib/passkey";

function JariIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4a6 6 0 0 0-6 6v1.5M12 4a6 6 0 0 1 6 6v2.5c0 2.2.5 4 1.5 5.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      <path d="M9 20c.8-1.6 1.2-3.3 1.2-5.2V10a1.8 1.8 0 0 1 3.6 0v4.5c0 1.6.4 3 1.2 4.3" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      <path d="M6 14.5c0 2-.4 3.6-1.2 5" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/** "Masuk dengan Sidik Jari" di menu profil (HP) dan menu samping (desktop): diaktifkan setelah login biasa, seperti m-banking.
 *  Username + PIN tetap bisa dipakai kapan saja. */
export function SidikJariToggle({ variant }: { variant: "light" | "dark" }) {
  const { session } = useAuth();
  const uid = session?.user?.id;
  const [status, setStatus] = useState<"memuat" | "tidak" | "mati" | "hidup">("memuat");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    let batal = false;
    sidikJariDidukung().then(async (ok) => {
      if (batal) return;
      if (!ok) return setStatus("tidak");
      const aktif = await sidikJariAktif(uid);
      if (!batal) setStatus(aktif ? "hidup" : "mati");
    });
    return () => {
      batal = true;
    };
  }, [uid]);

  if (!uid || status === "memuat" || status === "tidak") return null;

  const warna = variant === "dark" ? "rgba(255,255,255,0.88)" : C.ink;

  async function ubah() {
    if (!uid) return;
    setSibuk(true);
    setGalat(null);
    const r = status === "hidup" ? await matikanSidikJari(uid) : await aktifkanSidikJari();
    if (r.ok) setStatus(status === "hidup" ? "mati" : "hidup");
    else setGalat(r.error ?? "Gagal.");
    setSibuk(false);
  }

  return (
    <div>
      <button onClick={ubah} disabled={sibuk} className="w-full flex items-center gap-3 rounded-xl px-3.5 py-3 transition-colors disabled:opacity-60" style={{ color: warna }}>
        <JariIcon color={warna} />
        <span className="text-sm font-medium flex-1 text-left">
          {sibuk ? "Memproses…" : status === "hidup" ? "Sidik Jari Aktif" : "Masuk dengan Sidik Jari"}
        </span>
        {status === "hidup" && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "#4ADE80" }} aria-hidden="true" />}
      </button>
      {galat && (
        <p className="px-3.5 text-[11px]" style={{ color: "var(--c-bahayaGaris)" }}>
          {galat}
        </p>
      )}
    </div>
  );
}
