import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { C, capaianQuranFileId, capaianRoster, isMonthOpen, pekanCountForBulan } from "../data";
import { useAuth } from "../contexts/AuthContext";
import { readCapaianQuran, studentIndexFor, type CapaianQuranData } from "../lib/capaianQuranSheet";
import { PageLoadingSkeleton } from "../components/Skeleton";
import { MonthGrid } from "../components/MonthGrid";

const BULAN_LIST = ["Juli", "Agustus", "September", "Oktober", "November", "Desember", "Januari", "Februari", "Maret", "April", "Mei", "Juni"];

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

/** Satuan angka tiap section (buat keterangan di diagram). Talaqqi/Baghdadiyah/Ziyadah/
 *  Murojaah/Tilawah dihitung per baris; Wirid dihitung per putaran (berapa kali mengulang
 *  hafalan di pekan itu). */
function unitFor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("wirid")) return "putaran";
  if (
    n.includes("talaqqi") ||
    n.includes("baghdadiyah") ||
    n.includes("ziyadah") ||
    n.includes("muroja") ||
    n.includes("tilawah")
  ) {
    return "baris";
  }
  return "";
}

/** 2 -> "2" ; 0.5 -> "0,5" */
function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : String(v).replace(".", ",");
}

/** "0,5" -> 0.5 ; "-" / "" / non-angka -> 0 */
function parseNum(s: string): number {
  const v = parseFloat(String(s ?? "").replace(",", ".").trim());
  return Number.isFinite(v) ? v : 0;
}

/** True kalau isinya BUKAN angka (mis. "PT", "PT28", "TS") — kode yang sebagian guru tulis buat
 *  nandain "Persiapan Tasmi'"/"Tasmi'" dkk, bukan berarti kosong/nggak ada capaian. */
function isTextMarker(v: string | undefined): boolean {
  const t = String(v ?? "").trim();
  if (t === "" || t === "-") return false;
  return !/^\d+([.,]\d+)?$/.test(t);
}

type Series = {
  section: string;
  color: string;
  type: "pertemuan" | "pekan";
  weeks: number[];
  weekNotes: string[][]; // kode non-angka (PT/TS/dst) yang ketemu di tiap pekan, kalau ada
  hasData: boolean;
};

function isFilled(v: string | undefined): boolean {
  const t = String(v ?? "").trim();
  return t !== "" && t !== "-";
}

/** Hitung total per pekan tiap section buat 1 anak (berdasarkan posisi di roster). Selalu
 *  `weeksInMonth` pekan (4/5 sesuai kalender asli bulan itu — lihat pekanCountForBulan) —
 *  pekan yang kosong tetap ditampilkan sebagai 0, bukan dipotong, karena ketiadaan capaian
 *  di satu pekan itu sendiri adalah sinyal (anak nggak hadir / nggak ada capaian) yang perlu
 *  keliatan ke management, bukan disembunyikan.
 *  - section "pertemuan": pekan k = jumlah pertemuan (5k-4 .. 5k).
 *  - section "pekan" (Wirid): pekan k = nilai slot ke-k langsung. */
function seriesForStudent(data: CapaianQuranData, roster: string[], rosterIndex: number, weeksInMonth: number): Series[] {
  return data.sections.map((sec, i) => {
    const studentIndex = studentIndexFor(sec, roster, rosterIndex);
    const vals = studentIndex >= 0 ? sec.students[studentIndex]?.values ?? [] : [];
    const hasData = vals.some(isFilled);
    const weeks: number[] =
      sec.type === "pekan"
        ? Array.from({ length: weeksInMonth }, (_, k) => parseNum(vals[k] ?? ""))
        : Array.from({ length: weeksInMonth }, (_, k) => {
            let sum = 0;
            for (let p = k * 5; p < k * 5 + 5; p++) sum += parseNum(vals[p] ?? "");
            return sum;
          });
    const weekNotes: string[][] =
      sec.type === "pekan"
        ? Array.from({ length: weeksInMonth }, (_, k) => (isTextMarker(vals[k]) ? [String(vals[k]).trim()] : []))
        : Array.from({ length: weeksInMonth }, (_, k) => {
            const notes: string[] = [];
            for (let p = k * 5; p < k * 5 + 5; p++) {
              if (isTextMarker(vals[p])) notes.push(String(vals[p]).trim());
            }
            return notes;
          });
    return { section: sec.name, color: colorFor(sec.name, i), type: sec.type, weeks, weekNotes, hasData };
  });
}

/** Jumlah pekan yang SUDAH kepake isiannya (pertemuan 1-5 = pekan 1, 6-10 = pekan 2, dst) — dipakai
 *  biar diagram gak motong isian guru kalau bulannya cuma punya 4 hari Senin tapi guru ngisi sampai
 *  pertemuan 25 (pekan ke-5). */
function filledWeeks(data: CapaianQuranData): number {
  let max = 0;
  for (const sec of data.sections) {
    let lastSlot = 0;
    for (const st of sec.students) {
      (st.values ?? []).forEach((v, k) => { if (isFilled(v) && k + 1 > lastSlot) lastSlot = k + 1; });
    }
    const w = sec.type === "pekan" ? lastSlot : Math.ceil(lastSlot / 5);
    if (w > max) max = w;
  }
  return max;
}

/** True kalau ada anak/section yang minimal 1 slot udah keisi (buat gating "muncul otomatis
 *  ketika sudah ada isian"). */
function anyWeekFilled(data: CapaianQuranData): boolean {
  return data.sections.some((s) => s.students.some((st) => (st.values ?? []).some(isFilled)));
}

export default function CapaianQuranDiagramPage() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const { kelas: authKelas, role } = useAuth();

  // guru -> kelasnya sendiri; management -> dari query ?kelas=
  const kelas = role === "guru" ? authKelas : sp.get("kelas");
  const fileId = kelas ? capaianQuranFileId(kelas) : undefined;
  const roster = useMemo(() => (kelas ? capaianRoster(kelas) : []), [kelas]);

  const [bulan, setBulan] = useState<string | null>(null);
  const [data, setData] = useState<CapaianQuranData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const calendarWeeks = useMemo(() => (bulan ? pekanCountForBulan(bulan) : 5), [bulan]);
  // Tampilkan minimal sebanyak pekan kalender, tapi jangan pernah lebih sedikit dari pekan yang udah diisi.
  const weeksInMonth = useMemo(() => Math.max(calendarWeeks, data ? filledWeeks(data) : 0), [calendarWeeks, data]);

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
      <div className="max-w-3xl mx-auto px-4 pt-6 sm:pt-9 pb-28">
        <div className="flex items-center gap-3">
          <button
            onClick={() =>
              navigate(role === "guru" ? "/capaian/quran" : `/capaian?kelas=${encodeURIComponent(kelas ?? "")}`)
            }
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
            <MonthGrid
              months={BULAN_LIST}
              value={bulan}
              onSelect={(b) => setBulan(b === bulan ? null : b)}
              isOpen={isMonthOpen}
            />
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
              <p className="text-xs leading-relaxed" style={{ color: C.muted }}>
                Angka <b>Talaqqi</b>, <b>Baghdadiyah</b>, <b>Ziyadah</b> &amp; <b>Murojaah</b> dihitung dalam{" "}
                <b>baris</b>. <b>Wirid</b> dihitung dalam <b>putaran</b> — berapa kali mengulang hafalan pada
                pekan itu.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {roster.map((nama, i) => {
                  const series = seriesForStudent(data, roster, i, weeksInMonth).filter((s) => s.hasData);
                  return (
                    <div key={i} className="rounded-2xl p-4" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
                      <div className="text-sm font-semibold mb-3" style={{ color: C.ink }}>
                        {i + 1}. {nama}
                      </div>
                      {series.length === 0 ? (
                        <p className="text-xs" style={{ color: C.muted }}>Belum ada data.</p>
                      ) : (
                        <div className="space-y-3">
                          {series.map((s) => (
                            <SectionBars key={s.section} s={s} />
                          ))}
                        </div>
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

/** Satu baris = satu section, isinya diagram batang nilai per pekan (P1..Pn) + keterangan satuan. */
function SectionBars({ s }: { s: Series }) {
  const unit = unitFor(s.section);
  const count = Math.max(1, s.weeks.length);
  const shown = s.weeks;
  const maxVal = Math.max(1, ...shown);

  const W = 260;
  const H = 82;
  const padX = 6;
  const padT = 14; // ruang buat label angka di atas batang
  const padB = 14; // ruang buat label P1..Pn
  const plotW = W - padX * 2;
  const plotH = H - padT - padB;
  const slotW = plotW / count;
  const barW = Math.min(24, slotW * 0.62);
  const baseY = padT + plotH;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: C.ink }}>
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
          <span className="truncate">{s.section}</span>
        </span>
        {unit && (
          <span className="text-[10px] font-medium uppercase tracking-wide shrink-0 ml-2" style={{ color: C.muted }}>
            {unit}
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Diagram batang ${s.section} per pekan`}>
        <line x1={padX} y1={baseY} x2={W - padX} y2={baseY} stroke={C.line} strokeWidth={1} />
        {shown.map((v, k) => {
          const h = maxVal > 0 ? (plotH * v) / maxVal : 0;
          const cx = padX + slotW * k + slotW / 2;
          const y = baseY - h;
          const notes = s.weekNotes[k] ?? [];
          const noteLabel = notes.length > 0 ? [...new Set(notes)].join("/") : "";
          const topLabel = v > 0 && noteLabel ? `${fmt(v)} ${noteLabel}` : v > 0 ? fmt(v) : noteLabel;
          return (
            <g key={k}>
              {v > 0 && <rect x={cx - barW / 2} y={y} width={barW} height={h} rx={2} fill={s.color} />}
              <text
                x={cx}
                y={y - 3}
                textAnchor="middle"
                fontSize={9}
                fontWeight={noteLabel ? 700 : 400}
                fill={noteLabel ? C.gold : C.muted}
              >
                {topLabel}
              </text>
              <text x={cx} y={H - 3} textAnchor="middle" fontSize={9} fill={C.muted}>
                P{k + 1}
              </text>
            </g>
          );
        })}
      </svg>
      {s.weekNotes.some((n) => n.length > 0) && (
        <p className="text-[10px] mt-1" style={{ color: C.muted }}>
          <span style={{ color: C.gold, fontWeight: 600 }}>PT</span> = persiapan tasmi',{" "}
          <span style={{ color: C.gold, fontWeight: 600 }}>TS</span> = tasmi' — bukan kosong, cuma belum berupa angka baris.
        </p>
      )}
    </div>
  );
}
