import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { C } from "../data";

// Kartu status di Home yang bisa digeser: satu kartu = satu kelompok, angka besar di kanan, titik penanda di bawah.
// Berganti sendiri tiap 5 detik; berhenti sementara saat disentuh / kursor di atasnya / fokus keyboard. Di layar besar ada
// tombol kiri-kanan yang hanya terlihat saat kursor di atas kartu.

export type Nada = "selesai" | "sebagian" | "belum" | "libur";
export type ItemKartu = { label: string; state: Nada; to?: string };
export type SlideKartu = {
  key: string;
  judul: string; // "Hari ini"
  sub?: string; // keterangan kecil (tanggal, dsb.)
  utama: string; // kalimat besar, mis. "Semua sudah terisi"
  angka?: string; // angka besar di kanan, mis. "2/3"
  nada: Nada;
  items?: ItemKartu[];
  to?: string; // ketuk kartu -> halaman ini
};

const LATAR: Record<Nada, string> = {
  selesai: `linear-gradient(135deg, ${C.green} 0%, ${C.greenDeep} 100%)`,
  sebagian: "linear-gradient(135deg, #D8A13A 0%, #A8741A 100%)",
  belum: "linear-gradient(135deg, #D9573B 0%, #A3341F 100%)",
  libur: "linear-gradient(135deg, #8A9199 0%, #6B737B 100%)",
};
const TANDA: Record<Nada, string> = { selesai: "✓", sebagian: "◐", belum: "○", libur: "–" };
const JEDA_MS = 5000;

export function KartuGeser({ slides }: { slides: SlideKartu[] }) {
  const gulir = useRef<HTMLDivElement>(null);
  const [aktif, setAktif] = useState(0);
  const [jeda, setJeda] = useState(false);
  const banyak = slides.length;

  const ke = useCallback(
    (i: number) => {
      const el = gulir.current;
      if (!el || banyak === 0) return;
      const n = (i + banyak) % banyak;
      el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
    },
    [banyak]
  );

  // Titik penanda mengikuti posisi gulir (geser manual maupun otomatis).
  const saatGulir = () => {
    const el = gulir.current;
    if (!el || !el.clientWidth) return;
    setAktif(Math.round(el.scrollLeft / el.clientWidth));
  };

  useEffect(() => {
    if (banyak < 2 || jeda) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => ke(aktif + 1), JEDA_MS);
    return () => clearInterval(t);
  }, [aktif, banyak, jeda, ke]);

  if (banyak === 0) return null;

  const tombol =
    "hidden md:flex absolute top-1/2 -translate-y-1/2 w-9 h-9 rounded-full items-center justify-center text-white text-lg opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity";

  return (
    <section
      className="kartu-muncul mb-5 group relative"
      aria-roledescription="carousel"
      onMouseEnter={() => setJeda(true)}
      onMouseLeave={() => setJeda(false)}
      onFocus={() => setJeda(true)}
      onBlur={() => setJeda(false)}
      onTouchStart={() => setJeda(true)}
      onTouchEnd={() => setTimeout(() => setJeda(false), 6000)}
    >
      <div
        ref={gulir}
        onScroll={saatGulir}
        className="flex overflow-x-auto snap-x snap-mandatory rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollBehavior: "smooth" }}
      >
        {slides.map((s) => {
          const isi = (
            <div className="relative h-full p-4 sm:p-5 md:px-14 text-white flex flex-col justify-between pb-8 sm:pb-9" style={{ minHeight: 176 }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.16em] opacity-90">{s.judul}</div>
                  {s.sub && <div className="text-[11px] opacity-75 mt-0.5">{s.sub}</div>}
                </div>
                {s.angka && (
                  <div className="text-4xl font-semibold leading-none" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontVariantNumeric: "lining-nums" }}>
                    {s.angka}
                  </div>
                )}
              </div>
              <div>
                <div className="text-base sm:text-lg font-semibold leading-snug">{s.utama}</div>
                {s.items && s.items.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {s.items.map((it) => {
                      const chip = (
                        <span key={it.label} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.22)" }}>
                          <span aria-hidden="true">{TANDA[it.state]}</span>
                          {it.label}
                        </span>
                      );
                      return it.to ? (
                        <Link key={it.label} to={it.to} onClick={(e) => e.stopPropagation()}>
                          {chip}
                        </Link>
                      ) : (
                        chip
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
          return (
            <div key={s.key} className="w-full shrink-0 snap-center" style={{ background: LATAR[s.nada] }}>
              {s.to ? (
                <Link to={s.to} className="block h-full">
                  {isi}
                </Link>
              ) : (
                isi
              )}
            </div>
          );
        })}
      </div>

      {banyak > 1 && (
        <>
          <button type="button" aria-label="Kartu sebelumnya" onClick={() => ke(aktif - 1)} className={`${tombol} left-2`} style={{ background: "rgba(0,0,0,0.35)" }}>
            ‹
          </button>
          <button type="button" aria-label="Kartu berikutnya" onClick={() => ke(aktif + 1)} className={`${tombol} right-2`} style={{ background: "rgba(0,0,0,0.35)" }}>
            ›
          </button>
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
            {slides.map((s, i) => (
              <span key={s.key} className="h-1.5 rounded-full transition-all" style={{ width: i === aktif ? 14 : 6, background: "#FFF", opacity: i === aktif ? 0.95 : 0.5 }} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
