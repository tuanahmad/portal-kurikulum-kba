import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  C,
  RPB_FILES_DEV,
  REFLEKSI_FILES_DEV,
  KELAS_LIST,
  fileUrl,
  isMonthOpen,
  getCurrentMonthFile,
} from "../data";
import { PageLoadingSkeleton } from "../components/Skeleton";
import { PickerCard } from "../components/PickerCard";
import { MonthGrid } from "../components/MonthGrid";
import { useAuth } from "../contexts/AuthContext";
import { readRpbTab, type RpbTabData } from "../lib/rpbSheet";
import { readReflectionTab, type ReflectionData } from "../lib/refleksiSheet";

/** Terisi apa nggak — dipakai di status "card bulan" (GuruView) & buat nge-filter tampilan rekap. */
function isRpbFilled(d: RpbTabData | null | undefined): boolean {
  return !!d && (d.tableB ?? []).some((row) => row.some((c) => (c ?? "").trim()));
}
function isRefleksiFilled(d: ReflectionData | null | undefined): boolean {
  if (!d) return false;
  const anyRow = (rows?: string[][]) => (rows ?? []).some((r) => r.some((c) => (c ?? "").trim()));
  const anyFlat = (vals?: string[]) => (vals ?? []).some((v) => (v ?? "").trim());
  const anyMurid = (rows?: string[][]) =>
    (rows ?? []).some((r) => (r[0] ?? "").trim() || r.slice(1).some((c) => (c ?? "").trim()));
  return (
    anyRow(d.capaianTarget) ||
    anyFlat(d.keberhasilan) ||
    anyRow(d.kendala) ||
    anyFlat(d.evaluasiDiri) ||
    anyFlat(d.refleksiGuru) ||
    anyRow(d.rencanaPerbaikan) ||
    anyMurid(d.perkembanganMurid)
  );
}

export default function RpbPage() {
  const { role, kelas } = useAuth();

  return (
    <div className="min-h-dvh" style={{ background: C.mist, color: C.ink }}>
      <div className="max-w-2xl mx-auto px-4 pt-6 sm:pt-9 pb-32 sm:pb-40">
        <header>
          <h1
            className="text-xl sm:text-2xl font-semibold"
            style={{ color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Rencana & Refleksi
          </h1>
          <p className="text-sm mt-1" style={{ color: C.muted }}>
            {role === "management" ? "Rekap RPB & Refleksi seluruh guru" : kelas}
          </p>
        </header>

        <main className="mt-6">
          {role === "management" ? <ManagementView /> : <GuruView />}
        </main>
      </div>
    </div>
  );
}

/* ═══════════════════════ Tampilan Guru — pilih bulan ═══════════════════════ */

function GuruView() {
  const { kelas } = useAuth();
  const [status, setStatus] = useState<Record<string, { rpb: boolean; ref: boolean }>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!kelas) return;
    let cancelled = false;
    setLoaded(false);
    const openMonths = RPB_FILES_DEV.filter((f) => isMonthOpen(f.name));
    Promise.all(
      openMonths.map(async (f) => {
        const refFile = REFLEKSI_FILES_DEV.find((r) => r.name === f.name);
        const [rpb, ref] = await Promise.all([
          readRpbTab(f.id, kelas).catch(() => null),
          refFile ? readReflectionTab(refFile.id, kelas).catch(() => null) : Promise.resolve(null),
        ]);
        return [f.name, { rpb: isRpbFilled(rpb), ref: isRefleksiFilled(ref) }] as const;
      })
    ).then((entries) => {
      if (cancelled) return;
      setStatus(Object.fromEntries(entries));
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [kelas]);

  if (!kelas) {
    return (
      <p className="text-sm text-center" style={{ color: C.muted }}>
        Kelas belum diset untuk akun ini.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {RPB_FILES_DEV.map((f) => {
        const open = isMonthOpen(f.name);
        const st = status[f.name];
        const rpbOk = !!st?.rpb;
        const refOk = !!st?.ref;
        const bothOk = rpbOk && refOk;
        const statusLine = !open
          ? "Belum dibuka"
          : !loaded
            ? "Memuat…"
            : bothOk
              ? "RPB ✓ · Refleksi ✓"
              : rpbOk || refOk
                ? `RPB ${rpbOk ? "✓" : "–"} · Refleksi ${refOk ? "✓" : "–"}`
                : "Belum diisi";

        const rowStyle = {
          background: "#FFF",
          border: `1px solid ${open && bothOk ? C.green : C.line}`,
          opacity: open ? 1 : 0.65,
        };
        const badgeStyle = {
          background: open && bothOk ? C.green : C.leaf,
          color: open && bothOk ? "#FFF" : open ? C.green : C.muted,
        };

        const inner = (
          <>
            <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={badgeStyle}>
              {open ? <CalendarIcon /> : <LockIcon />}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold" style={{ color: C.ink }}>{f.name}</span>
              <span className="block text-xs truncate" style={{ color: C.muted }}>{statusLine}</span>
            </span>
            {bothOk && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0" style={{ color: C.green }}>
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {open && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0" style={{ color: C.muted }}>
                <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </>
        );

        return open ? (
          <Link
            key={f.name}
            to={`/rpb/${f.name}`}
            className="rounded-2xl flex items-center gap-3 px-3.5 py-3 transition-shadow hover:shadow-md"
            style={rowStyle}
          >
            {inner}
          </Link>
        ) : (
          <div key={f.name} className="rounded-2xl flex items-center gap-3 px-3.5 py-3" style={rowStyle}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════ Tampilan Management ═══════════════════════ */

type Mode = "rpb" | "refleksi";

function defaultBulan(): string {
  return getCurrentMonthFile(RPB_FILES_DEV)?.name ?? RPB_FILES_DEV[0].name;
}

function ManagementView() {
  const [mode, setMode] = useState<Mode>("rpb");
  const [kelasI, setKelasI] = useState<number | null>(null);
  const [bulan, setBulan] = useState<string>(defaultBulan);

  const [rpb, setRpb] = useState<RpbTabData | null>(null);
  const [refleksi, setRefleksi] = useState<ReflectionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kelas = kelasI != null ? KELAS_LIST[kelasI].name : null;
  const monthOpen = isMonthOpen(bulan);

  const rpbFile = RPB_FILES_DEV.find((f) => f.name === bulan);
  const refFile = REFLEKSI_FILES_DEV.find((f) => f.name === bulan);
  const sheetHref = mode === "rpb" ? rpbFile && fileUrl(rpbFile.id) : refFile && fileUrl(refFile.id);

  useEffect(() => {
    if (!kelas || !monthOpen) {
      setRpb(null);
      setRefleksi(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const job =
      mode === "rpb"
        ? readRpbTab(rpbFile!.id, kelas).then((d) => !cancelled && setRpb(d))
        : readReflectionTab(refFile!.id, kelas).then((d) => !cancelled && setRefleksi(d));
    job
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, kelas, bulan]);

  return (
    <div>
      <ModeToggle mode={mode} onChange={setMode} />

      <div className="mt-4">
        <PickerCard
          items={KELAS_LIST.map((k) => ({ label: k.name }))}
          value={kelasI}
          onChange={setKelasI}
          placeholderLabel="Pilih kelas"
          selectedLabel="Kelas"
          countText={`${KELAS_LIST.length} kelas`}
          numbered={false}
        />
      </div>

      <div className="mt-4">
        <span className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: C.green }}>Bulan</span>
        <MonthGrid months={RPB_FILES_DEV.map((f) => f.name)} value={bulan} onSelect={setBulan} isOpen={isMonthOpen} />
      </div>

      {kelas && !monthOpen && (
        <p className="mt-5 text-sm text-center" style={{ color: C.muted }}>
          Bulan {bulan} belum dibuka.
        </p>
      )}

      {error && (
        <div className="mt-4 rounded-xl px-3.5 py-2.5 text-xs" style={{ background: "#FDEBEA", border: "1px solid #E8A6A0", color: "#8A2A20" }}>
          {error}
        </div>
      )}

      {kelas && monthOpen && (
        loading ? (
          <div className="mt-5"><PageLoadingSkeleton /></div>
        ) : (
          <div className="mt-5">
            {mode === "rpb" && rpb && <RpbRekap data={rpb} />}
            {mode === "refleksi" && refleksi && <RefleksiRekap data={refleksi} />}
            {sheetHref && (
              <a
                href={sheetHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold"
                style={{ color: C.muted }}
              >
                Buka versi Google Sheets
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M14 4h6v6M20 4l-9 9M9 5H5v14h14v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            )}
          </div>
        )
      )}

      {!kelas && (
        <p className="mt-6 text-sm text-center" style={{ color: C.muted }}>
          Pilih kelas untuk melihat isinya.
        </p>
      )}
    </div>
  );
}

/* ───────── RPB read-only ───────── */

function RpbRekap({ data }: { data: RpbTabData }) {
  const bidangIdx: number[] = [];
  data.tableB.forEach((row, i) => {
    if (row.some((c) => (c ?? "").trim())) bidangIdx.push(i);
  });

  return (
    <div className="space-y-6">
      <InfoCard
        title="Informasi RPB"
        gradient={`linear-gradient(135deg, ${C.green} 0%, ${C.greenDeep} 100%)`}
        icon={<BookIcon />}
        primary={{ label: "Nama Guru", value: data.namaGuru }}
        rows={[
          [
            { label: "Kelas", value: data.kelas },
            { label: "Level", value: data.level },
          ],
          [
            { label: "Bulan", value: data.bulan },
            { label: "Jumlah Pertemuan", value: data.jumlahPertemuan },
          ],
        ]}
      />

      <div>
        <SectionBar no="B" title="Target Pembelajaran" subtitle={`${bidangIdx.length} bidang ilmu`} />
        {bidangIdx.length === 0 ? (
          <EmptyNote>Belum diisi untuk bulan ini.</EmptyNote>
        ) : (
          <div className="mt-3 space-y-3">
            {bidangIdx.map((bi, n) => {
              const [nama, target, indikator] = data.tableB[bi];
              const pekan = Array.from({ length: 5 }, (_, w) => data.tableC[bi * 5 + w] ?? []);
              return (
                <RekapAccordion key={bi} badge={String(n + 1)} title={nama || `Bidang ${n + 1}`}>
                  <ReadField label="Target Capaian" value={target} />
                  <ReadField label="Indikator Keberhasilan" value={indikator} />
                  <div className="pt-1">
                    <FieldLabel>Rincian per Pekan</FieldLabel>
                    <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {pekan.map((p, w) => {
                        const sub = (p[2] ?? "").trim();
                        const metode = (p[3] ?? "").trim();
                        return (
                          <div key={w} className="rounded-xl p-2.5" style={{ background: C.leaf, border: `1px solid ${C.line}` }}>
                            <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md mb-1.5" style={{ background: C.green, color: "#FFF" }}>
                              Pekan {w + 1}
                            </span>
                            <div className="text-[13px] font-medium" style={{ color: sub ? C.ink : C.muted }}>{sub || "—"}</div>
                            {metode && <div className="text-xs mt-0.5 whitespace-pre-wrap" style={{ color: C.muted }}>{metode}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </RekapAccordion>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────── Refleksi read-only ───────── */

const CAPAIAN_LABELS = [
  "Materi selesai sesuai rencana",
  "Target pembelajaran tercapai",
  "Jadwal pembelajaran sesuai rencana",
  "Metode pengajaran sesuai rencana",
];
const EVALUASI_LABELS = [
  "Penguasaan materi",
  "Manajemen kelas",
  "Ketepatan metode",
  "Komunikasi",
  "Kreativitas",
  "Kedisiplinan",
  "Pengelolaan waktu",
  "Keteladanan",
];
const REFLEKSI_GURU_LABELS = [
  "Hal yang paling saya syukuri",
  "Kesalahan yang tidak ingin saya ulangi",
  "Kemampuan yang akan saya tingkatkan",
];

function statusOf(row: string[]): { text: string; color: string; bg: string } {
  if (row?.[0] === "TRUE") return { text: "Ya", color: "#FFF", bg: C.green };
  if (row?.[1] === "TRUE") return { text: "Sebagian", color: "#FFF", bg: C.gold };
  if (row?.[2] === "TRUE") return { text: "Belum", color: C.muted, bg: C.leaf };
  return { text: "—", color: C.muted, bg: C.leaf };
}

function RefleksiRekap({ data }: { data: ReflectionData }) {
  const kendala = (data.kendala ?? []).filter((r) => r.some((c) => (c ?? "").trim()));
  const perbaikan = (data.rencanaPerbaikan ?? []).filter((r) => r.some((c) => (c ?? "").trim()));
  const murid = (data.perkembanganMurid ?? []).filter((r) => (r[0] ?? "").trim() || r.slice(1).some((c) => (c ?? "").trim()));

  return (
    <div className="space-y-6">
      <InfoCard
        title="Informasi Refleksi"
        gradient="linear-gradient(135deg, #C79A3B 0%, #8A6A20 100%)"
        icon={<ReflectIcon />}
        primary={{ label: "Nama Guru", value: data.namaGuru }}
        rows={[
          [
            { label: "Kelas", value: data.kelas },
            { label: "Level", value: data.level },
          ],
          [{ label: "Bulan", value: data.bulan }],
        ]}
      />

      <div>
        <SectionBar no="A" title="Capaian Target" />
        <div className="mt-3 space-y-2">
          {CAPAIAN_LABELS.map((label, i) => {
            const s = statusOf(data.capaianTarget?.[i] ?? []);
            const ket = (data.capaianTarget?.[i]?.[3] ?? "").trim();
            return (
              <div key={i} className="rounded-2xl p-3.5" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm" style={{ color: C.ink }}>{label}</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: s.bg, color: s.color }}>{s.text}</span>
                </div>
                {ket && <div className="text-xs mt-1.5" style={{ color: C.muted }}>{ket}</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <SectionBar no="B" title="Analisis Keberhasilan" />
        <div className="mt-3 rounded-2xl p-3.5 space-y-3" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
          <ReadField label="Program/strategi yang paling berhasil" value={data.keberhasilan?.[0] ?? ""} />
          <ReadField label="Faktor yang membuatnya berhasil" value={data.keberhasilan?.[1] ?? ""} />
        </div>
      </div>

      <div>
        <SectionBar no="C" title="Analisis Kendala" subtitle={`${kendala.length} kendala`} />
        {kendala.length === 0 ? (
          <EmptyNote>Belum diisi.</EmptyNote>
        ) : (
          <div className="mt-3 space-y-3">
            {kendala.map((row, i) => (
              <NumberedCard key={i} n={i + 1}>
                <ReadField label="Kendala" value={row[0]} />
                <ReadField label="Dampak" value={row[1]} />
                <ReadField label="Penyebab" value={row[2]} />
              </NumberedCard>
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionBar no="D" title="Evaluasi Diri Guru" subtitle="Nilai 1–4 tiap aspek" />
        <div className="mt-3 rounded-2xl p-3.5 space-y-2.5" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
          {EVALUASI_LABELS.map((label, i) => {
            const v = (data.evaluasiDiri?.[i] ?? "").trim();
            return (
              <div key={i} className="flex items-center justify-between gap-3">
                <span className="text-sm" style={{ color: C.ink }}>{label}</span>
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: v ? C.green : C.leaf, color: v ? "#FFF" : C.muted }}
                >
                  {v || "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <SectionBar no="E" title="Refleksi Guru" />
        <div className="mt-3 rounded-2xl p-3.5 space-y-3" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
          {REFLEKSI_GURU_LABELS.map((label, i) => (
            <ReadField key={i} label={label} value={data.refleksiGuru?.[i] ?? ""} />
          ))}
        </div>
      </div>

      <div>
        <SectionBar no="F" title="Rencana Perbaikan" subtitle={`${perbaikan.length} rencana`} />
        {perbaikan.length === 0 ? (
          <EmptyNote>Belum diisi.</EmptyNote>
        ) : (
          <div className="mt-3 space-y-3">
            {perbaikan.map((row, i) => (
              <NumberedCard key={i} n={i + 1}>
                <ReadField label="Permasalahan" value={row[0]} />
                <ReadField label="Solusi" value={row[1]} />
                <ReadField label="Target Waktu" value={row[2]} />
              </NumberedCard>
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionBar no="G" title="Refleksi Perkembangan Murid" subtitle={`${murid.length} santri`} />
        {murid.length === 0 ? (
          <EmptyNote>Belum diisi.</EmptyNote>
        ) : (
          <div className="mt-3 space-y-2">
            {murid.map((row, i) => (
              <RekapAccordion key={i} title={row[0] || `Santri ${i + 1}`}>
                <ReadField label="Perkembangan" value={row[1]} />
                <ReadField label="Tantangan" value={row[2]} />
                <ReadField label="Rencana Pendampingan" value={row[3]} />
              </RekapAccordion>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════ shared bits ═══════════════════════ */

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1 p-1 rounded-xl" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
      {(["rpb", "refleksi"] as Mode[]).map((m) => {
        const active = m === mode;
        return (
          <button
            key={m}
            onClick={() => onChange(m)}
            className="py-2 rounded-lg text-sm font-semibold transition-colors"
            style={{ background: active ? C.green : "transparent", color: active ? "#FFF" : C.muted }}
          >
            {m === "rpb" ? "RPB" : "Refleksi"}
          </button>
        );
      })}
    </div>
  );
}


function InfoCard({
  title,
  gradient,
  icon,
  primary,
  rows,
}: {
  title: string;
  gradient: string;
  icon: React.ReactNode;
  primary: { label: string; value: string };
  rows: { label: string; value: string }[][];
}) {
  return (
    <div className="relative rounded-2xl p-4 sm:p-5" style={{ background: gradient, boxShadow: "0 4px 14px rgba(28,74,51,0.14)" }}>
      <div className="absolute inset-0 overflow-hidden rounded-2xl" aria-hidden="true">
        <span className="absolute -right-6 -top-6 w-28 h-28 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }} />
      </div>
      <div className="relative flex items-center gap-3 mb-4">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.16)", color: "#FFF" }}>
          {icon}
        </span>
        <div className="text-sm font-bold uppercase tracking-[0.1em]" style={{ color: "#FFF" }}>{title}</div>
      </div>
      <div className="relative">
        <InfoValue label={primary.label} value={primary.value} large />
        {rows.map((r, i) => (
          <div key={i} className={`grid gap-3 mt-3 ${r.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {r.map((c) => (
              <InfoValue key={c.label} label={c.label} value={c.value} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoValue({ label, value, large }: { label: string; value: string; large?: boolean }) {
  return (
    <div className="min-w-0">
      <span className="block text-[10px] font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.65)" }}>{label}</span>
      <span className={`block mt-0.5 text-white ${large ? "text-base font-semibold" : "text-sm font-medium"}`}>{value?.trim() || "—"}</span>
    </div>
  );
}

function SectionBar({ no, title, subtitle }: { no: string; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 px-1">
      <span
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
        style={{ background: C.leaf, color: C.green, fontFamily: "Georgia, serif" }}
      >
        {no}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-bold uppercase tracking-[0.1em]" style={{ color: C.green }}>{title}</div>
        {subtitle && <div className="text-xs" style={{ color: C.muted }}>{subtitle}</div>}
      </div>
    </div>
  );
}

function RekapAccordion({ badge, title, children }: { badge?: string; title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors"
        style={{ background: open ? C.leaf : "#FFF" }}
      >
        {badge && (
          <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold" style={{ background: C.leaf, color: C.green }}>
            {badge}
          </span>
        )}
        <span className="flex-1 text-sm font-semibold min-w-0 truncate" style={{ color: C.ink }}>{title}</span>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          className="shrink-0 transition-transform"
          style={{ color: C.muted, transform: open ? "rotate(180deg)" : "none" }}
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="px-3.5 pb-4 pt-1 space-y-3" style={{ borderTop: `1px solid ${C.line}` }}>
          {children}
        </div>
      )}
    </div>
  );
}

function NumberedCard({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-3.5 flex gap-3" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
      <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold" style={{ background: C.leaf, color: C.green }}>{n}</span>
      <div className="flex-1 min-w-0 space-y-2.5">{children}</div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="block text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.muted }}>{children}</span>;
}

function ReadField({ label, value }: { label: string; value: string }) {
  const v = (value ?? "").trim();
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="text-sm mt-0.5 whitespace-pre-wrap" style={{ color: v ? C.ink : C.muted }}>{v || "—"}</div>
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 text-xs rounded-xl px-3.5 py-2.5" style={{ background: C.leaf, color: C.muted }}>
      {children}
    </div>
  );
}

/* ───────── icons ───────── */

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.5 9.5h17" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 3v3.5M16 3v3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" className="shrink-0">
      <rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="#9AA294" strokeWidth="1.8" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" fill="none" stroke="#9AA294" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 5.5c2-1 5-1 8 .5 3-1.5 6-1.5 8-.5v13c-2-1-5-1-8 .5-3-1.5-6-1.5-8-.5v-13Z" stroke="#FFF" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M12 6v13" stroke="#FFF" strokeWidth="1.7" />
    </svg>
  );
}

function ReflectIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 3.5c-4.5 0-8 3.2-8 7.3 0 2 .9 3.9 2.4 5.2L6 20l4.1-1.5c.6.1 1.2.2 1.9.2 4.5 0 8-3.2 8-7.4s-3.5-7.3-8-7.3Z" stroke="#FFF" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9 10.5h6M9 13.2h4" stroke="#FFF" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
