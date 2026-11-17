import { useEffect, useState } from "react";
import { C } from "../data";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "./Toast";
import { sidikJariDidukung, sidikJariAktif, aktifkanSidikJari } from "../lib/passkey";

const KUNCI_NANTI = "sidikjari-ajakan-nanti";
const JEDA_HARI = 7;

const ditunda = () => {
  try {
    const t = Number(localStorage.getItem(KUNCI_NANTI) ?? 0);
    return t > 0 && Date.now() - t < JEDA_HARI * 86400000;
  } catch {
    return false;
  }
};

/** Kartu ajakan di Beranda: "Masuk dengan sidik jari" (seperti m-banking). Hanya muncul di HP yang mendukung dan belum mengaktifkannya;
 *  username + PIN tetap berlaku. */
export function KartuSidikJari() {
  const { session } = useAuth();
  const uid = session?.user?.id;
  const [tampil, setTampil] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    if (!uid || ditunda()) return;
    let batal = false;
    sidikJariDidukung().then(async (ok) => {
      if (!ok || batal) return;
      const aktif = await sidikJariAktif(uid);
      if (!batal) setTampil(!aktif);
    });
    return () => {
      batal = true;
    };
  }, [uid]);

  if (!tampil) return null;

  async function aktifkan() {
    setSibuk(true);
    setGalat(null);
    const r = await aktifkanSidikJari();
    setSibuk(false);
    if (r.ok) {
      toast.sukses("Sidik jari aktif");
      setTampil(false);
    } else setGalat(r.error ?? "Gagal mengaktifkan.");
  }

  function nanti() {
    try {
      localStorage.setItem(KUNCI_NANTI, String(Date.now()));
    } catch {
      /* abaikan */
    }
    setTampil(false);
  }

  return (
    <div className="mb-4 rounded-2xl p-3.5" style={{ background: C.leaf, border: `1px solid ${C.line}` }} role="region" aria-label="Masuk dengan sidik jari">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.card }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 4a6 6 0 0 0-6 6v1.5M12 4a6 6 0 0 1 6 6v2.5c0 2.2.5 4 1.5 5.5" stroke={C.green} strokeWidth="1.7" strokeLinecap="round" />
            <path d="M9 20c.8-1.6 1.2-3.3 1.2-5.2V10a1.8 1.8 0 0 1 3.6 0v4.5c0 1.6.4 3 1.2 4.3" stroke={C.green} strokeWidth="1.7" strokeLinecap="round" />
            <path d="M6 14.5c0 2-.4 3.6-1.2 5" stroke={C.green} strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold" style={{ color: C.ink }}>Masuk dengan sidik jari</div>
          <p className="mt-0.5 text-xs leading-relaxed" style={{ color: C.muted }}>Lain kali cukup tempel jari, tidak perlu mengetik username dan PIN. Username dan PIN tetap bisa dipakai.</p>
          {galat && <p className="mt-1 text-xs" style={{ color: "var(--c-bahayaTeks)" }}>{galat}</p>}
          <div className="mt-2.5 flex items-center gap-3">
            <button type="button" onClick={aktifkan} disabled={sibuk} className="px-4 py-2 rounded-xl text-sm font-bold" style={{ background: C.green, color: "#FFF", opacity: sibuk ? 0.6 : 1 }}>
              {sibuk ? "Memproses…" : "Aktifkan"}
            </button>
            <button type="button" onClick={nanti} className="text-xs font-semibold" style={{ color: C.muted }}>Nanti</button>
          </div>
        </div>
      </div>
    </div>
  );
}
