import { useEffect } from "react";

/** Warna bar status (atas) dan bar gestur (bawah) di Android/iPhone mengikuti <meta name="theme-color">. Supaya aplikasi
 *  terasa menyatu / layar penuh, warna itu diambil LANGSUNG dari warna latar yang sedang terlihat di paling atas layar,
 *  jadi halaman apa pun (krem, hero gelap, header berwarna) otomatis cocok tanpa pengaturan per halaman.
 *  Dicek saat menggulir, saat layar berubah ukuran, dan berkala (halaman memuat isinya bertahap). Berlaku seketika lewat
 *  JavaScript, tanpa memasang ulang aplikasi.
 *  `foto`: warna cadangan kalau yang terlihat di atas hanya gambar tanpa warna dasar (mis. foto hero). */
const KREM_CADANGAN = "#FBFAF7";

function keHex(css: string): string | null {
  const m = css.match(/rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,/]+([\d.]+%?))?\s*\)/);
  if (!m) return null;
  const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  if (a < 0.9) return null; // transparan / hampir transparan: lanjut ke lapisan di bawahnya
  return "#" + [m[1], m[2], m[3]].map((n) => Math.min(255, Number(n)).toString(16).padStart(2, "0")).join("");
}

/** Warna latar di titik paling atas layar: naik dari elemen yang terlihat sampai ketemu warna dasar yang pekat. */
function warnaTerlihatDiAtas(foto: string): string {
  const x = Math.round(window.innerWidth / 2);
  for (const y of [2, 6]) {
    let el: Element | null = document.elementFromPoint(x, y);
    let adaGambar = false;
    while (el) {
      const cs = getComputedStyle(el);
      const hex = keHex(cs.backgroundColor);
      if (hex) return hex;
      if (cs.backgroundImage && cs.backgroundImage !== "none") adaGambar = true;
      el = el.parentElement;
    }
    if (adaGambar) return foto;
  }
  return KREM_CADANGAN;
}

export function WarnaBar({ foto = "#1B3327" }: { foto?: string }) {
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    let menunggu = false;
    const periksa = () => {
      menunggu = false;
      const c = warnaTerlihatDiAtas(foto);
      if (meta.getAttribute("content") !== c) meta.setAttribute("content", c);
    };
    const jadwalkan = () => {
      if (menunggu) return;
      menunggu = true;
      requestAnimationFrame(periksa);
    };
    periksa();
    const berkala = setInterval(periksa, 700);
    window.addEventListener("scroll", jadwalkan, { passive: true });
    window.addEventListener("resize", jadwalkan);
    window.addEventListener("popstate", jadwalkan);
    return () => {
      clearInterval(berkala);
      window.removeEventListener("scroll", jadwalkan);
      window.removeEventListener("resize", jadwalkan);
      window.removeEventListener("popstate", jadwalkan);
    };
  }, [foto]);

  return null;
}
