import { useEffect, useMemo, useState } from "react";
import { C, RPB_FILES } from "../data";
import { readRpbTab } from "../lib/rpbSheet";
import { daftarTargetIlmu, bacaTandaTarget, simpanTandaTarget, kunciTarget, type TargetIlmu, type TandaTarget } from "../lib/targetIlmu";
import { useDraft } from "../lib/useDraft";
import { toast } from "./Toast";
import { GagalMuat } from "./GagalMuat";

/** Kartu "Target RPB bulan ini": tiap target ilmu dari RPB ditandai Sudah / Belum (+ keterangan). Dipakai tim kurikulum
 *  di Sajian Data untuk memperinci penilaian per target (menimpa nilai kelas dari Refleksi guru). */
export function TargetIlmuCard({ kelas, bulan, bisaUbah, onTersimpan }: { kelas: string; bulan: string; bisaUbah: boolean; onTersimpan?: () => void | Promise<void> }) {
  const [targets, setTargets] = useState<TargetIlmu[] | null>(null);
  const [tanda, setTanda] = useState<Record<number, TandaTarget | null>>({});
  const [dasar, setDasar] = useState<Record<number, TandaTarget | null>>({});
  const [gagal, setGagal] = useState<string | null>(null);
  const [muatUlang, setMuatUlang] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buka, setBuka] = useState(true);

  const file = RPB_FILES.find((f) => f.name === bulan);

  useEffect(() => {
    let batal = false;
    setTargets(null);
    setGagal(null);
    setError(null);
    if (!file) {
      setTargets([]);
      return;
    }
    Promise.all([readRpbTab(file.id, kelas), bacaTandaTarget(kelas, bulan)])
      .then(([rpb, tersimpan]) => {
        if (batal) return;
        const daftar = daftarTargetIlmu(rpb);
        const awal: Record<number, TandaTarget | null> = {};
        for (const t of daftar) {
          const s = tersimpan.get(kunciTarget(t.bidang, t.target));
          awal[t.urutan] = s ? { status: s.status, keterangan: s.keterangan ?? "" } : null;
        }
        setTargets(daftar);
        setTanda(awal);
        setDasar(awal);
      })
      .catch((e) => !batal && setGagal(e instanceof Error ? e.message : String(e)));
    return () => {
      batal = true;
    };
  }, [kelas, bulan, file?.id, muatUlang]);

  const draft = useDraft({
    formKey: bisaUbah && targets ? `tandaIlmu:${kelas}:${bulan}` : null,
    value: tanda,
    baseline: dasar,
    setValue: setTanda,
    ready: !!targets,
  });

  const berubah = useMemo(() => JSON.stringify(tanda) !== JSON.stringify(dasar), [tanda, dasar]);
  const sudah = targets?.filter((t) => tanda[t.urutan]?.status === "sudah").length ?? 0;

  function pilih(urutan: number, status: "sudah" | "belum") {
    setTanda((p) => {
      const lama = p[urutan];
      return { ...p, [urutan]: lama?.status === status ? null : { status, keterangan: lama?.keterangan ?? "" } };
    });
  }

  async function simpan() {
    if (!targets) return;
    setSaving(true);
    setError(null);
    try {
      await simpanTandaTarget(kelas, bulan, targets.map((t) => ({ ...t, tanda: tanda[t.urutan] ?? null })));
      setDasar(tanda);
      draft.clear();
      toast.sukses("Tanda target tersimpan");
      await onTersimpan?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
      <button type="button" onClick={() => setBuka((b) => !b)} className="w-full flex items-center gap-3 px-4 py-3 text-left" aria-expanded={buka}>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold" style={{ color: C.green }}>Target RPB {bulan}</div>
          <div className="text-xs" style={{ color: C.muted }}>
            {targets === null
              ? "Memuat target…"
              : targets.length === 0
                ? "Belum ada target ilmu di RPB bulan ini"
                : `${sudah} dari ${targets.length} target ditandai tercapai${bisaUbah ? " · tandai Sudah/Belum per target" : ""}`}
          </div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: C.muted, transform: buka ? "rotate(180deg)" : "none", transition: "transform .2s" }}>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {buka && (
        <div className="px-4 pb-4" style={{ borderTop: `1px solid ${C.line}` }}>
          {gagal ? (
            <GagalMuat pesan={gagal} onUlang={() => setMuatUlang((n) => n + 1)} />
          ) : targets === null ? (
            <div className="h-16 mt-3 rounded-xl animate-pulse" style={{ background: C.leaf }} />
          ) : targets.length === 0 ? (
            <p className="text-xs mt-3" style={{ color: C.muted }}>
              {file ? "Isi dulu Target Pembelajaran di RPB bulan ini, nanti target-targetnya muncul di sini untuk ditandai." : "File RPB bulan ini belum ada."}
            </p>
          ) : (
            <div className="mt-3 space-y-2.5">
              {targets.map((t) => {
                const tn = tanda[t.urutan];
                return (
                  <div key={t.urutan} className="rounded-xl p-3" style={{ background: C.mist, border: `1px solid ${C.line}` }}>
                    <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: C.green }}>{t.bidang}</div>
                    <div className="text-sm mt-0.5 whitespace-pre-wrap" style={{ color: C.ink }}>{t.target}</div>
                    <div className="flex gap-2 mt-2">
                      {(["sudah", "belum"] as const).map((st) => {
                        const aktif = tn?.status === st;
                        const warna = st === "sudah" ? C.green : "#B3261E";
                        return (
                          <button
                            key={st}
                            type="button"
                            disabled={!bisaUbah}
                            onClick={() => pilih(t.urutan, st)}
                            aria-pressed={aktif}
                            className="flex-1 text-xs font-semibold py-2 rounded-lg transition-colors disabled:cursor-default"
                            style={{ background: aktif ? warna : "#FFF", color: aktif ? "#FFF" : warna, border: `1px solid ${aktif ? warna : C.line}` }}
                          >
                            {st === "sudah" ? "✓ Sudah tercapai" : "✗ Belum tercapai"}
                          </button>
                        );
                      })}
                    </div>
                    {(tn || !bisaUbah) && (
                      bisaUbah ? (
                        <input
                          value={tn?.keterangan ?? ""}
                          onChange={(e) => setTanda((p) => ({ ...p, [t.urutan]: { status: p[t.urutan]!.status, keterangan: e.target.value } }))}
                          placeholder={tn?.status === "belum" ? "Keterangan: mis. santri yang belum, sampai mana, materi lain" : "Keterangan (boleh dikosongkan)"}
                          className="mt-2 w-full text-xs outline-none px-2.5 py-2 rounded-lg"
                          style={{ background: "#FFF", border: `1px solid ${C.line}` }}
                        />
                      ) : (
                        tn?.keterangan && <p className="text-xs mt-2" style={{ color: C.muted }}>{tn.keterangan}</p>
                      )
                    )}
                  </div>
                );
              })}
              {error && (
                <div className="rounded-xl px-3.5 py-2.5 text-xs" style={{ background: "#FDEBEA", border: "1px solid #E8A6A0", color: "#8A2A20" }}>{error}</div>
              )}
              {bisaUbah && (
                <button
                  type="button"
                  onClick={simpan}
                  disabled={saving || !berubah}
                  className="w-full text-sm font-semibold py-3 rounded-xl transition-opacity disabled:opacity-50"
                  style={{ background: C.green, color: "#FFF" }}
                >
                  {saving ? "Menyimpan…" : berubah ? "Simpan tanda target" : "Tanda target tersimpan"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
