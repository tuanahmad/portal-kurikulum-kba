import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { C, CAPAIAN_QURAN_FILES_DEV, capaianRoster, isMonthOpen } from "../data";
import { useAuth } from "../contexts/AuthContext";
import { readCapaianQuran, type CapaianQuranData } from "../lib/capaianQuranSheet";
import { PageLoadingSkeleton } from "../components/Skeleton";

const BULAN_LIST = ["Juli", "Agustus", "September", "Oktober", "November", "Desember"];

// Warna per section (fallback cycle kalau ada section tak terduga)
const SECTION_COLORS: Record<string, string> = {
  "talaqqi al-qur'an": "#1C4A33",
  "ziyadah al-qur'an": "#1C4A33",
  baghdadiyah: "#C79A3B",
  murojaah: "#3B6EA5",
  wirid: "#7A5AA6",
  tilawah: "#2F8F83",
};
const FALLBACK_COLORS = ["#1C4A33", "#C79A3B", "#3B6EA5", "#7A5AA6", "#2F8F83", "#B5563F"];

function colorFor(name: string, idx: number): string {
  return SECTION_COLORS[name.toLowerCase().replace(/\s+/g, " ").trim()] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

/** "0,5" -> 0.5 ; "-" / "" / non-angka -> 0 */
function parseNum(s: string): number {
  const v = parseFloat(String(s ?? "").replace(",", ".").trim());
  return Number.isFinite(v) ? v : 0;
}

type Series = {
  section: string;
  color: string;
  type: "pertemuan" | "pekan";
  weeks: number[];
  /** cuma plot pekan 1..weekCount (biar garis berhenti di data terakhir, bukan jatuh ke 0). */
  weekCount: number;
  hasData: boolean;
};

function isFilled(v: string | undefined): boolean {
  const t = String(v ?? "").trim();
  return t !== "" && t !== "-";
}

/** Hitung total per pekan tiap section buat 1 anak (berdasarkan posisi di roster).
 *  - section "pertemuan": pekan k = jumlah pertemuan (5k-4 .. 5k), 5 pekan.
 *  - section "pekan" (Wirid): pekan k = nilai slot ke-k langsung, 4 pekan. */
function seriesForStudent(data: CapaianQuranData, studentIndex: number): Series[] {
  return data.sections.map((sec, i) => {
    const vals = sec.students[studentIndex]?.values ?? [];
    const hasData = vals.some(isFilled);
    let weeks: number[];
    let weekCount = 0;
    if (sec.type === "pekan") {
      const n = Math.min(sec.slotCount, 5);
      weeks = Array.from({ length: n }, (_, k) => parseNum(vals[k] ?? ""));
      for (let k = 0; k < n; k++) if (isFilled(vals[k])) weekCount = k + 1;
    } else {
      weeks = Array.from({ length: 5 }, (_, k) => {
        let sum = 0;
        for (let p = k * 5; p < k * 5 + 5; p++) sum += parseNum(vals[p] ?? "");
        return sum;
      });
      for (let k = 0; k < 5; k++) {
        for (let p = k * 5; p < k * 5 + 5; p++) if (isFilled(vals[p])) { weekCount = k + 1; break; }
      }
    }
    return { section: sec.name, color: colorFor(sec.name, i), type: sec.type, weeks, weekCount, hasData };
  });
}

/** True kalau ada anak/section yang minimal pekan 1-nya udah keisi (buat gating "muncul otomatis
 *  ketika sudah 1 pekan"). */
function anyWeekFilled(data: CapaianQuranData): boolean {
  return data.sections.some((s) => s.students.some((st) => (st.values ?? []).slice(0, 5).some((v) => String(v ?? "").trim() !== "" && String(v).trim() !== "-")));
}

export default function CapaianQuranDiagramPage() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const { kelas: authKelas, role } = useAuth();

  // guru -> kelasnya sendiri; management -> dari query ?kelas=
  const kelas = role === "guru" ? authKelas : sp.get("kelas");
  const fileId = kelas ? CAPAIAN_QURAN_FILES_DEV[kelas] : undefined;
  const roster = useMemo(() => (kelas ? capaianRoster(kelas) : []), [kelas]);

  const [bulan, setBulan] = useState<string | null>(null);
  const [data, setData] = useState<CapaianQuranData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bulan || !fileId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    readCapaianQuran(fileId, bulan)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [bulan, fileId]);

  if (!kelas) {
    return <Navigate to="/capaian" replace />;
  }
  if (!fileId) {
    return <Navigate to="/capaian" replace />;
  }

  const ready = data && anyWeekFilled(data);

  return (
    <div className="min-h-dvh" style={{ background: C.mist, color: C.ink }}>
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-9 pb-28">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(role === "guru" ? "/capaian/quran" : "/capaian")}
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
              Diagram Perkembangan Al-Qur'an
            </h1>
            <p className="text-sm" style={{ color: C.muted }}>{kelas}</p>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          <div>
            <div className="text-sm font-semibold mb-2.5" style={{ color: C.ink }}>Pilih bulan</div>
            <div className="flex flex-wrap gap-2">
              {BULAN_LIST.map((b) => {
                const open = isMonthOpen(b);
                const active = b === bulan;
                return (
                  <button
                    key={b}
                    disabled={!open}
                    onClick={() => setBulan(active ? null : b)}
                    className="text-sm font-medium px-3.5 py-2 rounded-xl transition-colors"
                    style={{
                      background: active ? C.green : open ? "#FFF" : C.leaf,
                      color: active ? "#FFF" : open ? C.ink : C.muted,
                      border: `1px solid ${active ? C.green : C.line}`,
                      opacity: open ? 1 : 0.6,
                      cursor: open ? "pointer" : "not-allowed",
                    }}
                  >
                    {b}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="rounded-xl px-3.5 py-2.5 text-xs" style={{ background: "#FDEBEA", border: "1px solid #E8A6A0", color: "#8A2A20" }}>
              {error}
            </div>
          )}
          {loading && <PageLoadingSkeleton />}

          {data && !loading && !ready && (
            <div className="rounded-2xl p-5 text-sm text-center" style={{ background: "#FFF", border: `1px solid ${C.line}`, color: C.muted }}>
              Belum ada capaian yang diisi untuk {bulan}. Diagram muncul otomatis setelah ada isian
              minimal 1 pekan.
            </div>
          )}

          {data && !loading && ready && (
            <>
              <Legend sections={data.sections.map((s, i) => ({ name: s.name, color: colorFor(s.name, i) }))} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {roster.map((nama, i) => {
                  const series = seriesForStudent(data, i).filter((s) => s.hasData);
                  return (
                    <div key={i} className="rounded-2xl p-4" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
                      <div className="text-sm font-semibold mb-2" style={{ color: C.ink }}>
                        {i + 1}. {nama}
                      </div>
                      {series.length === 0 ? (
                        <p className="text-xs" style={{ color: C.muted }}>Belum ada data.</p>
                      ) : (
                        <MiniLineChart series={series} />
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Legend({ sections }: { sections: { name: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 rounded-xl px-3.5 py-2.5" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
      {sections.map((s) => (
        <span key={s.name} className="inline-flex items-center gap-1.5 text-xs" style={{ color: C.ink }}>
          <span className="w-3 h-[3px] rounded-full" style={{ background: s.color }} />
          {s.name}
        </span>
      ))}
    </div>
  );
}

function MiniLineChart({ series }: { series: Series[] }) {
  const W = 260;
  const H = 128;
  const padL = 22;
  const padR = 8;
  const padT = 8;
  const padB = 18;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxVal = Math.max(
    5,
    ...series.flatMap((s) => s.weeks.slice(0, Math.max(1, s.weekCount)))
  );
  const xFor = (weekIdx: number) => padL + (plotW * weekIdx) / 4; // 5 titik: pekan 1..5 -> idx 0..4
  const yFor = (v: number) => padT + plotH - (plotH * v) / maxVal;

  // gridlines Y (0, tengah, atas)
  const yTicks = [0, Math.round(maxVal / 2), Math.round(maxVal)];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Grafik perkembangan per pekan">
      {yTicks.map((t) => (
        <g key={t}>
          <line x1={padL} y1={yFor(t)} x2={W - padR} y2={yFor(t)} stroke={C.line} strokeWidth={1} />
          <text x={padL - 5} y={yFor(t) + 3} textAnchor="end" fontSize={9} fill={C.muted}>
            {t}
          </text>
        </g>
      ))}
      {[0, 1, 2, 3, 4].map((k) => (
        <text key={k} x={xFor(k)} y={H - 5} textAnchor="middle" fontSize={9} fill={C.muted}>
          P{k + 1}
        </text>
      ))}
      {series.map((s) => {
        const shown = s.weeks.slice(0, Math.max(1, s.weekCount));
        const pts = shown.map((v, k) => `${xFor(k)},${yFor(v)}`).join(" ");
        return (
          <g key={s.section}>
            {shown.length > 1 && (
              <polyline points={pts} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            )}
            {shown.map((v, k) => (
              <circle key={k} cx={xFor(k)} cy={yFor(v)} r={2.5} fill={s.color} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
