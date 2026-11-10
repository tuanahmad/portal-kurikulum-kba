import { useState } from "react";
import { C } from "../data";
import { BULAN_NAMA } from "../lib/kehadiranSantri";

/** Kartu "Unduh PDF kehadiran per bulan" (management): pilih bulan lalu unduh. Pembuatan PDF dikerjakan `onUnduh`. */
export default function UnduhKehadiranBulan({
  judul,
  keterangan,
  onUnduh,
}: {
  judul: string;
  keterangan: string;
  onUnduh: (tahun: number, bulan0: number) => Promise<void>;
}) {
  const sekarang = new Date();
  const [tgl, setTgl] = useState(new Date(sekarang.getFullYear(), sekarang.getMonth(), 1));
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const bulanIni = tgl.getFullYear() === sekarang.getFullYear() && tgl.getMonth() === sekarang.getMonth();
  const geser = (n: number) => setTgl((d) => new Date(d.getFullYear(), d.getMonth() + n, 1));

  async function unduh() {
    setSibuk(true);
    setGalat(null);
    try {
      await onUnduh(tgl.getFullYear(), tgl.getMonth());
    } catch (e) {
      setGalat("Gagal membuat PDF: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSibuk(false);
    }
  }

  const tombol = "w-9 h-9 rounded-xl flex items-center justify-center shrink-0";
  return (
    <div className="mt-4 rounded-2xl p-3.5" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
      <div className="text-xs font-bold uppercase tracking-wider" style={{ color: C.green }}>{judul}</div>
      <p className="mt-1 text-[11px] leading-relaxed" style={{ color: C.muted }}>{keterangan}</p>
      <div className="mt-2.5 flex items-center gap-2">
        <button type="button" onClick={() => geser(-1)} aria-label="Bulan sebelumnya" className={tombol} style={{ background: C.mist, border: `1px solid ${C.line}`, color: C.green }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div className="flex-1 text-center text-sm font-semibold" style={{ color: C.ink }}>
          {BULAN_NAMA[tgl.getMonth()]} {tgl.getFullYear()}
          {bulanIni && <span className="ml-1.5 text-[11px] font-medium" style={{ color: C.green }}>bulan ini</span>}
        </div>
        <button
          type="button"
          onClick={() => geser(1)}
          disabled={bulanIni}
          aria-label="Bulan berikutnya"
          className={tombol}
          style={{ background: C.mist, border: `1px solid ${C.line}`, color: C.green, opacity: bulanIni ? 0.35 : 1 }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
      <button
        type="button"
        onClick={unduh}
        disabled={sibuk}
        className="mt-2.5 w-full py-2.5 rounded-xl text-sm font-bold"
        style={{ background: C.green, color: "#FFF", opacity: sibuk ? 0.6 : 1 }}
      >
        {sibuk ? "Menyiapkan PDF…" : "Unduh PDF"}
      </button>
      {galat && <p className="mt-2 text-xs" style={{ color: "#8A2A20" }}>{galat}</p>}
    </div>
  );
}
