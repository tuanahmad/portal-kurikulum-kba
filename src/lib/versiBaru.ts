// Penjaga versi: HP guru sering membiarkan aplikasi terbuka berhari-hari, jadi kode yang jalan bisa
// ketinggalan dari yang sudah di-deploy (mis. perbaikan bug belum ikut). Begitu aplikasi kembali ke layar,
// kita bandingkan nama berkas utama (ber-hash) yang sedang jalan dengan yang ada di index.html terbaru;
// kalau beda, muat ulang. Draf ketikan aman: sudah tersimpan otomatis di perangkat (lihat useDraft).

const KUNCI_GUARD = "portal-versi-reload";
const JEDA_CEK_MS = 60_000; // paling sering sekali semenit
const JEDA_RELOAD_MS = 5 * 60_000; // jangan muat ulang lagi dalam 5 menit (cegah loop)

const POLA_UTAMA = /\/assets\/index-[A-Za-z0-9_-]+\.js/;

/** Nama berkas utama (ber-hash) dari sebuah teks HTML; null kalau tidak ada (mis. mode dev). */
export function berkasUtama(html: string): string | null {
  return html.match(POLA_UTAMA)?.[0] ?? null;
}

/** true kalau berkas utama yang sedang jalan berbeda dengan yang ada di HTML terbaru. */
export function perluMuatUlang(berkasSaatIni: string | null, htmlTerbaru: string): boolean {
  const terbaru = berkasUtama(htmlTerbaru);
  return !!berkasSaatIni && !!terbaru && berkasSaatIni !== terbaru;
}

function boleh(): boolean {
  try {
    const t = Number(sessionStorage.getItem(KUNCI_GUARD) || 0);
    return Date.now() - t > JEDA_RELOAD_MS;
  } catch {
    return true;
  }
}

export function muatUlangSekali() {
  if (!boleh()) return;
  try {
    sessionStorage.setItem(KUNCI_GUARD, String(Date.now()));
  } catch {
    /* abaikan */
  }
  window.location.reload();
}

export function pasangPenjagaVersi() {
  // Potongan kode yang dimuat belakangan sudah tidak ada di server (deploy baru) -> muat ulang sekali.
  window.addEventListener("vite:preloadError", (e) => {
    e.preventDefault();
    muatUlangSekali();
  });

  const berkasSaatIni = berkasUtama(
    Array.from(document.scripts)
      .map((s) => s.src)
      .join("\n")
  );
  if (!berkasSaatIni) return; // mode dev / tidak ada berkas ber-hash: tidak ada yang dicek

  let terakhirCek = 0;
  const cek = async () => {
    if (document.visibilityState !== "visible") return;
    if (Date.now() - terakhirCek < JEDA_CEK_MS) return;
    terakhirCek = Date.now();
    try {
      const r = await fetch(`/index.html?_=${Date.now()}`, { cache: "no-store" });
      if (!r.ok) return;
      if (perluMuatUlang(berkasSaatIni, await r.text())) muatUlangSekali();
    } catch {
      /* offline / gagal: abaikan, coba lagi nanti */
    }
  };
  document.addEventListener("visibilitychange", cek);
  window.addEventListener("focus", cek);
  window.addEventListener("online", cek);
}
