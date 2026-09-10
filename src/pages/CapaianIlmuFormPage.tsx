import { useEffect, useMemo, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import {
  C,
  CAPAIAN_ILMU_FILES_DEV,
  capaianRoster,
  capaianIlmuBidang,
  capaianIlmuBidangFlat,
  isMonthOpen,
} from "../data";
import { useAuth } from "../contexts/AuthContext";
import { readCapaianIlmu, writeCapaianIlmu, type CapaianIlmuData } from "../lib/capaianIlmuSheet";
import { PageLoadingSkeleton } from "../components/Skeleton";
import { PickerCard } from "../components/PickerCard";

const BULAN_LIST = ["Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const GREEN_GRAD = `linear-gradient(135deg, ${C.green} 0%, ${C.greenDeep} 100%)`;

function norm(s: string) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
/** cocokin roster (nama lengkap) ke slot anak di sheet (nama lengkap / nama depan).
 *  Yang nggak ketemu -> slot baru di ujung (nggak nimpa baris anak yang udah ada di sheet). */
function matchRosterToSlots(roster: string[], slots: { idx: number; nama: string }[]): number[] {
  const used = new Set<number>();
  let nextNew = slots.length;
  const out = roster.map((rn) => {
    const r = norm(rn);
    const rWords = r.split(" ");
    for (const s of slots) {
      if (used.has(s.idx)) continue;
      const sn = norm(s.nama);
      if (!sn) continue;
      if (r === sn || r.includes(sn) || sn.includes(r) || sn.split(" ")[0] === rWords[0] || sn.split(" ").slice(-1)[0] === rWords.slice(-1)[0]) {
        used.add(s.idx);
        return s.idx;
      }
    }
    return -1;
  });
  return out.map((v) => (v >= 0 ? v : nextNew++));
}

export default function CapaianIlmuFormPage() {
  const navigate = useNavigate();
  const { kelas } = useAuth();

  const fileId = kelas ? CAPAIAN_ILMU_FILES_DEV[kelas] : undefined;
  const roster = useMemo(() => (kelas ? capaianRoster(kelas) : []), [kelas]);
  const groups = useMemo(() => (kelas ? capaianIlmuBidang(kelas) : []), [kelas]);
  const bidangFlat = useMemo(() => (kelas ? capaianIlmuBidangFlat(kelas) : []), [kelas]);

  const [bulan, setBulan] = useState<string | null>(null);
  const [data, setData] = useState<CapaianIlmuData | null>(null);
  const [anakI, setAnakI] = useState<number | null>(null); // index dalam roster
  const [form, setForm] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const rosterSlots = useMemo(
    () => (data ? matchRosterToSlots(roster, data.anak) : []),
    [data, roster]
  );

  useEffect(() => {
    if (!bulan || !fileId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSaveMsg(null);
    setData(null);
    setAnakI(null);
    readCapaianIlmu(fileId, bulan)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [bulan, fileId]);

  // isi form dari sheet tiap ganti anak / data
  useEffect(() => {
    if (!data || anakI == null) {
      setForm({});
      return;
    }
    const slot = rosterSlots[anakI];
    const f: Record<string, string> = {};
    for (const b of bidangFlat) f[b.key] = data.values[b.key]?.[slot] ?? "";
    setForm(f);
  }, [data, anakI, rosterSlots, bidangFlat]);

  if (!kelas) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: C.mist }}>
        <p className="text-sm" style={{ color: C.muted }}>Kelas belum diset untuk akun ini.</p>
      </div>
    );
  }
  if (!fileId) return <Navigate to="/capaian" replace />;

  async function handleSave() {
    if (!fileId || !bulan || anakI == null) return;
    const slot = rosterSlots[anakI];
    setSaving(true);
    setError(null);
    setSaveMsg(null);
    try {
      await writeCapaianIlmu({
        fileId,
        bulan,
        cells: bidangFlat.map((b) => ({ bidangKey: b.key, anakIdx: slot, value: form[b.key] ?? "" })),
        names: [{ anakIdx: slot, nama: roster[anakI] }],
      });
      setSaveMsg("Tersimpan ke sheet (salinan uji coba).");
      // update cache lokal biar pindah anak tetep keliatan
      setData((prev) => {
        if (!prev) return prev;
        const v = { ...prev.values };
        for (const b of bidangFlat) {
          const arr = [...(v[b.key] ?? [])];
          arr[slot] = form[b.key] ?? "";
          v[b.key] = arr;
        }
        return { ...prev, values: v };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function samakanSemua(bidangKey: string) {
    if (!fileId || !bulan) return;
    const val = form[bidangKey] ?? "";
    if (!window.confirm(`Isi "${val || "(kosong)"}" ke SEMUA santri untuk bidang ini?`)) return;
    setSaving(true);
    setError(null);
    setSaveMsg(null);
    try {
      await writeCapaianIlmu({
        fileId,
        bulan,
        cells: roster.map((_, i) => ({ bidangKey, anakIdx: rosterSlots[i], value: val })),
        names: roster.map((nm, i) => ({ anakIdx: rosterSlots[i], nama: nm })),
      });
      setSaveMsg("Bidang ini diisikan ke semua santri.");
      setData((prev) => {
        if (!prev) return prev;
        const arr = [...(prev.values[bidangKey] ?? [])];
        roster.forEach((_, i) => (arr[rosterSlots[i]] = val));
        return { ...prev, values: { ...prev.values, [bidangKey]: arr } };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

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
              Capaian Ilmu
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

          {/* Langkah 2 — Santri */}
          {data && !loading && (
            <Step n={2} label="Pilih santri">
              {roster.length === 0 ? (
                <p className="text-sm" style={{ color: C.muted }}>
                  Belum ada daftar santri buat kelas ini — hubungi koordinator kurikulum.
                </p>
              ) : (
                <PickerCard
                  items={roster.map((n) => ({ label: n }))}
                  value={anakI}
                  onChange={(i) => {
                    setAnakI(i);
                    setSaveMsg(null);
                  }}
                  placeholderLabel="Pilih nama santri"
                  selectedLabel="Santri terpilih"
                  countText={`${roster.length} santri`}
                />
              )}
            </Step>
          )}

          {/* Langkah 3 — Isi bidang ilmu */}
          {data && anakI != null && (
            <div
              className="relative rounded-2xl p-4 sm:p-5"
              style={{ background: GREEN_GRAD, boxShadow: "0 4px 14px rgba(28,74,51,0.14)" }}
            >
              <div className="absolute inset-0 overflow-hidden rounded-2xl" aria-hidden="true">
                <span className="absolute -right-6 -top-6 w-28 h-28 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
              </div>
              <div className="relative">
                <div className="text-sm font-bold uppercase tracking-[0.1em]" style={{ color: "#FFF" }}>
                  {roster[anakI]} · {bulan}
                </div>
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.8)" }}>
                  Tulis capaian tiap bidang. Tombol "samakan" mengisi bidang itu ke semua santri sekaligus.
                </p>

                <div className="mt-4 space-y-4">
                  {groups.map((g, gi) => (
                    <div key={gi}>
                      {g.grup && (
                        <div className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "rgba(255,255,255,0.85)" }}>
                          {g.grup}
                        </div>
                      )}
                      <div className="space-y-2.5">
                        {g.items.map((b) => (
                          <div key={b.key} className="rounded-xl p-3" style={{ background: "#FFF" }}>
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="text-xs font-bold uppercase tracking-wide" style={{ color: C.green }}>
                                {b.label}
                              </span>
                              <button
                                onClick={() => samakanSemua(b.key)}
                                disabled={saving}
                                className="text-[11px] font-semibold px-2 py-1 rounded-md shrink-0"
                                style={{ background: C.leaf, color: C.green }}
                              >
                                Samakan semua
                              </button>
                            </div>
                            <textarea
                              value={form[b.key] ?? ""}
                              onChange={(e) => setForm((p) => ({ ...p, [b.key]: e.target.value }))}
                              rows={2}
                              placeholder="—"
                              className="w-full text-sm outline-none px-3 py-2 rounded-lg resize-y"
                              style={{ border: `1px solid ${C.line}` }}
                            />
                          </div>
                        ))}
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
                  disabled={saving}
                  className="mt-4 w-full py-3 rounded-xl text-sm font-bold transition-opacity"
                  style={{ background: "#FFF", color: C.green, opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? "Menyimpan…" : `Simpan capaian ${roster[anakI].split(" ")[0]}`}
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

