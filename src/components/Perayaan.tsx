import { useEffect, useRef, useState } from "react";

/** Perayaan setelah guru menyimpan absen: tulisan besar merah yang muncul-hilang 3 kali, tiap kali muncul diiringi
 *  kembang api yang meluncur dari bawah ke atas lalu meledak di langit.
 *  Dipanggil dari mana saja: rayakan("JOSJIS BOLO"). <PerayaanHost /> dipasang SATU kali di App.
 *  Tidak menghalangi layar (pointer-events: none) dan hilang sendiri setelah beberapa detik. */
type Isi = { id: number; teks: string };
let sekarang: Isi | null = null;
let nomor = 1;
const pendengar = new Set<() => void>();
const kabari = () => pendengar.forEach((f) => f());
// Tulisan muncul-hilang 3 kali, sementara kembang api terus meluncur dari bawah.
const ULANG = 3;
const SIKLUS_MS = 1800;
const DURASI_MS = ULANG * SIKLUS_MS + 200;

export function rayakan(teks: string) {
  const id = nomor++;
  sekarang = { id, teks };
  kabari();
  setTimeout(() => {
    if (sekarang?.id === id) {
      sekarang = null;
      kabari();
    }
  }, DURASI_MS);
}

type Partikel = { x: number; y: number; vx: number; vy: number; hidup: number; umur: number; warna: string; ukuran: number };
type Roket = { x: number; y: number; vy: number; targetY: number; warna: string };
const WARNA = ["#E53935", "#FF5252", "#FFC107", "#FFFFFF", "#FF9800", "#66BB6A", "#4FC3F7", "#F06292"];

/** Kembang api klasik: roket meluncur dari BAWAH layar ke atas, lalu meledak jadi percikan warna-warni yang jatuh pelan.
 *  Roket dilepas bertubi-tubi selama tulisan besar muncul-hilang, jadi langit terus meriah. */
function KembangApi() {
  const kanvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = kanvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ukur = () => {
      c.width = window.innerWidth * dpr;
      c.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    ukur();

    const partikel: Partikel[] = [];
    const roket: Roket[] = [];
    const W = () => window.innerWidth;
    const H = () => window.innerHeight;
    const luncurkan = () => {
      roket.push({ x: W() * (0.1 + Math.random() * 0.8), y: H(), vy: -(10 + Math.random() * 4), targetY: H() * (0.12 + Math.random() * 0.36), warna: WARNA[(Math.random() * WARNA.length) | 0] });
    };
    const meledak = (x: number, y: number, warna: string) => {
      const n = 46 + ((Math.random() * 20) | 0);
      for (let i = 0; i < n; i++) {
        const sudut = (Math.PI * 2 * i) / n + Math.random() * 0.2;
        const laju = 2 + Math.random() * 4.6;
        partikel.push({ x, y, vx: Math.cos(sudut) * laju, vy: Math.sin(sudut) * laju, hidup: 0, umur: 55 + Math.random() * 35, warna: Math.random() < 0.7 ? warna : WARNA[(Math.random() * WARNA.length) | 0], ukuran: 1.6 + Math.random() * 1.8 });
      }
    };

    const mulai = performance.now();
    let terakhirLuncur = -999;
    let raf = 0;
    const langkah = (t: number) => {
      const lalu = t - mulai;
      // Roket baru dilepas tiap ~280ms (kadang dua sekaligus) sampai menjelang akhir, supaya ledakan terakhir sempat tampil.
      if (lalu < DURASI_MS - 1500 && t - terakhirLuncur > 280) {
        luncurkan();
        if (Math.random() < 0.55) luncurkan();
        terakhirLuncur = t;
      }
      // Jejak memudar (bukan hapus total) supaya ada ekor cahaya.
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.fillRect(0, 0, W(), H());
      ctx.globalCompositeOperation = "lighter";

      for (let i = roket.length - 1; i >= 0; i--) {
        const r = roket[i];
        r.y += r.vy;
        r.vy *= 0.985;
        ctx.fillStyle = r.warna;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 2.4, 0, Math.PI * 2);
        ctx.fill();
        if (r.y <= r.targetY || r.vy > -2.5) {
          meledak(r.x, r.y, r.warna);
          roket.splice(i, 1);
        }
      }
      for (let i = partikel.length - 1; i >= 0; i--) {
        const p = partikel[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.985;
        p.vy = p.vy * 0.985 + 0.045; // gravitasi
        p.hidup++;
        const sisa = 1 - p.hidup / p.umur;
        if (sisa <= 0) {
          partikel.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.max(0, sisa);
        ctx.fillStyle = p.warna;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.ukuran * (0.6 + sisa * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (lalu < DURASI_MS) raf = requestAnimationFrame(langkah);
    };
    raf = requestAnimationFrame(langkah);
    window.addEventListener("resize", ukur);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", ukur);
    };
  }, []);

  return <canvas ref={kanvas} className="absolute inset-0 w-full h-full" aria-hidden="true" />;
}

export function PerayaanHost() {
  const [, paksa] = useState(0);
  useEffect(() => {
    const f = () => paksa((n) => n + 1);
    pendengar.add(f);
    return () => {
      pendengar.delete(f);
    };
  }, []);

  if (!sekarang) return null;
  const kurangiGerak = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  return (
    <div key={sekarang.id} role="status" aria-live="polite" className="fixed inset-0 z-[90] pointer-events-none flex items-center justify-center overflow-hidden">
      <style>{`
        /* satu siklus: muncul membal -> tahan sebentar -> hilang; diulang ULANG kali */
        @keyframes prym-siklus {
          0% { transform: scale(0.15) rotate(-7deg); opacity: 0; }
          14% { transform: scale(1.14) rotate(2deg); opacity: 1; }
          24% { transform: scale(0.97) rotate(-1deg); opacity: 1; }
          34% { transform: scale(1) rotate(0); opacity: 1; }
          62% { transform: scale(1.04) rotate(0); opacity: 1; }
          84% { transform: scale(1.14) rotate(0); opacity: 0; }
          100% { transform: scale(1.14) rotate(0); opacity: 0; }
        }
      `}</style>
      {!kurangiGerak && <KembangApi />}
      <div
        className="relative text-center font-black uppercase px-4 leading-[0.95]"
        style={{
          color: "#E01E1E",
          fontSize: "clamp(3.2rem, 17vw, 9rem)",
          fontFamily: "Impact, 'Arial Black', 'Helvetica Neue', Arial, sans-serif",
          letterSpacing: "0.02em",
          // garis tepi putih + bayangan supaya merah tetap jelas di atas halaman terang maupun kembang api
          WebkitTextStroke: "0.045em #FFFFFF",
          paintOrder: "stroke fill",
          textShadow: "0 6px 0 rgba(120,0,0,0.35), 0 0 34px rgba(255,60,60,0.75), 0 0 80px rgba(255,160,0,0.55)",
          animation: kurangiGerak ? undefined : `prym-siklus ${SIKLUS_MS}ms ease-out ${ULANG} both`,
        }}
      >
        {sekarang.teks}
      </div>
    </div>
  );
}
