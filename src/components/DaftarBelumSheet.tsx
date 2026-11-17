import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { C, jenjangOf } from "../data";

export type BelumRinci = { kelas: string; guru: string; ket?: string };

/** Lembar daftar "belum mengisi" untuk management: dipisah per jenjang (Kuttab Awwal / Qonuni), tiap baris memuat
 *  nama guru dan kelasnya, supaya mudah dihubungi satu per satu. Tombol "Salin daftar" menyalin teks siap tempel (WA). */
export function DaftarBelumSheet({ judul, sub, rincian, sebagian, tutup }: { judul: string; sub?: string; rincian: BelumRinci[]; sebagian?: BelumRinci[]; tutup: () => void }) {
  const [tersalin, setTersalin] = useState(false);

  useEffect(() => {
    const tombol = (e: KeyboardEvent) => e.key === "Escape" && tutup();
    window.addEventListener("keydown", tombol);
    const awal = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tombol);
      document.body.style.overflow = awal;
    };
  }, [tutup]);

  const bagi = (daftar: BelumRinci[]) => {
    const k = [
      { nama: "Kuttab Awwal", isi: daftar.filter((r) => jenjangOf(r.kelas) === "Kuttab Awwal") },
      { nama: "Qonuni", isi: daftar.filter((r) => jenjangOf(r.kelas) === "Qonuni") },
    ];
    const lain = daftar.filter((r) => !jenjangOf(r.kelas));
    if (lain.length) k.push({ nama: "Lainnya", isi: lain });
    return k;
  };
  // Dua bagian: belum mengisi sama sekali, dan sudah mengisi tapi belum lengkap (hanya kalau kartunya punya data itu).
  const bagian = [
    { judul: sebagian ? "Belum mengisi sama sekali" : "", kunci: "kosong", daftar: rincian },
    ...(sebagian ? [{ judul: "Sudah mengisi, belum lengkap", kunci: "sebagian", daftar: sebagian }] : []),
  ].map((b) => ({ ...b, kelompok: bagi(b.daftar) }));
  const jumlah = rincian.length + (sebagian?.length ?? 0);

  async function salin() {
    const baris = (r: BelumRinci, i: number) => `${i + 1}. ${r.guru ? `${r.guru} — ` : ""}${r.kelas}${r.ket ? ` (${r.ket})` : ""}`;
    const teks =
      `${judul}${sub ? ` (${sub})` : ""}` +
      bagian
        .filter((b) => b.daftar.length)
        .map(
          (b) =>
            `\n\n${b.judul || "Belum mengisi"} (${b.daftar.length} kelas)` +
            b.kelompok
              .filter((g) => g.isi.length)
              .map((g) => `\n${g.nama}:\n` + g.isi.map(baris).join("\n"))
              .join("")
        )
        .join("");
    try {
      await navigator.clipboard.writeText(teks);
      setTersalin(true);
      setTimeout(() => setTersalin(false), 2000);
    } catch {
      /* clipboard diblokir: abaikan */
    }
  }

  // Lewat portal ke <body>: kartu geser memakai animasi (transform) yang akan mengurung lapisan "fixed" di dalam kartu.
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={`Belum mengisi ${judul}`}>
      <button type="button" aria-label="Tutup" onClick={tutup} className="absolute inset-0" style={{ background: "rgba(10,25,20,0.5)" }} />
      <div className="relative w-full sm:max-w-md max-h-[82dvh] flex flex-col rounded-t-3xl sm:rounded-3xl overflow-hidden" style={{ background: C.card, boxShadow: "0 -8px 40px rgba(0,0,0,0.25)" }}>
        <div className="px-5 pt-4 pb-3 shrink-0" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="mx-auto w-10 h-1 rounded-full mb-3 sm:hidden" style={{ background: C.line }} aria-hidden="true" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: C.green }}>
                Belum mengisi
              </div>
              <div className="text-lg font-semibold leading-tight" style={{ color: C.ink, fontFamily: "Georgia, 'Times New Roman', serif" }}>
                {judul}
              </div>
              {sub && (
                <div className="text-xs mt-0.5" style={{ color: C.muted }}>
                  {sub} · {jumlah} kelas
                </div>
              )}
            </div>
            <button type="button" onClick={tutup} aria-label="Tutup" className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: C.mist, color: C.muted, border: `1px solid ${C.line}` }}>
              ✕
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-5 py-3 space-y-4">
          {bagian.map((b) => (
            <div key={b.kunci} className="space-y-4">
              {b.judul && (
                <div className="flex items-center gap-2 pt-1">
                  <h2 className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: C.ink }}>
                    {b.judul}
                  </h2>
                  <span className="flex-1 h-px" style={{ background: C.line }} aria-hidden="true" />
                </div>
              )}
              {b.kelompok.map((g) => (
            <section key={g.nama}>
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-sm font-bold" style={{ color: C.green }}>
                  {g.nama}
                </h3>
                <span
                  className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                  style={g.isi.length ? { background: "var(--c-bahayaBg)", color: "var(--c-bahayaTeks)" } : { background: C.leaf, color: C.green }}
                >
                  {g.isi.length ? `${g.isi.length} ${b.kunci === "sebagian" ? "belum lengkap" : "belum"}` : "semua sudah ✓"}
                </span>
              </div>
              {g.isi.length > 0 && (
                <ul className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
                  {g.isi.map((r, i) => (
                    <li key={r.kelas} className="flex items-center gap-3 px-3.5 py-2.5" style={{ borderTop: i ? `1px solid ${C.line}` : undefined }}>
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0" style={{ background: C.mist, color: C.muted }}>
                        {i + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold truncate" style={{ color: C.ink }}>
                          {r.guru || r.kelas}
                        </span>
                        {r.guru && (
                          <span className="block text-xs" style={{ color: C.muted }}>
                            {r.kelas}
                          </span>
                        )}
                        {r.ket && (
                          <span className="block text-xs" style={{ color: "var(--c-emasTeks)" }}>
                            {r.ket}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
              ))}
            </div>
          ))}
        </div>

        <div className="px-5 py-3 shrink-0 flex gap-2" style={{ borderTop: `1px solid ${C.line}`, paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}>
          <button type="button" onClick={salin} className="flex-1 py-2.5 rounded-xl text-sm font-bold" style={{ background: C.green, color: "#FFF" }}>
            {tersalin ? "Tersalin ✓" : "Salin daftar"}
          </button>
          <button type="button" onClick={tutup} className="px-5 py-2.5 rounded-xl text-sm font-bold" style={{ background: C.mist, color: C.green, border: `1px solid ${C.line}` }}>
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
