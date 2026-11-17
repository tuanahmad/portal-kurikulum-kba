import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { C } from "../data";

/** Judul halaman dari <h1>: kalau ada anak elemen (mis. Beranda: "Portal Guru" + baris emas) ambil teks pertamanya saja. */
function judulDari(h: HTMLElement): string {
  const awal = Array.from(h.childNodes).find((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim());
  return ((awal?.textContent ?? h.textContent) || "").replace(/\s+/g, " ").trim();
}

/** Bar tipis di paling atas seperti WhatsApp: begitu judul halaman (<h1>) sudah terlewat saat di-scroll ke bawah, namanya tampil
 *  di bar supaya selalu jelas sedang di halaman mana. Dibaca langsung dari <h1> halaman yang sedang tampil, jadi berlaku untuk
 *  semua halaman tanpa mengubahnya satu per satu. Hanya hiasan: tidak bisa diketuk, tidak menutupi tombol di bawahnya. */
export function BarJudulHalaman() {
  const { pathname } = useLocation();
  const [judul, setJudul] = useState("");
  const [tampil, setTampil] = useState(false);

  useEffect(() => {
    setTampil(false);
    const periksa = () => {
      const h = document.querySelector<HTMLElement>(".halaman-masuk h1");
      if (!h) {
        setTampil(false);
        return;
      }
      const r = h.getBoundingClientRect();
      // Judul sudah naik melewati bar (tinggi sekitar 48px) -> tampilkan namanya di bar.
      const lewat = r.bottom < 56 && window.scrollY > 40;
      setTampil(lewat);
      // Halaman utama memakai kata "Beranda" (judul aslinya nama aplikasi).
      if (lewat) setJudul((lama) => (pathname === "/home" ? "Beranda" : judulDari(h) || lama));
    };
    // Langsung dipanggil di tiap kejadian scroll (hanya membaca posisi satu elemen, murah); tanpa penjadwalan supaya tidak macet
    // di tab yang sedang di latar belakang. Tunda sebentar saat halaman baru dibuka agar <h1> sudah ada.
    window.addEventListener("scroll", periksa, { passive: true });
    window.addEventListener("resize", periksa);
    const awal = window.setTimeout(periksa, 120);
    return () => {
      window.removeEventListener("scroll", periksa);
      window.removeEventListener("resize", periksa);
      window.clearTimeout(awal);
    };
  }, [pathname]);

  return (
    <div
      aria-hidden={!tampil}
      className="fixed top-0 left-0 right-0 z-30 pointer-events-none flex items-end justify-center"
      style={{
        height: "calc(50px + env(safe-area-inset-top, 0px))",
        paddingTop: "env(safe-area-inset-top, 0px)",
        background: "color-mix(in srgb, var(--c-card) 86%, transparent)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        borderBottom: `1px solid ${C.line}`,
        opacity: tampil ? 1 : 0,
        transform: tampil ? "translateY(0)" : "translateY(-8px)",
        transition: "opacity 0.18s ease, transform 0.18s ease",
      }}
    >
      <div
        className="w-full text-center truncate px-14 pb-3 text-[15px] font-semibold"
        style={{ color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}
      >
        {judul}
      </div>
    </div>
  );
}
