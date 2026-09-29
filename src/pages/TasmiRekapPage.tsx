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

type KelasStat = {
  kelas: string;
  jumlahSantri: number;
  rataJuz: number | null;
  juzList: string[];
};

function computeStats(rows: TasmiRekapRow[]): KelasStat[] {
  return KELAS_LIST.map(({ name }) => {
    const rowsKelas = rows.filter((r) => r.kelas === name);
    const juzNums = rowsKelas.map((r) => parseJuzNumber(r.juz)).filter((n): n is number => n != null);
    const santriUnik = new Set(rowsKelas.map((r) => r.nama_santri));
    const juzUnik = Array.from(new Set(rowsKelas.map((r) => r.juz.trim()).filter(Boolean))).sort(
      (a, b) => (parseJuzNumber(a) ?? 0) - (parseJuzNumber(b) ?? 0)
    );
    return {
      kelas: name,
      jumlahSantri: santriUnik.size,
      rataJuz: juzNums.length ? juzNums.reduce((a, b) => a + b, 0) / juzNums.length : null,
      juzList: juzUnik,
    };
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
  const kelasKosong = stats.filter((s) => s.jumlahSantri === 0);

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

            {/* Tabel per kelas */}
            <div className="rounded-2xl overflow-hidden" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: C.leaf }}>
                    <th className="text-left font-semibold px-3.5 py-2.5" style={{ color: C.muted }}>Kelas</th>
                    <th className="text-center font-semibold px-2 py-2.5" style={{ color: C.muted }}>Santri</th>
                    <th className="text-center font-semibold px-2 py-2.5" style={{ color: C.muted }}>Rata² Juz</th>
                    <th className="text-left font-semibold px-2 py-2.5" style={{ color: C.muted }}>Juz</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s) => (
                    <tr key={s.kelas} style={{ borderTop: `1px solid ${C.line}` }}>
                      <td className="px-3.5 py-2.5 truncate" style={{ color: s.jumlahSantri === 0 ? C.muted : C.ink }}>
                        {s.kelas}
                      </td>
                      <td className="text-center px-2 py-2.5 font-semibold" style={{ color: s.jumlahSantri === 0 ? C.muted : C.green }}>
                        {s.jumlahSantri}
                      </td>
                      <td className="text-center px-2 py-2.5" style={{ color: C.muted }}>
                        {s.rataJuz != null ? s.rataJuz.toFixed(1) : "—"}
                      </td>
                      <td className="px-2 py-2.5" style={{ color: C.muted }}>
                        {s.juzList.length ? s.juzList.join(", ") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px]" style={{ color: C.muted }}>
              "Santri" = jumlah santri berbeda yang sudah tasmi' di tahun ini (bukan jumlah catatan). "Juz" = daftar juz yang pernah ditasmi'kan di kelas itu. Rata² Juz dihitung dari angka yang ketemu di teks juz tiap catatan (mis. "Juz 29" → 29).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
