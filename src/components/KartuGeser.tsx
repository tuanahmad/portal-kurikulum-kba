import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { C } from "../data";

// Kartu status di Home yang bisa digeser: satu kartu = satu kelompok, angka besar di kanan, titik penanda di bawah.
// Berganti sendiri tiap 5 detik, SELALU ke kanan dan berputar tanpa ujung (dari kartu terakhir langsung ke kartu pertama,
// tidak "mundur" ke kiri). Berhenti sementara saat disentuh / kursor di atasnya / fokus keyboard / daftar dibuka.
// Di layar besar ada tombol kiri-kanan yang hanya terlihat saat kursor di atas kartu.

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
  belum?: string[]; // nama yang belum mengisi (management); ditampilkan lewat tombol "Lihat yang belum"
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
  const n = slides.length;
  const lingkar = n > 1;
  // Kalau lebih dari satu kartu: [salinan kartu terakhir, kartu asli..., salinan kartu pertama]; posisi gulir 1..n = kartu asli.
  const daftar = lingkar ? [slides[n - 1], ...slides, slides[0]] : slides;
  const [pos, setPos] = useState(lingkar ? 1 : 0);
  const [jeda, setJeda] = useState(false);
  const [terbuka, setTerbuka] = useState<string | null>(null);

  const lompat = (p: number) => {
    const el = gulir.current;
    if (!el) return;
    el.style.scrollSnapType = "none";
    el.scrollTo({ left: p * el.clientWidth, behavior: "instant" as ScrollBehavior });
    requestAnimationFrame(() => {
      el.style.scrollSnapType = "";
    });
  };

  // Mulai dari kartu asli pertama (di balik salinan kartu terakhir).
  useLayoutEffect(() => {
    if (lingkar) lompat(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lingkar, n]);

  const ke = useCallback((p: number) => {
    const el = gulir.current;
    if (!el) return;
    el.scrollTo({ left: p * el.clientWidth, behavior: "smooth" });
  }, []);

  // Setelah gulir berhenti: kalau sampai di salinan, lompat (tanpa animasi) ke kartu aslinya -> terlihat tanpa ujung.
  const berhenti = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saatGulir = () => {
    const el = gulir.current;
    if (!el || !el.clientWidth) return;
    setPos(Math.round(el.scrollLeft / el.clientWidth));
    if (!lingkar) return;
    if (berhenti.current) clearTimeout(berhenti.current);
    berhenti.current = setTimeout(() => {
      if (!gulir.current || !gulir.current.clientWidth) return;
      const q = Math.round(gulir.current.scrollLeft / gulir.current.clientWidth);
      if (q === 0) lompat(n);
      else if (q === n + 1) lompat(1);
    }, 90);
  };

  useEffect(() => {
    if (!lingkar || jeda || terbuka) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      const el = gulir.current;
      ke((el ? Math.round(el.scrollLeft / (el.clientWidth || 1)) : pos) + 1);
    }, JEDA_MS);
    return () => clearInterval(t);
  }, [lingkar, jeda, terbuka, pos, ke]);

  useEffect(() => () => void (berhenti.current && clearTimeout(berhenti.current)), []);

  if (n === 0) return null;

  const aktif = lingkar ? (pos - 1 + n) % n : 0;
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
      <div ref={gulir} onScroll={saatGulir} className="flex overflow-x-auto snap-x snap-mandatory rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {daftar.map((s, idx) => {
          const buka = terbuka === s.key;
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
                {buka && s.belum ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {s.belum.map((x) => (
                      <span key={x} className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.22)" }}>
                        {x}
                      </span>
                    ))}
                  </div>
                ) : (
                  s.items &&
                  s.items.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {s.items.map((it) => {
                        const chip = (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.22)" }}>
                            <span aria-hidden="true">{TANDA[it.state]}</span>
                            {it.label}
                          </span>
                        );
                        return it.to ? (
                          <Link key={it.label} to={it.to} onClick={(e) => e.stopPropagation()}>
                            {chip}
                          </Link>
                        ) : (
                          <span key={it.label}>{chip}</span>
                        );
                      })}
                    </div>
                  )
                )}
                {s.belum && s.belum.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setTerbuka(buka ? null : s.key);
                    }}
                    className="mt-2 text-[11px] font-bold underline underline-offset-2"
                  >
                    {buka ? "Tutup" : `Lihat yang belum (${s.belum.length})`}
                  </button>
                )}
              </div>
            </div>
          );
          return (
            <div key={`${s.key}-${idx}`} className="w-full shrink-0 snap-center" style={{ background: LATAR[s.nada] }} aria-hidden={lingkar && (idx === 0 || idx === daftar.length - 1) ? true : undefined}>
              {s.to && !s.belum ? (
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

      {lingkar && (
        <>
          <button type="button" aria-label="Kartu sebelumnya" onClick={() => ke(pos - 1)} className={`${tombol} left-2`} style={{ background: "rgba(0,0,0,0.35)" }}>
            ‹
          </button>
          <button type="button" aria-label="Kartu berikutnya" onClick={() => ke(pos + 1)} className={`${tombol} right-2`} style={{ background: "rgba(0,0,0,0.35)" }}>
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
