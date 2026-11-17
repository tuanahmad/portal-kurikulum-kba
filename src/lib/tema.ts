// Tema tampilan: "otomatis" (ikut pengaturan HP, bawaan), "terang", "gelap". Pilihan disimpan di HP (localStorage "tema").
// Warna aplikasi = variabel CSS --c-* di index.html; atribut data-tema di <html> menentukan set mana yang dipakai.
export type PilihanTema = "otomatis" | "terang" | "gelap";
const KUNCI = "tema";
const GELAP_MIST = "#0F1713";

export function bacaPilihan(): PilihanTema {
  try {
    const p = localStorage.getItem(KUNCI);
    return p === "terang" || p === "gelap" ? p : "otomatis";
  } catch {
    return "otomatis";
  }
}

const sistemGelap = () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;

export function terapkanTema(p: PilihanTema = bacaPilihan()) {
  const gelap = p === "gelap" || (p === "otomatis" && sistemGelap());
  document.documentElement.setAttribute("data-tema", gelap ? "gelap" : "terang");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", gelap ? GELAP_MIST : getComputedStyle(document.documentElement).getPropertyValue("--c-mist").trim() || "#FBFAF7");
}

export function simpanPilihan(p: PilihanTema) {
  try {
    if (p === "otomatis") localStorage.removeItem(KUNCI);
    else localStorage.setItem(KUNCI, p);
  } catch {
    /* abaikan */
  }
  terapkanTema(p);
}

/** Dipanggil sekali saat aplikasi mulai: pasang tema dan ikuti perubahan pengaturan HP selama pilihannya "otomatis". */
export function mulaiTema() {
  terapkanTema();
  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
    if (bacaPilihan() === "otomatis") terapkanTema("otomatis");
  });
}
