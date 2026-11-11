import { useEffect, useMemo, useState } from "react";
import { C, KELAS_LIST, jenjangOf } from "../data";
import { PageLoadingSkeleton } from "./Skeleton";
import {
  readJurnalHari,
  readJurnalRange,
  ymd,
  NAMA_BULAN,
  labelHari,
  labelTanggal,
  isEntryFilled,
  PERTANYAAN_JURNAL,
  type JurnalHariItem,
} from "../lib/jurnal";

/** Preview jurnal SEMUA guru pada SATU hari (hanya baca, untuk management). Urut menurut kelas; teks ditampilkan penuh. */

function geserHariKerja(d: Date, arah: -1 | 1): Date {
  const x = new Date(d);
  do {
    x.setDate(x.getDate() + arah);
  } while (x.getDay() === 0 || x.getDay() === 6);
  return x;
}

function ArrowBtn({ dir, disabled, onClick }: { dir: "prev" | "next"; disabled?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "prev" ? "Hari sebelumnya" : "Hari berikutnya"}
      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
      style={{
        background: "#FFF",
        border: `1px solid ${C.line}`,
        color: C.green,
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ transform: dir === "next" ? "rotate(180deg)" : "none" }}>
        <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

const JENJANG_JURNAL = ["Kuttab Awwal", "Qonuni"] as const;

/** Tombol unduh PDF jurnal sebulan (ikon + "PDF"), kecil supaya tidak berulang besar di tiap guru. */
function TombolPdf({ onClick, sibuk, bulan }: { onClick: () => void; sibuk: boolean; bulan: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={sibuk}
      title={`Download PDF jurnal ${bulan}`}
      aria-label={`Download PDF jurnal ${bulan}`}
      className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-full active:scale-95 transition-transform"
      style={{ background: C.leaf, color: C.green, border: `1px solid ${C.green}`, opacity: sibuk ? 0.6 : 1 }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {sibuk ? "…" : "PDF"}
    </button>
  );
}

export default function JurnalPerHari() {
  const hariIni = useMemo(() => {
    const n = new Date();
    const d = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1); // akhir pekan -> Jumat terakhir
    return d;
  }, []);
  const [tgl, setTgl] = useState<Date>(hariIni);
  const [items, setItems] = useState<JurnalHariItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  /** PDF jurnal SEBULAN (bulan dari tanggal yang sedang dilihat) untuk satu guru. */
  async function unduhPdf(it: JurnalHariItem) {
    setPdfBusy(it.userId);
    setPdfError(null);
    try {
      const yy = tgl.getFullYear();
      const mm = tgl.getMonth();
      const entriBulan = await readJurnalRange(ymd(new Date(yy, mm, 1)), ymd(new Date(yy, mm + 1, 0)), { kelas: it.kelas });
      const { unduhPdfJurnalBulanan } = await import("../lib/jurnalPdf");
      await unduhPdfJurnalBulanan({ guruNama: it.nama, kelas: it.kelas, year: yy, month0: mm, entries: entriBulan });
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : "Gagal membuat PDF.");
    } finally {
      setPdfBusy(null);
    }
  }

  const atHariIni = tgl.getTime() >= hariIni.getTime();

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError(null);
    readJurnalHari(tgl, KELAS_LIST.map((k) => k.name))
      .then((r) => !cancelled && setItems(r))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Gagal memuat jurnal."));
    return () => {
      cancelled = true;
    };
  }, [tgl]);

  const terisi = items ? items.filter((i) => isEntryFilled(i.entry)).length : 0;

  return (
    <main className="mt-6">
      <div className="flex items-center gap-2">
        <ArrowBtn dir="prev" onClick={() => setTgl(geserHariKerja(tgl, -1))} />
        <div className="flex-1 text-center rounded-xl px-3 py-2" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
          <div className="text-sm font-semibold" style={{ color: C.ink }}>
            {labelHari(tgl)}, {labelTanggal(tgl)}
          </div>
          <div className="text-[11px]" style={{ color: C.green }}>
            {atHariIni ? "Hari kerja terbaru" : " "}
          </div>
        </div>
        <ArrowBtn dir="next" disabled={atHariIni} onClick={() => setTgl(geserHariKerja(tgl, 1))} />
      </div>

      {error && (
        <div className="mt-4 rounded-xl px-3.5 py-2.5 text-xs" style={{ background: "#FDEBEA", border: "1px solid #E8A6A0", color: "#8A2A20" }}>
          {error}
        </div>
      )}

      {!items && !error && (
        <div className="mt-5">
          <PageLoadingSkeleton />
        </div>
      )}

      {pdfError && (
        <div className="mt-4 rounded-xl px-3.5 py-2.5 text-xs" style={{ background: "#FDEBEA", border: "1px solid #E8A6A0", color: "#8A2A20" }}>
          {pdfError}
        </div>
      )}

      {items && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl py-2.5" style={{ background: C.leaf }}>
              <div className="text-2xl font-semibold leading-none" style={{ color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}>{terisi}</div>
              <div className="text-[11px] mt-1" style={{ color: C.muted }}>sudah mengisi</div>
            </div>
            <div className="rounded-xl py-2.5" style={{ background: items.length - terisi > 0 ? "#FDEBEA" : C.leaf }}>
              <div className="text-2xl font-semibold leading-none" style={{ color: items.length - terisi > 0 ? "#9F240B" : C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}>{items.length - terisi}</div>
              <div className="text-[11px] mt-1" style={{ color: C.muted }}>belum mengisi</div>
            </div>
          </div>

          {/* Sudah mengisi: isi jurnal ditampilkan penuh, dikelompokkan per jenjang */}
          {JENJANG_JURNAL.map((j) => {
            const daftar = items.filter((it) => isEntryFilled(it.entry) && jenjangOf(it.kelas) === j);
            if (!daftar.length) return null;
            return (
              <section key={`isi-${j}`} className="mt-5">
                <h2 className="text-sm font-bold mb-2" style={{ color: C.green }}>{j} · {daftar.length} sudah mengisi</h2>
                <div className="space-y-3">
                  {daftar.map((it) => (
                    <article key={it.userId} className="rounded-2xl p-3.5" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
                      <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold" style={{ background: C.green, color: "#FFF" }}>
                          {(it.nama || it.kelas).trim().charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold truncate" style={{ color: C.ink }}>{it.nama}</div>
                          <div className="text-xs truncate" style={{ color: C.muted }}>{it.kelas}</div>
                        </div>
                        <TombolPdf onClick={() => unduhPdf(it)} sibuk={pdfBusy === it.userId} bulan={NAMA_BULAN[tgl.getMonth()]} />
                      </div>
                      <div className="mt-3 space-y-3">
                        {PERTANYAAN_JURNAL.map((q) => {
                          const v = (it.entry as NonNullable<typeof it.entry>)[q.key]?.trim();
                          return (
                            <div key={q.key} className="rounded-xl px-3 py-2" style={{ background: C.mist }}>
                              <div className="text-[11px] font-bold leading-snug" style={{ color: C.green }}>{q.label}</div>
                              <div className="mt-1 text-sm leading-relaxed whitespace-pre-wrap break-words" style={{ color: v ? C.ink : C.muted }}>
                                {v || "—"}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}

          {/* Belum mengisi: daftar ringkas per jenjang (nama + kelas), tanpa kartu besar */}
          {items.length - terisi > 0 && (
            <section className="mt-6">
              <h2 className="text-sm font-bold mb-2" style={{ color: "#9F240B" }}>Belum mengisi · {items.length - terisi}</h2>
              <div className="space-y-3">
                {JENJANG_JURNAL.map((j) => {
                  const daftar = items.filter((it) => !isEntryFilled(it.entry) && jenjangOf(it.kelas) === j);
                  if (!daftar.length) return null;
                  return (
                    <div key={`kosong-${j}`}>
                      <div className="text-xs font-semibold mb-1" style={{ color: C.muted }}>{j} · {daftar.length} kelas</div>
                      <ul className="rounded-2xl overflow-hidden" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
                        {daftar.map((it, i) => (
                          <li key={it.userId} className="flex items-center gap-3 px-3.5 py-2.5" style={{ borderTop: i ? `1px solid ${C.line}` : undefined }}>
                            <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold" style={{ background: "#FDEBEA", color: "#9F240B" }}>
                              {(it.nama || it.kelas).trim().charAt(0).toUpperCase()}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold truncate" style={{ color: C.ink }}>{it.nama}</div>
                              <div className="text-xs truncate" style={{ color: C.muted }}>{it.kelas}</div>
                            </div>
                            <TombolPdf onClick={() => unduhPdf(it)} sibuk={pdfBusy === it.userId} bulan={NAMA_BULAN[tgl.getMonth()]} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
