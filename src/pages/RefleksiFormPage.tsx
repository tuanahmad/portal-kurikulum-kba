import { useEffect, useState } from "react";
import { useNavigate, useParams, Navigate } from "react-router-dom";
import { C, REFLEKSI_FILES_DEV, SANTRI_LIST, jenjangOf, isMonthOpen } from "../data";
import { useAuth } from "../contexts/AuthContext";
import { readReflectionTab, writeReflectionTab, type ReflectionData } from "../lib/refleksiSheet";
import { PageLoadingSkeleton } from "../components/Skeleton";

const ROSTER_ROWS = 20; // kapasitas tetap di sheet (A51:D70) — cukup buat kelas terbesar (11 santri)
const KENDALA_ROWS = 5;
const PERBAIKAN_ROWS = 4;

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

function padRows(rows: string[][] | undefined, count: number, cols: number): string[][] {
  const base = rows ?? [];
  return Array.from({ length: count }, (_, i) => {
    const row = base[i] ?? [];
    return Array.from({ length: cols }, (_, j) => row[j] ?? "");
  });
}
function padFlat(rows: string[][] | undefined, count: number): string[] {
  const base = rows ?? [];
  return Array.from({ length: count }, (_, i) => base[i]?.[0] ?? "");
}

/** Halaman isi Refleksi Bulanan — pola sama persis kayak RpbFormPage (nulis ke salinan uji coba
 *  REFLEKSI_FILES_DEV selama data asli belum dimigrasikan). Bagian G "Refleksi Perkembangan
 *  Murid" bedanya: nama santri gak diketik guru, tapi ditarik dari SANTRI_LIST (roster yang
 *  dikasih koordinator) — guru tinggal klik nama buat buka & isi field-nya (accordion). */
export default function RefleksiFormPage() {
  const navigate = useNavigate();
  const { bulan } = useParams<{ bulan: string }>();
  const { kelas, fullName } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [editingInfo, setEditingInfo] = useState(false);
  const [openStudent, setOpenStudent] = useState<number | null>(null);

  const [namaGuru, setNamaGuru] = useState("");
  const [kelasField, setKelasField] = useState("");
  const [levelField, setLevelField] = useState("");
  const [bulanField, setBulanField] = useState("");

  const [capaianTarget, setCapaianTarget] = useState<string[][]>(
    Array.from({ length: CAPAIAN_LABELS.length }, () => ["", "", "", ""])
  );
  const [keberhasilan, setKeberhasilan] = useState<string[]>(["", ""]);
  const [kendala, setKendala] = useState<string[][]>(Array.from({ length: KENDALA_ROWS }, () => ["", "", ""]));
  const [evaluasiDiri, setEvaluasiDiri] = useState<string[]>(Array.from({ length: EVALUASI_LABELS.length }, () => ""));
  const [refleksiGuru, setRefleksiGuru] = useState<string[]>(["", "", ""]);
  const [rencanaPerbaikan, setRencanaPerbaikan] = useState<string[][]>(
    Array.from({ length: PERBAIKAN_ROWS }, () => ["", "", ""])
  );
  const [murid, setMurid] = useState<string[][]>(Array.from({ length: ROSTER_ROWS }, () => ["", "", "", ""]));

  const file = REFLEKSI_FILES_DEV.find((f) => f.name === bulan);
  const roster = (kelas && SANTRI_LIST[kelas]) || [];

  useEffect(() => {
    if (!kelas || !file) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSaveMsg(null);
    readReflectionTab(file.id, kelas)
      .then((data) => {
        if (cancelled) return;
        setNamaGuru(data.namaGuru || fullName || "");
        setKelasField(data.kelas || kelas || "");
        setLevelField(data.level || jenjangOf(kelas) || "");
        setBulanField(data.bulan || bulan || "");
        setCapaianTarget(padRows(data.capaianTarget, CAPAIAN_LABELS.length, 4));
        setKeberhasilan(padFlat(data.keberhasilan?.map((v) => [v]), 2));
        setKendala(padRows(data.kendala, KENDALA_ROWS, 3));
        setEvaluasiDiri(padFlat(data.evaluasiDiri?.map((v) => [v]), EVALUASI_LABELS.length));
        setRefleksiGuru(padFlat(data.refleksiGuru?.map((v) => [v]), 3));
        setRencanaPerbaikan(padRows(data.rencanaPerbaikan, PERBAIKAN_ROWS, 3));
        setMurid(padRows(data.perkembanganMurid, ROSTER_ROWS, 4));
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.id, kelas]);

  async function handleSave() {
    if (!kelas || !file) return;
    setSaving(true);
    setError(null);
    setSaveMsg(null);
    // Kolom Nama Murid gak pernah diketik manual — diisi otomatis di sini dari roster pas mau
    // nulis ke sheet, sama kayak Pekan/Bidang Ilmu di RPB.
    const muridForSave = murid.map((r, idx) => [roster[idx] ?? "", r[1], r[2], r[3]]);
    const payload: ReflectionData = {
      namaGuru,
      kelas: kelasField,
      level: levelField,
      bulan: bulanField,
      capaianTarget,
      keberhasilan,
      kendala,
      evaluasiDiri,
      refleksiGuru,
      rencanaPerbaikan,
      perkembanganMurid: muridForSave,
    };
    try {
      await writeReflectionTab(file.id, kelas, payload);
      setSaveMsg("Tersimpan ke sheet (salinan uji coba).");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function setCapaianStatus(i: number, status: "ya" | "sebagian" | "belum") {
    setCapaianTarget((prev) =>
      prev.map((r, ri) => (ri === i ? [status === "ya" ? "TRUE" : "", status === "sebagian" ? "TRUE" : "", status === "belum" ? "TRUE" : "", r[3]] : r))
    );
  }
  function setCapaianKeterangan(i: number, val: string) {
    setCapaianTarget((prev) => prev.map((r, ri) => (ri === i ? [r[0], r[1], r[2], val] : r)));
  }
  function setKendalaCell(i: number, col: number, val: string) {
    setKendala((prev) => prev.map((r, ri) => (ri === i ? r.map((c, ci) => (ci === col ? val : c)) : r)));
  }
  function setPerbaikanCell(i: number, col: number, val: string) {
    setRencanaPerbaikan((prev) => prev.map((r, ri) => (ri === i ? r.map((c, ci) => (ci === col ? val : c)) : r)));
  }
  function setMuridCell(i: number, col: number, val: string) {
    setMurid((prev) => prev.map((r, ri) => (ri === i ? r.map((c, ci) => (ci === col ? val : c)) : r)));
  }

  if (!bulan || !file || !isMonthOpen(bulan)) {
    return <Navigate to="/rpb" replace />;
  }

  if (!kelas) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: C.mist }}>
        <p className="text-sm" style={{ color: C.muted }}>Kelas belum diset untuk akun ini.</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh" style={{ background: C.mist, color: C.ink }}>
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-9 pb-28">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/rpb/${bulan}`)}
            aria-label="Kembali"
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "#FFF", border: `1px solid ${C.line}`, color: C.green }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1
            className="text-lg sm:text-xl font-semibold truncate"
            style={{ color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Refleksi Bulanan — {bulan}
          </h1>
        </div>

        {loading ? (
          <div className="mt-6">
            <PageLoadingSkeleton />
          </div>
        ) : (
          <div className="mt-6 space-y-7">
            {error && (
              <div className="rounded-xl px-3.5 py-2.5 text-xs" style={{ background: "#FDEBEA", border: "1px solid #E8A6A0", color: "#8A2A20" }}>
                {error}
              </div>
            )}

            {/* Informasi umum */}
            {editingInfo ? (
              <div className="rounded-2xl p-4 sm:p-5" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.leaf }}>
                      <ReflectIcon color={C.green} />
                    </span>
                    <div className="text-sm font-bold uppercase tracking-[0.1em]" style={{ color: C.green }}>
                      Informasi Refleksi
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingInfo(false)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full shrink-0"
                    style={{ background: C.leaf, color: C.green }}
                  >
                    Selesai
                  </button>
                </div>
                <div className="space-y-3.5">
                  <Field label="Nama Guru">
                    <input value={namaGuru} onChange={(e) => setNamaGuru(e.target.value)} className="w-full text-sm outline-none px-3.5 py-2.5 rounded-xl" style={{ border: `1px solid ${C.line}` }} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Kelas">
                      <input value={kelasField} onChange={(e) => setKelasField(e.target.value)} className="w-full text-sm outline-none px-3.5 py-2.5 rounded-xl" style={{ border: `1px solid ${C.line}` }} />
                    </Field>
                    <Field label="Level">
                      <input value={levelField} onChange={(e) => setLevelField(e.target.value)} className="w-full text-sm outline-none px-3.5 py-2.5 rounded-xl" style={{ border: `1px solid ${C.line}` }} />
                    </Field>
                  </div>
                  <Field label="Bulan">
                    <input value={bulanField} onChange={(e) => setBulanField(e.target.value)} className="w-full text-sm outline-none px-3.5 py-2.5 rounded-xl" style={{ border: `1px solid ${C.line}` }} />
                  </Field>
                </div>
              </div>
            ) : (
              <div className="relative rounded-2xl p-4 sm:p-5" style={{ background: `linear-gradient(135deg, #C79A3B 0%, #8A6A20 100%)`, boxShadow: "0 4px 14px rgba(28,74,51,0.14)" }}>
                <div className="absolute inset-0 overflow-hidden rounded-2xl" aria-hidden="true">
                  <span className="absolute -right-6 -top-6 w-28 h-28 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }} />
                </div>
                <div className="relative flex items-center gap-3 mb-4">
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.18)" }}>
                    <ReflectIcon />
                  </span>
                  <div className="text-sm font-bold uppercase tracking-[0.1em]" style={{ color: "#FFF" }}>
                    Informasi Refleksi
                  </div>
                </div>
                <div className="relative">
                  <InfoValue label="Nama Guru" value={namaGuru} large />
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <InfoValue label="Kelas" value={kelasField} />
                    <InfoValue label="Level" value={levelField} />
                  </div>
                  <div className="mt-3">
                    <InfoValue label="Bulan" value={bulanField} />
                  </div>
                </div>
                <div className="relative flex justify-end mt-4">
                  <button
                    onClick={() => setEditingInfo(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-full transition-shadow hover:shadow-md"
                    style={{ background: "rgba(255,255,255,0.18)", color: "#FFF" }}
                  >
                    <PencilIcon />
                    Edit
                  </button>
                </div>
              </div>
            )}

            {/* A. Capaian Target */}
            <SectionHeading no="A" title="Capaian Target" subtitle="Sesuai rencana bulan ini apa nggak?" />
            <div className="space-y-3">
              {CAPAIAN_LABELS.map((label, i) => {
                const status = capaianTarget[i][0] === "TRUE" ? "ya" : capaianTarget[i][1] === "TRUE" ? "sebagian" : capaianTarget[i][2] === "TRUE" ? "belum" : "";
                return (
                  <div key={i} className="rounded-2xl p-3.5 sm:p-4" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
                    <div className="text-sm font-medium mb-2.5" style={{ color: C.ink }}>{label}</div>
                    <div className="flex gap-2 mb-2.5">
                      {(["ya", "sebagian", "belum"] as const).map((opt) => (
                        <button
                          key={opt}
                          onClick={() => setCapaianStatus(i, opt)}
                          className="flex-1 text-xs font-semibold py-2 rounded-lg capitalize transition-colors"
                          style={{
                            background: status === opt ? C.green : C.leaf,
                            color: status === opt ? "#FFF" : C.muted,
                          }}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                    <input
                      value={capaianTarget[i][3]}
                      onChange={(e) => setCapaianKeterangan(i, e.target.value)}
                      placeholder="Keterangan (opsional)"
                      className="w-full text-sm outline-none px-3 py-2 rounded-lg"
                      style={{ border: `1px solid ${C.line}` }}
                    />
                  </div>
                );
              })}
            </div>

            {/* B. Analisis Keberhasilan */}
            <SectionHeading no="B" title="Analisis Keberhasilan" subtitle="Apa yang jalan baik bulan ini?" />
            <div className="rounded-2xl p-3.5 sm:p-4 space-y-3" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
              <Field label="Program/strategi yang paling berhasil" compact>
                <textarea value={keberhasilan[0]} onChange={(e) => setKeberhasilan((p) => [e.target.value, p[1]])} rows={2} className="w-full text-sm outline-none px-3 py-2 rounded-lg resize-none" style={{ border: `1px solid ${C.line}` }} />
              </Field>
              <Field label="Faktor yang membuatnya berhasil" compact>
                <textarea value={keberhasilan[1]} onChange={(e) => setKeberhasilan((p) => [p[0], e.target.value])} rows={2} className="w-full text-sm outline-none px-3 py-2 rounded-lg resize-none" style={{ border: `1px solid ${C.line}` }} />
              </Field>
            </div>

            {/* C. Analisis Kendala */}
            <SectionHeading no="C" title="Analisis Kendala" subtitle={`${KENDALA_ROWS} kendala yang ditemui bulan ini`} />
            <div className="space-y-3">
              {kendala.map((row, i) => (
                <EntryCard key={i} badge={<span>{i + 1}</span>}>
                  <Field label="Kendala" compact>
                    <input value={row[0]} onChange={(e) => setKendalaCell(i, 0, e.target.value)} className="w-full text-sm outline-none px-3 py-2 rounded-lg" style={{ border: `1px solid ${C.line}` }} />
                  </Field>
                  <Field label="Dampak" compact>
                    <input value={row[1]} onChange={(e) => setKendalaCell(i, 1, e.target.value)} className="w-full text-sm outline-none px-3 py-2 rounded-lg" style={{ border: `1px solid ${C.line}` }} />
                  </Field>
                  <Field label="Penyebab" compact>
                    <input value={row[2]} onChange={(e) => setKendalaCell(i, 2, e.target.value)} className="w-full text-sm outline-none px-3 py-2 rounded-lg" style={{ border: `1px solid ${C.line}` }} />
                  </Field>
                </EntryCard>
              ))}
            </div>

            {/* D. Evaluasi Diri Guru */}
            <SectionHeading no="D" title="Evaluasi Diri Guru" subtitle="Nilai diri sendiri 1-4 tiap aspek" />
            <div className="rounded-2xl p-3.5 sm:p-4 space-y-3" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
              {EVALUASI_LABELS.map((label, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <span className="text-sm" style={{ color: C.ink }}>{label}</span>
                  <div className="flex gap-1.5 shrink-0">
                    {[1, 2, 3, 4].map((n) => (
                      <button
                        key={n}
                        onClick={() => setEvaluasiDiri((prev) => prev.map((v, vi) => (vi === i ? String(n) : v)))}
                        className="w-8 h-8 rounded-lg text-xs font-semibold"
                        style={{
                          background: evaluasiDiri[i] === String(n) ? C.green : C.leaf,
                          color: evaluasiDiri[i] === String(n) ? "#FFF" : C.muted,
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* E. Refleksi Guru */}
            <SectionHeading no="E" title="Refleksi Guru" subtitle="Renungan pribadi bulan ini" />
            <div className="rounded-2xl p-3.5 sm:p-4 space-y-3" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
              {REFLEKSI_GURU_LABELS.map((label, i) => (
                <Field key={i} label={label} compact>
                  <textarea
                    value={refleksiGuru[i]}
                    onChange={(e) => setRefleksiGuru((prev) => prev.map((v, vi) => (vi === i ? e.target.value : v)))}
                    rows={2}
                    className="w-full text-sm outline-none px-3 py-2 rounded-lg resize-none"
                    style={{ border: `1px solid ${C.line}` }}
                  />
                </Field>
              ))}
            </div>

            {/* F. Rencana Perbaikan */}
            <SectionHeading no="F" title="Rencana Perbaikan" subtitle={`${PERBAIKAN_ROWS} rencana perbaikan bulan depan`} />
            <div className="space-y-3">
              {rencanaPerbaikan.map((row, i) => (
                <EntryCard key={i} badge={<span>{i + 1}</span>}>
                  <Field label="Permasalahan" compact>
                    <input value={row[0]} onChange={(e) => setPerbaikanCell(i, 0, e.target.value)} className="w-full text-sm outline-none px-3 py-2 rounded-lg" style={{ border: `1px solid ${C.line}` }} />
                  </Field>
                  <Field label="Solusi" compact>
                    <input value={row[1]} onChange={(e) => setPerbaikanCell(i, 1, e.target.value)} className="w-full text-sm outline-none px-3 py-2 rounded-lg" style={{ border: `1px solid ${C.line}` }} />
                  </Field>
                  <Field label="Target Waktu" compact>
                    <input value={row[2]} onChange={(e) => setPerbaikanCell(i, 2, e.target.value)} className="w-full text-sm outline-none px-3 py-2 rounded-lg" style={{ border: `1px solid ${C.line}` }} />
                  </Field>
                </EntryCard>
              ))}
            </div>

            {/* G. Refleksi Perkembangan Murid */}
            <SectionHeading no="G" title="Refleksi Perkembangan Murid" subtitle="Klik nama santri buat isi" />
            {roster.length === 0 ? (
              <div className="text-xs rounded-lg px-3 py-2.5" style={{ background: C.leaf, color: C.muted }}>
                Belum ada daftar santri buat kelas ini — hubungi koordinator kurikulum.
              </div>
            ) : (
              <div className="space-y-2">
                {roster.map((nama, i) => {
                  const filled = murid[i]?.some((v) => v.trim());
                  const open = openStudent === i;
                  return (
                    <div key={i} className="rounded-2xl overflow-hidden" style={{ background: "#FFF", border: `1px solid ${open ? C.green : C.line}` }}>
                      <button
                        onClick={() => setOpenStudent(open ? null : i)}
                        className="w-full flex items-center justify-between gap-3 px-3.5 py-3 text-left"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: filled ? C.green : C.line }}
                            aria-hidden="true"
                          />
                          <span className="text-sm font-medium truncate" style={{ color: C.ink }}>{nama}</span>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s", color: C.muted }}>
                          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      {open && (
                        <div className="px-3.5 pb-3.5 space-y-2.5" style={{ borderTop: `1px solid ${C.line}` }}>
                          <Field label="Perkembangan" compact>
                            <textarea value={murid[i][1]} onChange={(e) => setMuridCell(i, 1, e.target.value)} rows={2} className="w-full text-sm outline-none px-3 py-2 rounded-lg resize-none mt-2" style={{ border: `1px solid ${C.line}` }} />
                          </Field>
                          <Field label="Tantangan" compact>
                            <textarea value={murid[i][2]} onChange={(e) => setMuridCell(i, 2, e.target.value)} rows={2} className="w-full text-sm outline-none px-3 py-2 rounded-lg resize-none" style={{ border: `1px solid ${C.line}` }} />
                          </Field>
                          <Field label="Rencana Pendampingan" compact>
                            <textarea value={murid[i][3]} onChange={(e) => setMuridCell(i, 3, e.target.value)} rows={2} className="w-full text-sm outline-none px-3 py-2 rounded-lg resize-none" style={{ border: `1px solid ${C.line}` }} />
                          </Field>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {saveMsg && (
              <div className="rounded-xl px-3.5 py-2.5 text-xs" style={{ background: C.leaf, border: `1px solid ${C.green}`, color: C.green }}>
                {saveMsg}
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full text-sm font-semibold py-3.5 rounded-xl transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: C.green, color: "#FFF" }}
            >
              {saving ? "Menyimpan…" : "Simpan"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, compact }: { label: string; children: React.ReactNode; compact?: boolean }) {
  return (
    <label className="block">
      <span className={`block font-semibold uppercase tracking-wide ${compact ? "text-[10px] mb-1" : "text-xs mb-1"}`} style={{ color: C.muted }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function SectionHeading({ no, title, subtitle }: { no: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 px-1">
      <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: C.leaf, color: C.green, fontFamily: "Georgia, serif" }}>
        {no}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-bold uppercase tracking-[0.1em]" style={{ color: C.green }}>{title}</div>
        <div className="text-xs" style={{ color: C.muted }}>{subtitle}</div>
      </div>
    </div>
  );
}

function EntryCard({ badge, children }: { badge: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-3.5 sm:p-4 flex gap-3 transition-shadow hover:shadow-md" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
      <div className="shrink-0">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold" style={{ background: C.leaf, color: C.green }}>
          {badge}
        </div>
      </div>
      <div className="flex-1 min-w-0 space-y-2.5">{children}</div>
    </div>
  );
}

function InfoValue({ label, value, large }: { label: string; value: string; large?: boolean }) {
  return (
    <div className="min-w-0">
      <span className="block text-[10px] font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.7)" }}>
        {label}
      </span>
      <span className={`block truncate mt-0.5 text-white ${large ? "text-base font-semibold" : "text-sm font-medium"}`}>
        {value || "—"}
      </span>
    </div>
  );
}

function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M4 20h4L18.5 9.5a2 2 0 0 0 0-2.83l-1.17-1.17a2 2 0 0 0-2.83 0L4 15.5V20Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M13 6l4.5 4.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ReflectIcon({ color = "#FFF" }: { color?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 3.5c-4.5 0-8 3.2-8 7.3 0 2 .9 3.9 2.4 5.2L6 20l4.1-1.5c.6.1 1.2.2 1.9.2 4.5 0 8-3.2 8-7.4s-3.5-7.3-8-7.3Z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9 10.5h6M9 13.2h4" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
