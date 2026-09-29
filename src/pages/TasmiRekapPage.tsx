import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { C, KELAS_LIST } from "../data";
import { readTasmiRekapTahun, type TasmiRekapRow } from "../lib/tasmi";
import { PageLoadingSkeleton } from "../components/Skeleton";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

/** Angka pertama yang ketemu di teks juz (mis. "Juz 29" -> 29, "5 (Al-Maidah)" -> 5) -- guru
 *  nulis juz bebas teks, bukan angka murni, jadi diparsing longgar buat dirata-ratakan. */
function parseJuzNumber(juz: string): number | null {
  const m = juz.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

type SantriStat = { nama: string; juzList: string[] };
type KelasStat = { kelas: string; santriList: SantriStat[] };

function computeStats(rows: TasmiRekapRow[]): KelasStat[] {
  return KELAS_LIST.map(({ name }) => {
    const rowsKelas = rows.filter((r) => r.kelas === name);
    const byNama = new Map<string, string[]>();
    for (const r of rowsKelas) {
      const juz = r.juz.trim();
      const existing = byNama.get(r.nama_santri);
      if (existing) {
        if (juz && !existing.includes(juz)) existing.push(juz);
      } else {
        byNama.set(r.nama_santri, juz ? [juz] : []);
      }
    }
    const santriList = Array.from(byNama.entries())
      .map(([nama, juzList]) => ({
        nama,
        juzList: juzList.sort((a, b) => (parseJuzNumber(a) ?? 0) - (parseJuzNumber(b) ?? 0)),
      }))
      .sort((a, b) => a.nama.localeCompare(b.nama));
    return { kelas: name, santriList };
  });
}

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
  const kelasKosong = stats.filter((s) => s.santriList.length === 0);

  return (
    <div className="min-h-dvh" style={{ background: C.mist, color: C.ink }}>
      <div className="max-w-2xl mx-auto px-4 pt-6 sm:pt-9 pb-28">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/capaian")}
            aria-label="Kembali"
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "#FFF", border: `1px solid ${C.line}`, color: C.green }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="min-w-0">
            <h1
              className="text-lg sm:text-xl font-semibold truncate"
              style={{ color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
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
                style={{
                  background: active ? C.green : "#FFF",
                  color: active ? "#FFF" : C.ink,
                  border: `1px solid ${active ? C.green : C.line}`,
                }}
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
          <div className="mt-5 space-y-5">
            {/* Ringkasan kelas yang belum tasmi' */}
            <div
              className="rounded-2xl p-4 sm:p-5"
              style={{
                background: kelasKosong.length > 0 ? "#FDEBEA" : C.leaf,
                border: `1px solid ${kelasKosong.length > 0 ? "#E8A6A0" : C.green}`,
              }}
            >
              <div className="text-sm font-bold" style={{ color: kelasKosong.length > 0 ? "#8A2A20" : C.green }}>
                {kelasKosong.length > 0
                  ? `${kelasKosong.length} dari ${KELAS_LIST.length} kelas belum ada tasmi' di tahun ${year}`
                  : `Semua ${KELAS_LIST.length} kelas sudah ada tasmi' di tahun ${year} 🎉`}
              </div>
              {kelasKosong.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {kelasKosong.map((s) => (
                    <span
                      key={s.kelas}
                      className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: "#FFF", color: "#8A2A20", border: "1px solid #E8A6A0" }}
                    >
                      {s.kelas}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Daftar santri per kelas */}
            <div className="space-y-3">
              {stats
                .filter((s) => s.santriList.length > 0)
                .map((s) => (
                  <div key={s.kelas} className="rounded-2xl p-4" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-bold" style={{ color: C.green }}>{s.kelas}</span>
                      <span className="text-xs shrink-0" style={{ color: C.muted }}>
                        {s.santriList.length} santri
                      </span>
                    </div>
                    <ul className="mt-2.5 space-y-1.5">
                      {s.santriList.map((st) => (
                        <li key={st.nama} className="flex items-baseline justify-between gap-3 text-sm">
                          <span style={{ color: C.ink }}>{st.nama}</span>
                          <span className="text-right shrink-0" style={{ color: "#B3801E", fontWeight: 600 }}>
                            {st.juzList.length ? st.juzList.join(", ") : "—"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
