import { useEffect, useMemo, useState } from "react";
import { C, KELAS_LIST } from "../data";
import { PageLoadingSkeleton } from "./Skeleton";
import {
  readJurnalHari,
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

function BackArrowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
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

export default function JurnalPerHari({ onBack }: { onBack: () => void }) {
  const hariIni = useMemo(() => {
    const n = new Date();
    const d = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1); // akhir pekan -> Jumat terakhir
    return d;
  }, []);
  const [tgl, setTgl] = useState<Date>(hariIni);
  const [items, setItems] = useState<JurnalHariItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-full mb-4 transition-colors hover:opacity-80"
        style={{ background: C.leaf, color: C.green, border: `1px solid ${C.green}` }}
      >
        <BackArrowIcon />
        Preview Jurnal per Hari
      </button>

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

      {items && (
        <>
          <p className="mt-4 text-xs px-1" style={{ color: C.muted }}>
            <span className="font-semibold" style={{ color: C.ink }}>{terisi}</span> dari{" "}
            <span className="font-semibold" style={{ color: C.ink }}>{items.length}</span> guru sudah mengisi jurnal pada hari ini.
          </p>
          <div className="mt-3 space-y-3">
            {items.map((it) => {
              const isi = isEntryFilled(it.entry);
              return (
                <article key={it.userId} className="rounded-2xl p-3.5" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
                  <div className="flex items-center gap-3">
                    <span
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold"
                      style={{ background: isi ? C.green : C.leaf, color: isi ? "#FFF" : C.green }}
                    >
                      {(it.nama || it.kelas).trim().charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate" style={{ color: C.ink }}>{it.nama}</div>
                      <div className="text-xs truncate" style={{ color: C.muted }}>{it.kelas}</div>
                    </div>
                    <span
                      className="text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0"
                      style={isi ? { background: C.leaf, color: C.green, border: `1px solid ${C.green}` } : { background: "#F4F1EC", color: C.muted }}
                    >
                      {isi ? "Terisi" : "Belum mengisi"}
                    </span>
                  </div>

                  {isi && (
                    <div className="mt-3 space-y-3">
                      {PERTANYAAN_JURNAL.map((q) => {
                        const v = (it.entry as NonNullable<typeof it.entry>)[q.key]?.trim();
                        return (
                          <div key={q.key}>
                            <div className="text-[11px] font-semibold leading-snug" style={{ color: C.green }}>{q.label}</div>
                            <div className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap break-words" style={{ color: v ? C.ink : C.muted }}>
                              {v || "—"}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
