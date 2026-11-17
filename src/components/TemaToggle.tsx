import { useState } from "react";
import { C } from "../data";
import { bacaPilihan, simpanPilihan, type PilihanTema } from "../lib/tema";

const URUT: PilihanTema[] = ["otomatis", "gelap", "terang"];
const LABEL: Record<PilihanTema, string> = { otomatis: "Tampilan: Otomatis", gelap: "Tampilan: Gelap", terang: "Tampilan: Terang" };

function Ikon({ p, color }: { p: PilihanTema; color: string }) {
  if (p === "gelap")
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    );
  if (p === "terang")
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="4" stroke={color} strokeWidth="1.7" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke={color} strokeWidth="1.7" />
      <path d="M12 4a8 8 0 0 1 0 16Z" fill={color} />
    </svg>
  );
}

/** Pengatur tampilan di menu profil / menu samping: ketuk untuk berganti Otomatis (ikut HP) -> Gelap -> Terang. */
export function TemaToggle({ variant }: { variant: "light" | "dark" }) {
  const [p, setP] = useState<PilihanTema>(bacaPilihan);
  const warna = variant === "dark" ? "rgba(255,255,255,0.88)" : C.ink;
  const ganti = () => {
    const next = URUT[(URUT.indexOf(p) + 1) % URUT.length];
    simpanPilihan(next);
    setP(next);
  };
  return (
    <button onClick={ganti} className="w-full flex items-center gap-3 rounded-xl px-3.5 py-3 transition-colors" style={{ color: warna }}>
      <Ikon p={p} color={warna} />
      <span className="text-sm font-medium flex-1 text-left">{LABEL[p]}</span>
    </button>
  );
}
