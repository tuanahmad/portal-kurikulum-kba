import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { C, KELAS_LIST, SERTIFIKAT_TASMI_AKTIF, jenjangOf } from "../data";
import { readTasmiRekapTahun, type TasmiRekapRow } from "../lib/tasmi";
import { PageLoadingSkeleton } from "../components/Skeleton";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

type TasmiEntry = { id: string; nama: string; juz: string; guru: string; kesalahan: number; tanggal: string };
type KelasStat = { kelas: string; entries: TasmiEntry[] };

function computeStats(rows: TasmiRekapRow[]): KelasStat[] {
  return KELAS_LIST.map(({ name }) => {
    const entries = rows
      .filter((r) => r.kelas === name)
      .map((r) => ({ id: r.id, nama: r.nama_santri, juz: r.juz.trim(), guru: r.nama_guru.trim(), kesalahan: r.jumlah_kesalahan, tanggal: r.tanggal }))
      .sort((a, b) => a.nama.localeCompare(b.nama));
    return { kelas: name, entries };
  });
}

/** "2026-10-12" -> "12 Okt 2026" */
function labelTgl(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00`);
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

const JENJANG: { nama: "Kuttab Awwal" | "Qonuni"; judul: string }[] = [
  { nama: "Kuttab Awwal", judul: "Kuttab Awwal" },
  { nama: "Qonuni", judul: "Qonuni" },
];

/** Rekap tasmi' per tahun untuk management: ringkasan di atas, lalu per jenjang -> per kelas -> satu baris per santri
 *  (nama, juz, penyimak, jumlah kesalahan, tanggal) dengan tombol unduh Syahadah. */
export default function TasmiRekapPage() {
  const navigate = useNavigate();
  const [year, setYear] = useState(CURRENT_YEAR);
  const [rows, setRows] = useState<TasmiRekapRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    readTasmiRekapTahun(year)
      .then((r) => !cancelled && setRows(r))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [year]);

  const stats = useMemo(() => computeStats(rows), [rows]);
  const kelasKosong = stats.filter((s) => s.entries.length === 0);
  const totalSantri = rows.length;

  return (
    <div className="min-h-dvh" style={{ background: C.mist, color: C.ink }}>
      <div className="max-w-2xl mx-auto px-4 pt-6 sm:pt-9 pb-28">
        <div className="relative flex flex-col items-center justify-center text-center px-12 min-h-[44px]">
          <button
            onClick={() => navigate(-1)}
            aria-label="Kembali"
            className="absolute left-0 inset-y-0 my-auto w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "#FFF", border: `1px solid ${C.line}`, color: C.green }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold" style={{ color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}>
              Rekap Tasmi' Tahunan
            </h1>
            <p className="text-sm" style={{ color: C.muted }}>Semua kelas</p>
          </div>
        </div>

        {/* Pilih tahun */}
        <div className="flex gap-2 mt-5">
          {YEAR_OPTIONS.map((y) => {
            const active = y === year;
            return (
              <button
                key={y}
                onClick={() => setYear(y)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                style={{ background: active ? C.green : "#FFF", color: active ? "#FFF" : C.ink, border: `1px solid ${active ? C.green : C.line}` }}
              >
                {y}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mt-4 rounded-xl px-3.5 py-2.5 text-xs" style={{ background: "#FDEBEA", border: "1px solid #E8A6A0", color: "#8A2A20" }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-5">
            <PageLoadingSkeleton />
          </div>
        ) : (
          <div className="mt-5 space-y-6">
            {/* Ringkasan: angka penting + kelas yang belum tasmi', dipisah per jenjang */}
            <section className="rounded-2xl p-4" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { angka: totalSantri, label: "tasmi' tercatat" },
                  { angka: KELAS_LIST.length - kelasKosong.length, label: "kelas sudah" },
                  { angka: kelasKosong.length, label: "kelas belum", merah: kelasKosong.length > 0 },
                ].map((x) => (
                  <div key={x.label} className="rounded-xl py-2.5" style={{ background: x.merah ? "#FDEBEA" : C.leaf }}>
                    <div className="text-2xl font-semibold leading-none" style={{ color: x.merah ? "#9F240B" : C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}>
                      {x.angka}
                    </div>
                    <div className="text-[11px] mt-1" style={{ color: C.muted }}>{x.label}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <div className="text-xs font-bold uppercase tracking-wider" style={{ color: kelasKosong.length ? "#9F240B" : C.green }}>
                  {kelasKosong.length ? `Belum ada tasmi' di ${year}` : `Semua kelas sudah ada tasmi' di ${year} 🎉`}
                </div>
                {kelasKosong.length > 0 && (
                  <div className="mt-2 space-y-2.5">
                    {JENJANG.map((j) => {
                      const kosong = kelasKosong.filter((s) => jenjangOf(s.kelas) === j.nama);
                      return (
                        <div key={j.nama}>
                          <div className="text-xs font-semibold mb-1" style={{ color: C.muted }}>
                            {j.judul} · {kosong.length ? `${kosong.length} kelas` : "semua sudah ✓"}
                          </div>
                          {kosong.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {kosong.map((s) => (
                                <span key={s.kelas} className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "#FDEBEA", color: "#8A2A20", border: "1px solid #E8A6A0" }}>
                                  {s.kelas}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            {/* Per jenjang -> per kelas -> satu baris per santri */}
            {/* Tidak ada satu pun catatan: ringkasan di atas sudah cukup, tidak perlu judul jenjang kosong */}
            {totalSantri > 0 && JENJANG.map((j) => (
              <section key={j.nama}>
                <h2 className="text-sm font-bold mb-2.5" style={{ color: C.green }}>{j.judul}</h2>
                {!stats.some((s) => jenjangOf(s.kelas) === j.nama && s.entries.length > 0) && (
                  <p className="text-xs" style={{ color: C.muted }}>Belum ada tasmi' tercatat di {year}.</p>
                )}
                <div className="space-y-3">
                  {stats
                    // kelas yang belum ada tasmi' sudah tercantum di ringkasan atas, tidak diulang di sini
                    .filter((s) => jenjangOf(s.kelas) === j.nama && s.entries.length > 0)
                    .map((s) => (
                      <div key={s.kelas} className="rounded-2xl overflow-hidden" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
                        <div className="flex items-center justify-between gap-2 px-4 py-2.5" style={{ background: s.entries.length ? C.leaf : "#FDEBEA" }}>
                          <div className="text-sm font-bold" style={{ color: s.entries.length ? C.green : "#9F240B" }}>{s.kelas}</div>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#FFF", color: s.entries.length ? C.green : "#9F240B" }}>
                            {s.entries.length ? `${s.entries.length} santri` : "belum ada"}
                          </span>
                        </div>
                        {s.entries.length === 0 ? (
                          <p className="px-4 py-3 text-xs" style={{ color: C.muted }}>Belum ada tasmi' tercatat di {year}.</p>
                        ) : (
                          <ul>
                            {s.entries.map((e, i) => (
                              <li key={e.id} className="px-4 py-3" style={{ borderTop: i ? `1px solid ${C.line}` : undefined }}>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold" style={{ color: C.ink }}>{e.nama}</div>
                                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: C.muted }}>
                                      <span>
                                        Juz: <b style={{ color: "#B3801E" }}>{e.juz || "—"}</b>
                                      </span>
                                      <span>Salah: <b style={{ color: C.ink }}>{e.kesalahan}</b></span>
                                      <span>{labelTgl(e.tanggal)}</span>
                                    </div>
                                    <div className="mt-0.5 text-xs" style={{ color: C.muted }}>Penyimak: {e.guru || "—"}</div>
                                  </div>
                                  {SERTIFIKAT_TASMI_AKTIF && (
                                    <Link
                                      to={`/capaian/tasmi/${e.id}/sertifikat?kelas=${encodeURIComponent(s.kelas)}`}
                                      className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full active:scale-95 transition-transform"
                                      style={{ background: C.green, color: "#FFF" }}
                                    >
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                        <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                      Syahadah
                                    </Link>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
