import { useEffect, useMemo, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { C, CAPAIAN_QURAN_FILES_DEV, capaianRoster, isMonthOpen } from "../data";
import { useAuth } from "../contexts/AuthContext";
import {
  readCapaianQuran,
  writeCapaianQuranSlot,
  type CapaianQuranData,
  type CapaianQuranSection,
} from "../lib/capaianQuranSheet";
import { PageLoadingSkeleton } from "../components/Skeleton";
import { PickerCard } from "../components/PickerCard";

const BULAN_LIST = ["Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const QUICK = ["0", "0,5", "1", "2", "3", "4", "5"]; // tombol cepat; guru tetap bisa ketik angka lain

const GOLD = "linear-gradient(135deg, #C79A3B 0%, #8A6A20 100%)";

/** Halaman isi Capaian Al-Qur'an — nulis ke salinan uji coba (CAPAIAN_QURAN_FILES_DEV) selama
 *  dokumen asli belum dimigrasikan. Alur: pilih Bulan -> pilih Section (Talaqqi/Ziyadah/...) ->
 *  pilih Pertemuan/Pekan ke-N -> isi angka tiap santri -> Simpan.
 *
 *  Struktur sheet dibaca dinamis oleh edge function sheet-capaian-quran (section + tipe +
 *  jumlah slot dideteksi otomatis), jadi halaman ini nggak hardcode daftar section. */
export default function CapaianQuranFormPage() {
  const navigate = useNavigate();
  const { kelas } = useAuth();

  const fileId = kelas ? CAPAIAN_QURAN_FILES_DEV[kelas] : undefined;
  const roster = useMemo(() => (kelas ? capaianRoster(kelas) : []), [kelas]);

  const [bulan, setBulan] = useState<string | null>(null);
  const [data, setData] = useState<CapaianQuranData | null>(null);
  const [sectionName, setSectionName] = useState<string | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  const [values, setValues] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const section: CapaianQuranSection | null =
    (data && sectionName && data.sections.find((s) => s.name === sectionName)) || null;

  // muat data tiap ganti bulan
  useEffect(() => {
    if (!bulan || !fileId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSaveMsg(null);
    setData(null);
    setSectionName(null);
    setSlot(null);
    readCapaianQuran(fileId, bulan)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [bulan, fileId]);

  // isi ulang `values` dari sheet tiap ganti section / slot
  useEffect(() => {
    if (!section || !slot) {
      setValues([]);
      return;
    }
    setValues(
      roster.map((_, i) => section.students[i]?.values?.[slot - 1] ?? "")
    );
    setSaveMsg(null);
  }, [section, slot, roster]);

  if (!kelas) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: C.mist }}>
        <p className="text-sm" style={{ color: C.muted }}>Kelas belum diset untuk akun ini.</p>
      </div>
    );
  }
  if (!fileId) {
    return <Navigate to="/capaian" replace />;
  }

  async function handleSave() {
    if (!fileId || !bulan || !section || !slot) return;
    setSaving(true);
    setError(null);
    setSaveMsg(null);
    try {
      await writeCapaianQuranSlot({
        fileId,
        tab: bulan,
        sectionName: section.name,
        slotIndex: slot,
        roster,
        values,
      });
      setSaveMsg("Tersimpan ke sheet (salinan uji coba).");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const slotLabel = section?.type === "pekan" ? "Pekan" : "Pertemuan";

  return (
    <div className="min-h-dvh" style={{ background: C.mist, color: C.ink }}>
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-9 pb-28">
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
              Capaian Al-Qur'an
            </h1>
            <p className="text-sm" style={{ color: C.muted }}>{kelas}</p>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          {/* Langkah 1 — Bulan */}
          <Step n={1} label="Pilih bulan">
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
          </Step>

          {error && (
            <div className="rounded-xl px-3.5 py-2.5 text-xs" style={{ background: "#FDEBEA", border: "1px solid #E8A6A0", color: "#8A2A20" }}>
              {error}
            </div>
          )}

          {loading && <PageLoadingSkeleton />}

          {/* Langkah 2 — Section */}
          {data && !loading && (
            <Step n={2} label="Pilih jenis capaian">
              {data.sections.length === 0 ? (
                <p className="text-sm" style={{ color: C.muted }}>
                  Nggak nemu format capaian di sheet bulan ini.
                </p>
              ) : (
                <PickerCard
                  items={data.sections.map((s) => ({
                    label: s.name,
                    sub: s.type === "pekan" ? "Diisi per pekan" : "Diisi per pertemuan",
                  }))}
                  value={(() => {
                    const idx = data.sections.findIndex((s) => s.name === sectionName);
                    return idx >= 0 ? idx : null;
                  })()}
                  onChange={(i) => {
                    setSectionName(i == null ? null : data.sections[i].name);
                    setSlot(null);
                  }}
                  placeholderLabel="Pilih jenis capaian"
                  selectedLabel="Jenis capaian"
                  countText={`${data.sections.length} jenis`}
                  numbered={false}
                  icon={<BookmarkIcon />}
                />
              )}
            </Step>
          )}

          {/* Langkah 3 — Slot */}
          {section && (
            <Step n={3} label={`Pilih ${slotLabel.toLowerCase()} ke-`}>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: section.slotCount }, (_, i) => i + 1).map((n) => {
                  const active = n === slot;
                  return (
                    <button
                      key={n}
                      onClick={() => setSlot(active ? null : n)}
                      className="w-10 h-10 rounded-lg text-sm font-semibold transition-colors"
                      style={{
                        background: active ? C.green : "#FFF",
                        color: active ? "#FFF" : C.ink,
                        border: `1px solid ${active ? C.green : C.line}`,
                      }}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </Step>
          )}

          {/* Langkah 4 — Isi angka per santri */}
          {section && slot && (
            <div
              className="relative rounded-2xl p-4 sm:p-5"
              style={{ background: GOLD, boxShadow: "0 4px 14px rgba(28,74,51,0.14)" }}
            >
              <div className="absolute inset-0 overflow-hidden rounded-2xl" aria-hidden="true">
                <span className="absolute -right-6 -top-6 w-28 h-28 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }} />
              </div>
              <div className="relative">
                <div className="text-sm font-bold uppercase tracking-[0.1em]" style={{ color: "#FFF" }}>
                  {section.name} · {slotLabel} {slot}
                </div>
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.8)" }}>
                  Angka = baris yang dibaca. Kosongkan kalau nggak baca. Isi 0 kalau ngulang baris yang sama.
                </p>

                <div className="mt-4 space-y-2.5">
                  {roster.length === 0 && (
                    <p className="text-sm" style={{ color: "#FFF" }}>
                      Belum ada daftar santri buat kelas ini — hubungi koordinator kurikulum.
                    </p>
                  )}
                  {roster.map((nama, i) => (
                    <div key={i} className="rounded-xl p-3" style={{ background: "#FFF" }}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold truncate" style={{ color: C.ink }}>
                          {i + 1}. {nama}
                        </span>
                        <input
                          value={values[i] ?? ""}
                          onChange={(e) =>
                            setValues((prev) => prev.map((v, vi) => (vi === i ? e.target.value : v)))
                          }
                          inputMode="decimal"
                          placeholder="—"
                          className="w-16 text-sm text-center outline-none px-2 py-1.5 rounded-lg shrink-0"
                          style={{ border: `1px solid ${C.line}` }}
                        />
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {QUICK.map((q) => {
                          const on = (values[i] ?? "") === q;
                          return (
                            <button
                              key={q}
                              onClick={() =>
                                setValues((prev) => prev.map((v, vi) => (vi === i ? (on ? "" : q) : v)))
                              }
                              className="px-2 py-1 rounded-md text-xs font-medium transition-colors"
                              style={{
                                background: on ? C.green : C.leaf,
                                color: on ? "#FFF" : C.green,
                              }}
                            >
                              {q === "0,5" ? "½" : q}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {saveMsg && (
                  <div className="mt-4 rounded-xl px-3.5 py-2.5 text-xs" style={{ background: "rgba(255,255,255,0.9)", color: C.green }}>
                    {saveMsg}
                  </div>
                )}

                <button
                  onClick={handleSave}
                  disabled={saving || roster.length === 0}
                  className="mt-4 w-full py-3 rounded-xl text-sm font-bold transition-opacity"
                  style={{ background: C.green, color: "#FFF", opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? "Menyimpan…" : "Simpan"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Step({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <span
          className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
          style={{ background: C.green, color: "#FFF" }}
        >
          {n}
        </span>
        <span className="text-sm font-semibold" style={{ color: C.ink }}>{label}</span>
      </div>
      {children}
    </div>
  );
}

function BookmarkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M6 4h12v16l-6-4-6 4V4Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
