import { toast } from "../components/Toast";
import { useEffect, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import JurnalGabungan from "../components/JurnalGabungan";
import { supabase } from "../lib/supabaseClient";
import { readJurnalRange, type JurnalEntry } from "../lib/jurnal";
import { C, isMonthOpen, olahragaRoster } from "../data";
import { useAuth } from "../contexts/AuthContext";
import { PageLoadingSkeleton } from "../components/Skeleton";
import { GagalMuat } from "../components/GagalMuat";
import { useDraft } from "../lib/useDraft";
import { RuleCard } from "../components/RuleCard";
import { MonthGrid } from "../components/MonthGrid";
import { PickerCard } from "../components/PickerCard";
import UnduhKehadiranBulan from "../components/UnduhKehadiranBulan";
import { bacaAbsenSantriOlahragaRentang, type BarisAbsenSantriOlahraga, bacaAbsenSantriOlahraga, simpanAbsenSantriOlahraga, entriBaru, sudahDiabsen, type AbsenHariOlahraga, type EntriSantriOlahraga } from "../lib/absenSantriOlahraga";
import { AccentCard, BackButton } from "../components/PortalComponents";
import {
  STATUS_LABEL,
  mondayOf,
  weekdaysFrom,
  ymd,
  labelHari,
  labelTanggal,
  labelRentangPekan,
  type AbsenStatus,
} from "../lib/absen";
import {
  readOlahragaBulan,
  saveOlahraga,
  emptyOlahraga,
  isRencanaFilled,
  adaTargetPekan,
  adaAlatPekan,
  kelasJurnalOlahraga,
  readEvaluasiAnak,
  saveEvaluasiAnakBatch,
  emptyEvalAnak,
  isEvalAnakFilled,
  readAbsenOlahragaRange,
  readAbsenOlahragaRangeGabungan,
  type AbsenOlahragaPerKelompok,
  saveAbsenOlahraga,
  emptyAbsenOlahraga,
  isAbsenOlahragaFilled,
  TINGKAT_LIST,
  BULAN_OLAHRAGA,
  TARGET_PRESET,
  PEKAN_FIELDS,
  EVAL_FIELDS,
  KELOMPOK_LABEL,
  type OlahragaEntry,
  type OlahragaTingkat,
  type OlahragaKelompok,
  type EvalAnakEntry,
  type AbsenOlahragaEntry,
  namaAspek,
  nilaiSama,
  type NilaiOlahraga,
} from "../lib/olahraga";
import {
  NILAI_OLAHRAGA,
  aspekDariRencana,
  bacaRubrik,
  simpanRubrik,
  kunciAspek,
  deskripsiNilai,
  rubrikKosong,
  rubrikLengkap,
  type Rubrik,
} from "../lib/olahragaNilai";

type Mode = "rencana" | "evaluasi" | "absen" | "jurnal";
type GuruMode = Exclude<Mode, "jurnal">;
const MODES: Mode[] = ["rencana", "evaluasi", "absen", "jurnal"];
const MODE_TITLE: Record<Mode, string> = {
  rencana: "Rencana Kegiatan Olahraga",
  evaluasi: "Evaluasi Kegiatan Olahraga",
  absen: "Absen Olahraga",
  jurnal: "Jurnal Olahraga",
};

const GRADIENTS = [
  `linear-gradient(135deg, ${C.green} 0%, ${C.greenDeep} 100%)`,
  "linear-gradient(135deg, #C79A3B 0%, #8A6A20 100%)",
  `linear-gradient(135deg, #2F8A63 0%, #1F6244 100%)`,
];

const MONTH_NUM: Record<string, number> = {
  Juli: 7, Agustus: 8, September: 9, Oktober: 10, November: 11, Desember: 12,
};
function defaultBulan(): string {
  const m = new Date().getMonth() + 1;
  return BULAN_OLAHRAGA.find((b) => MONTH_NUM[b] === m) ?? BULAN_OLAHRAGA[0];
}

export default function OlahragaPage() {
  const { mode: modeParam } = useParams<{ mode: string }>();
  const { role } = useAuth();
  const mode = (MODES as string[]).includes(modeParam ?? "") ? (modeParam as Mode) : null;

  if (!mode) {
    // Management punya home tersendiri (3 kartu Rencana/Evaluasi/Absen) di route bare
    // `/olahraga`; guru/olahraga-guru langsung diarahkan ke Rencana seperti sebelumnya.
    if (role === "management") return <OlahragaModePicker />;
    return <Navigate to="/olahraga/rencana" replace />;
  }

  if (role === "management") return <ManagementOlahraga mode={mode} />;
  // Guru olahraga menulis jurnal lewat halaman Daily Jurnal biasa (/jurnal), bukan di sini.
  if (mode === "jurnal") return <Navigate to="/jurnal" replace />;
  return <GuruOlahraga mode={mode} />;
}

/* ═══════════════════════ Guru olahraga ═══════════════════════ */

function GuruOlahraga({ mode }: { mode: GuruMode }) {
  const { kelompok, fullName } = useAuth();

  if (kelompok !== "ikhwan" && kelompok !== "akhwat") {
    return (
      <div className="min-h-dvh flex items-center justify-center px-6" style={{ background: C.mist }}>
        <p className="text-sm text-center" style={{ color: C.muted }}>
          Akun ini belum ditandai sebagai guru olahraga ikhwan / akhwat. Hubungi admin.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh" style={{ background: C.mist, color: C.ink }}>
      <div className="max-w-2xl mx-auto px-4 pt-6 sm:pt-9 pb-32 sm:pb-40">
        <HeaderCard
          title={MODE_TITLE[mode]}
          name={fullName || `Guru Olahraga ${KELOMPOK_LABEL[kelompok]}`}
          sub="Kuttab Awwal 1–3"
        />

        {/* Pindah mode Rencana/Evaluasi/Absen sekarang lewat menu bawah (BottomNav/Sidebar),
            bukan tab di dalam halaman — biar gak dobel sama menunya. */}

        {mode === "absen" ? (
          <AbsenOlahragaTab kelompok={kelompok} />
        ) : mode === "rencana" ? (
          <GuruRencana kelompok={kelompok} />
        ) : (
          <GuruEvaluasi kelompok={kelompok} />
        )}
      </div>
    </div>
  );
}

function GuruRencana({ kelompok }: { kelompok: OlahragaKelompok }) {
  const [bulan, setBulan] = useState<string>(defaultBulan);
  const [entries, setEntries] = useState<Record<string, OlahragaEntry>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openTingkat, setOpenTingkat] = useState<string | null>("KA 1");
  const [muatUlang, setMuatUlang] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    readOlahragaBulan(bulan, {})
      .then((m) => !cancelled && setEntries(m))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [bulan, muatUlang]);

  return (
    <>
      <div className="mt-4">
        <span className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: C.green }}>Bulan</span>
        <MonthGrid months={BULAN_OLAHRAGA} value={bulan} onSelect={setBulan} isOpen={isMonthOpen} />
      </div>

      {loading ? (
        <div className="mt-5">
          <PageLoadingSkeleton />
        </div>
      ) : error ? (
        // Data gagal dimuat: form disembunyikan, karena menyimpan form kosong akan menimpa rencana yang sudah ada.
        <GagalMuat pesan={error} onUlang={() => setMuatUlang((n) => n + 1)} />
      ) : (
        <div className="mt-5 space-y-3">
          {TINGKAT_LIST.map((t) => (
            <TingkatCard
              key={t}
              tingkat={t}
              bulan={bulan}
              kelompok={kelompok}
              entry={entries[t] ?? emptyOlahraga(t, bulan)}
              open={openTingkat === t}
              onToggle={() => setOpenTingkat((o) => (o === t ? null : t))}
              onSaved={(saved) => setEntries((prev) => ({ ...prev, [t]: saved }))}
            />
          ))}
        </div>
      )}
    </>
  );
}

/* ───────── Evaluasi (guru) — per anak, dikelompokkan per tingkat ───────── */

function GuruEvaluasi({ kelompok }: { kelompok: OlahragaKelompok }) {
  const [bulan, setBulan] = useState<string>(defaultBulan);
  const [openTingkat, setOpenTingkat] = useState<string | null>("KA 1");

  return (
    <>
      <div className="mt-4">
        <span className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: C.green }}>Bulan</span>
        <MonthGrid months={BULAN_OLAHRAGA} value={bulan} onSelect={setBulan} isOpen={isMonthOpen} />
      </div>

      <div className="mt-5 space-y-3">
        {TINGKAT_LIST.map((t) => (
          <EvaluasiTingkatCard
            key={t}
            tingkat={t}
            bulan={bulan}
            kelompok={kelompok}
            open={openTingkat === t}
            onToggle={() => setOpenTingkat((o) => (o === t ? null : t))}
          />
        ))}
      </div>
    </>
  );
}

function EvaluasiTingkatCard({
  tingkat,
  bulan,
  kelompok,
  open,
  onToggle,
}: {
  tingkat: OlahragaTingkat;
  bulan: string;
  kelompok: OlahragaKelompok;
  open: boolean;
  onToggle: () => void;
}) {
  const roster = useMemo(() => olahragaRoster(tingkat, kelompok), [tingkat, kelompok]);
  const [data, setData] = useState<Record<string, EvalAnakEntry>>({});
  const [form, setForm] = useState<Record<string, EvalAnakEntry>>({});
  const [loading, setLoading] = useState(true);
  const [openAnak, setOpenAnak] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [gagalMuat, setGagalMuat] = useState<string | null>(null);
  const [muatUlang, setMuatUlang] = useState(0);
  // Aspek yang dinilai A–D = target di Rencana bulan ini (tingkat & kelompok yang sama).
  const [aspek, setAspek] = useState<string[]>([]);
  const [rubrik, setRubrik] = useState<Record<string, Rubrik>>({});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    setGagalMuat(null);
    setMsg(null);
    Promise.all([readEvaluasiAnak(tingkat, bulan, {}), readOlahragaBulan(bulan, { kelompok }), bacaRubrik()])
      .then(([d, ren, rb]) => {
        if (cancelled) return;
        setData(d);
        setForm(d);
        setAspek(aspekDariRencana(ren[tingkat]));
        setRubrik(rb);
      })
      .catch((e) => !cancelled && setGagalMuat(e instanceof Error ? e.message : String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tingkat, bulan, muatUlang]);

  const anyFilled = Object.values(data).some((e) => isEvalAnakFilled(e));
  const dirty = JSON.stringify(form) !== JSON.stringify(data);

  const draft = useDraft({
    formKey: open ? `olahraga-eval:${kelompok}:${tingkat}:${bulan}` : null,
    value: form,
    baseline: data,
    setValue: setForm,
    ready: open && !loading,
  });

  const setAnak = (nama: string, k: (typeof EVAL_FIELDS)[number]["key"], v: string) =>
    setForm((p) => ({ ...p, [nama]: { ...(p[nama] ?? emptyEvalAnak()), [k]: v } }));

  // Ketuk huruf untuk memilih; ketuk huruf yang sama lagi untuk menghapus.
  const setNilai = (nama: string, a: string, n: NilaiOlahraga) =>
    setForm((p) => {
      const e = p[nama] ?? emptyEvalAnak();
      const nilai = { ...(e.nilai ?? {}) };
      if (nilai[a] === n) delete nilai[a];
      else nilai[a] = n;
      return { ...p, [nama]: { ...e, nilai } };
    });

  async function handleSave() {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      await saveEvaluasiAnakBatch({ kelompok, tingkat, bulan, entries: form });
      // Jangan percaya begitu aja: baca ulang dari server & pastikan isinya beneran ada. Kalau
      // gak cocok, tampilkan error (draf di perangkat tetap aman) -- bukan "Tersimpan" palsu.
      const fresh = await readEvaluasiAnak(tingkat, bulan, {});
      const t = (x: string | undefined) => (x ?? "").trim();
      const mismatch = Object.entries(form).some(([nama, e]) => {
        const f = fresh[nama];
        return (
          !f ||
          t(f.eval_ketercapaian) !== t(e.eval_ketercapaian) ||
          t(f.eval_partisipasi) !== t(e.eval_partisipasi) ||
          t(f.eval_kendala) !== t(e.eval_kendala) ||
          t(f.eval_perkembangan) !== t(e.eval_perkembangan) ||
          t(f.eval_tindak_lanjut) !== t(e.eval_tindak_lanjut) ||
          !nilaiSama(f.nilai, e.nilai)
        );
      });
      if (mismatch) {
        throw new Error("Data belum terbaca di server setelah disimpan. Ketikanmu masih aman di perangkat — coba tekan Simpan sekali lagi.");
      }
      setData(fresh);
      setForm(fresh);
      draft.clear();
      toast.sukses("Tersimpan");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors"
        style={{ background: open ? C.leaf : "#FFF" }}
      >
        <span
          className="w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 leading-none"
          style={{ background: anyFilled ? C.green : C.leaf, color: anyFilled ? "#FFF" : C.green }}
        >
          <span className="text-[9px] font-semibold uppercase">KA</span>
          <span className="text-sm font-bold">{tingkat.replace("KA ", "")}</span>
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold" style={{ color: C.ink }}>Kuttab Awwal {tingkat.replace("KA ", "")}</span>
          <span className="block text-xs truncate" style={{ color: C.muted }}>
            {roster.length === 0 ? "Belum ada roster santri" : anyFilled ? "Evaluasi sudah diisi — ketuk untuk lihat / edit" : "Evaluasi belum diisi"}
          </span>
        </span>
        {anyFilled && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0" style={{ color: C.green }}>
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          className="shrink-0 transition-transform"
          style={{ color: C.muted, transform: open ? "rotate(180deg)" : "none" }}
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="px-3.5 pb-4 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
          {roster.length === 0 ? (
            <p className="text-sm" style={{ color: C.muted }}>Belum ada daftar santri buat tingkat ini — hubungi koordinator kurikulum.</p>
          ) : loading ? (
            <PageLoadingSkeleton />
          ) : gagalMuat ? (
            // Evaluasi gagal dimuat: form disembunyikan supaya isian lama tidak tertimpa kosong.
            <GagalMuat pesan={gagalMuat} onUlang={() => setMuatUlang((n) => n + 1)} />
          ) : (
            <>
              {aspek.length > 0 ? (
                <RubrikDaftar aspek={aspek} rubrik={rubrik} />
              ) : (
                <p className="rounded-xl px-3 py-2.5 text-xs leading-relaxed" style={{ background: C.mist, border: `1px solid ${C.line}`, color: C.muted }}>
                  Belum ada target di Rencana {bulan} untuk tingkat ini. Isi target di Rencana supaya aspek yang dinilai A–D muncul di sini.
                </p>
              )}
              <div className="space-y-2 mt-3">
                {roster.map((nama) => {
                  const entry = form[nama] ?? emptyEvalAnak();
                  const filled = isEvalAnakFilled(data[nama]);
                  const anakOpen = openAnak === nama;
                  return (
                    <div key={nama} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${anakOpen ? C.green : C.line}` }}>
                      <button
                        type="button"
                        onClick={() => setOpenAnak((o) => (o === nama ? null : nama))}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: filled ? C.green : C.line }} aria-hidden="true" />
                        <span className="flex-1 text-sm font-medium truncate" style={{ color: C.ink }}>{nama}</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" style={{ transform: anakOpen ? "rotate(180deg)" : "none", transition: "transform .2s", color: C.muted }}>
                          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      {anakOpen && (
                        <div className="px-3 pb-3 space-y-2.5" style={{ borderTop: `1px solid ${C.line}` }}>
                          {aspek.length > 0 && (
                            <div className="pt-3">
                              <span className="block text-xs font-semibold" style={{ color: C.green }}>Nilai kemampuan</span>
                              <div className="mt-2 space-y-2.5">
                                {aspek.map((a) => (
                                  <NilaiAspek key={a} aspek={a} nilai={entry.nilai?.[a]} rubrik={rubrik[kunciAspek(a)]} onPilih={(n) => setNilai(nama, a, n)} />
                                ))}
                              </div>
                            </div>
                          )}
                          {EVAL_FIELDS.map((f) => (
                            <Field key={f.key} label={f.label}>
                              <textarea
                                value={entry[f.key]}
                                onChange={(e) => setAnak(nama, f.key, e.target.value)}
                                rows={2}
                                placeholder="Tulis di sini…"
                                className="w-full text-sm outline-none px-3 py-2 rounded-lg resize-y mt-2"
                                style={{ border: `1px solid ${C.line}` }}
                              />
                            </Field>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {err && <p className="mt-3 text-xs" style={{ color: "#8A2A20" }}>{err}</p>}
              {msg && <p className="mt-3 text-xs font-medium" style={{ color: C.green }}>{msg}</p>}

              <button
                onClick={handleSave}
                disabled={saving || !dirty}
                className="mt-3 w-full py-2.5 rounded-xl text-sm font-bold transition-opacity"
                style={{ background: C.green, color: "#FFF", opacity: saving || !dirty ? 0.5 : 1 }}
              >
                {saving ? "Menyimpan…" : anyFilled ? "Simpan perubahan" : "Simpan"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TingkatCard({
  tingkat,
  bulan,
  kelompok,
  entry,
  open,
  onToggle,
  onSaved,
}: {
  tingkat: OlahragaTingkat;
  bulan: string;
  kelompok: OlahragaKelompok;
  entry: OlahragaEntry;
  open: boolean;
  onToggle: () => void;
  onSaved: (e: OlahragaEntry) => void;
}) {
  const [form, setForm] = useState<OlahragaEntry>(entry);
  const [saving, setSaving] = useState(false);
  // Deskripsi A–D target tambahan (buatan guru): yang tersimpan & yang sedang diketik.
  const [rubrik, setRubrik] = useState<Record<string, Rubrik>>({});
  const [rubrikForm, setRubrikForm] = useState<Record<string, Rubrik>>({});
  useEffect(() => {
    if (!open) return;
    bacaRubrik()
      .then(setRubrik)
      .catch(() => undefined);
  }, [open]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const targetKey = PEKAN_FIELDS.map((f) => entry[f.targetKey].join("|")).join("||");
  const entryAsForm = (): OlahragaEntry => ({
    tingkat: entry.tingkat,
    bulan: entry.bulan,
    pekan1: entry.pekan1,
    pekan2: entry.pekan2,
    pekan3: entry.pekan3,
    pekan4: entry.pekan4,
    target_pekan1: [...entry.target_pekan1],
    target_pekan2: [...entry.target_pekan2],
    target_pekan3: [...entry.target_pekan3],
    target_pekan4: [...entry.target_pekan4],
    alat_pekan1: entry.alat_pekan1,
    alat_pekan2: entry.alat_pekan2,
    alat_pekan3: entry.alat_pekan3,
    alat_pekan4: entry.alat_pekan4,
    target: [...entry.target],
    alat: entry.alat,
  });
  useEffect(() => {
    setForm(entryAsForm());
    setMsg(null);
    setErr(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    entry.tingkat, entry.bulan, targetKey, entry.alat,
    entry.pekan1, entry.pekan2, entry.pekan3, entry.pekan4,
    entry.alat_pekan1, entry.alat_pekan2, entry.alat_pekan3, entry.alat_pekan4,
  ]);

  const draft = useDraft({
    formKey: open ? `olahraga-rencana:${kelompok}:${tingkat}:${bulan}` : null,
    value: form,
    baseline: entryAsForm(),
    setValue: setForm,
  });

  const rencanaOk = isRencanaFilled(entry);

  const tambahan = aspekDariRencana(form).filter((a) => !TARGET_PRESET.includes(a));
  const rubrikTambahan = (a: string) => rubrikForm[kunciAspek(a)] ?? rubrik[kunciAspek(a)] ?? rubrikKosong(a);
  const rubrikBerubah = tambahan.filter((a) => {
    const f = rubrikForm[kunciAspek(a)];
    const r = rubrik[kunciAspek(a)] ?? rubrikKosong(a);
    return !!f && (f.a !== r.a || f.b !== r.b || f.c !== r.c || f.d !== r.d);
  });

  const dirty =
    rubrikBerubah.length > 0 ||
    PEKAN_FIELDS.some(
      (f) =>
        form[f.key] !== entry[f.key] ||
        form[f.alatKey] !== entry[f.alatKey] ||
        form[f.targetKey].join("|") !== entry[f.targetKey].join("|")
    );

  // Data lama: dulu alat diisi satu untuk sebulan. Selama belum ada alat per pekan, tampilkan sebagai catatan
  // dan beri jalan pintas menyalinnya ke tiap pekan.
  const alatLama = entry.alat.trim() && !adaAlatPekan(form) ? entry.alat.trim() : null;

  // Data lama: dulu target diisi satu untuk sebulan. Selama belum ada target per pekan, tampilkan sebagai catatan
  // dan beri jalan pintas menyalinnya ke tiap pekan (bisa diubah per pekan setelahnya).
  const targetLama = entry.target.length > 0 && !adaTargetPekan(form) ? entry.target : null;

  const set = <K extends keyof OlahragaEntry>(k: K, v: OlahragaEntry[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  async function handleSave() {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      await saveOlahraga({
        kelompok,
        tingkat,
        bulan,
        pekan1: form.pekan1,
        pekan2: form.pekan2,
        pekan3: form.pekan3,
        pekan4: form.pekan4,
        target_pekan1: form.target_pekan1,
        target_pekan2: form.target_pekan2,
        target_pekan3: form.target_pekan3,
        target_pekan4: form.target_pekan4,
        alat_pekan1: form.alat_pekan1,
        alat_pekan2: form.alat_pekan2,
        alat_pekan3: form.alat_pekan3,
        alat_pekan4: form.alat_pekan4,
      });
      if (rubrikBerubah.length) {
        await simpanRubrik(rubrikBerubah.map(rubrikTambahan));
        setRubrik(await bacaRubrik());
        setRubrikForm({});
      }
      const saved: OlahragaEntry = { ...form, tingkat, bulan };
      onSaved(saved);
      setForm(saved);
      draft.clear();
      toast.sukses("Tersimpan");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const done = rencanaOk;
  const statusLine = rencanaOk ? "Rencana sudah diisi — ketuk untuk lihat / edit" : "Rencana belum diisi";

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "#FFF", border: `1px solid ${C.line}` }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors"
        style={{ background: open ? C.leaf : "#FFF" }}
      >
        <span
          className="w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 leading-none"
          style={{ background: done ? C.green : C.leaf, color: done ? "#FFF" : C.green }}
        >
          <span className="text-[9px] font-semibold uppercase">KA</span>
          <span className="text-sm font-bold">{tingkat.replace("KA ", "")}</span>
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold" style={{ color: C.ink }}>Kuttab Awwal {tingkat.replace("KA ", "")}</span>
          <span className="block text-xs truncate" style={{ color: C.muted }}>{statusLine}</span>
        </span>
        {done && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0" style={{ color: C.green }}>
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          className="shrink-0 transition-transform"
          style={{ color: C.muted, transform: open ? "rotate(180deg)" : "none" }}
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="px-3.5 pb-4 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
          <div className="space-y-3 mt-3">
            {targetLama && (
              <div className="rounded-xl px-3 py-2.5 text-xs" style={{ background: "#FFF8E6", border: "1px solid #EBD9A5", color: "#6B5314" }}>
                <div className="font-semibold">Target bulan ini masih satu gabungan:</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {targetLama.map((x) => (
                    <span key={x} className="px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: "#FFF", border: "1px solid #EBD9A5" }}>
                      {x}
                    </span>
                  ))}
                </div>
                <p className="mt-1.5 leading-relaxed">Sekarang target diisi per pekan supaya fokus tiap pekan terlihat jelas.</p>
                <button
                  type="button"
                  onClick={() =>
                    setForm((p) => ({
                      ...p,
                      target_pekan1: [...targetLama],
                      target_pekan2: [...targetLama],
                      target_pekan3: [...targetLama],
                      target_pekan4: [...targetLama],
                    }))
                  }
                  className="mt-2 px-3 py-1.5 rounded-lg text-xs font-bold"
                  style={{ background: "#FFF", color: C.green, border: `1px solid ${C.green}` }}
                >
                  Salin ke semua pekan
                </button>
              </div>
            )}

            {PEKAN_FIELDS.map((f) => (
              <div key={f.key} className="rounded-xl p-3" style={{ background: C.mist, border: `1px solid ${C.line}` }}>
                <div className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: C.green }}>{f.label}</div>
                <div className="space-y-3">
                  <Field label="Kegiatan">
                    <textarea
                      value={form[f.key]}
                      onChange={(e) => set(f.key, e.target.value)}
                      rows={2}
                      placeholder="Kegiatan olahraga pekan ini…"
                      className="w-full text-sm outline-none px-3 py-2 rounded-lg resize-y"
                      style={{ border: `1px solid ${C.line}`, background: "#FFF" }}
                    />
                  </Field>
                  <Field label="Target olahraga pekan ini">
                    <TargetPicker value={form[f.targetKey]} onChange={(v) => set(f.targetKey, v)} />
                  </Field>
                  <Field label="Alat yang digunakan">
                    <textarea
                      value={form[f.alatKey]}
                      onChange={(e) => set(f.alatKey, e.target.value)}
                      rows={1}
                      placeholder="Bola, cone, tali, matras…"
                      className="w-full text-sm outline-none px-3 py-2 rounded-lg resize-y"
                      style={{ border: `1px solid ${C.line}`, background: "#FFF" }}
                    />
                  </Field>
                </div>
              </div>
            ))}

            {alatLama && (
              <div className="rounded-xl px-3 py-2.5 text-xs" style={{ background: "#FFF8E6", border: "1px solid #EBD9A5", color: "#6B5314" }}>
                <div className="font-semibold">Alat bulan ini masih satu untuk sebulan:</div>
                <p className="mt-1 whitespace-pre-wrap">{alatLama}</p>
                <p className="mt-1.5 leading-relaxed">Sekarang alat diisi per pekan, sesuai kegiatan tiap pekan.</p>
                <button
                  type="button"
                  onClick={() =>
                    setForm((p) => ({ ...p, alat_pekan1: alatLama, alat_pekan2: alatLama, alat_pekan3: alatLama, alat_pekan4: alatLama }))
                  }
                  className="mt-2 px-3 py-1.5 rounded-lg text-xs font-bold"
                  style={{ background: "#FFF", color: C.green, border: `1px solid ${C.green}` }}
                >
                  Salin ke semua pekan
                </button>
              </div>
            )}

            {tambahan.length > 0 && (
              <div className="rounded-xl p-3" style={{ background: C.mist, border: `1px solid ${C.line}` }}>
                <div className="text-xs font-bold uppercase tracking-wider" style={{ color: C.green }}>Arti nilai target tambahan</div>
                <p className="mt-1 text-[11px] leading-relaxed" style={{ color: C.muted }}>
                  Target ini nanti dinilai A–D di Evaluasi. Tulis arti tiap nilai supaya penilaiannya punya ukuran yang sama.
                </p>
                <div className="mt-2.5 space-y-3">
                  {tambahan.map((a) => {
                    const r = rubrikTambahan(a);
                    return (
                      <div key={a}>
                        <div className="text-sm font-semibold" style={{ color: C.ink }}>
                          {a}
                          {!rubrikLengkap(r) && <span className="ml-1.5 text-[11px] font-medium" style={{ color: "#9F5A0B" }}>belum lengkap</span>}
                        </div>
                        {NILAI_OLAHRAGA.map((n) => {
                          const k = n.toLowerCase() as "a" | "b" | "c" | "d";
                          return (
                            <label key={n} className="flex items-center gap-2 mt-1.5">
                              <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0" style={{ background: C.leaf, color: C.green }}>
                                {n}
                              </span>
                              <input
                                value={r[k]}
                                onChange={(e) => setRubrikForm((p) => ({ ...p, [kunciAspek(a)]: { ...r, [k]: e.target.value } }))}
                                placeholder={CONTOH_RUBRIK[n]}
                                className="flex-1 min-w-0 text-sm outline-none px-3 py-1.5 rounded-lg"
                                style={{ border: `1px solid ${C.line}`, background: "#FFF" }}
                              />
                            </label>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {err && <p className="mt-3 text-xs" style={{ color: "#8A2A20" }}>{err}</p>}
          {msg && <p className="mt-3 text-xs font-medium" style={{ color: C.green }}>{msg}</p>}

          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="mt-3 w-full py-2.5 rounded-xl text-sm font-bold transition-opacity"
            style={{ background: C.green, color: "#FFF", opacity: saving || !dirty ? 0.5 : 1 }}
          >
            {saving ? "Menyimpan…" : done ? "Simpan perubahan" : "Simpan"}
          </button>
        </div>
      )}
    </div>
  );
}

function TargetPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [custom, setCustom] = useState("");
  const toggle = (t: string) =>
    onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t]);
  const addCustom = () => {
    const t = namaAspek(custom);
    if (t && !value.some((x) => x.toLowerCase() === t.toLowerCase())) onChange([...value, t]);
    setCustom("");
  };
  const extras = value.filter((v) => !TARGET_PRESET.includes(v));

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {TARGET_PRESET.map((t) => {
          const on = value.includes(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggle(t)}
              className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
              style={{
                background: on ? C.green : "#FFF",
                color: on ? "#FFF" : C.ink,
                border: `1px solid ${on ? C.green : C.line}`,
              }}
            >
              {t}
            </button>
          );
        })}
        {extras.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => toggle(t)}
            className="px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1"
            style={{ background: C.green, color: "#FFF", border: `1px solid ${C.green}` }}
          >
            {t}
            <span aria-hidden="true">×</span>
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="Tambah target lain…"
          className="flex-1 text-sm outline-none px-3 py-1.5 rounded-lg"
          style={{ border: `1px solid ${C.line}` }}
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!custom.trim()}
          className="px-3 py-1.5 rounded-lg text-xs font-bold"
          style={{ background: C.leaf, color: C.green, border: `1px solid ${C.green}`, opacity: custom.trim() ? 1 : 0.5 }}
        >
          Tambah
        </button>
      </div>
    </div>
  );
}

/* ───────── Absen olahraga (guru) — 1x/hari, Senin–Rabu saja, gak ada jam ───────── */

const ABSEN_OLAHRAGA_RULES = [
  "Cukup tandai kedatangan — gak perlu jam datang/pulang.",
  "Kalau berhalangan, pilih Izin / Sakit / Cuti dan tulis keterangannya.",
  "Hari yang terlewat masih bisa dikoreksi; tanggal yang belum tiba belum bisa diisi.",
];

function GuruAbsenOlahraga({ kelompok }: { kelompok: OlahragaKelompok }) {
  const thisMonday = useMemo(() => mondayOf(new Date()), []);
  const [monday, setMonday] = useState(thisMonday);
  const days = useMemo(() => weekdaysFrom(monday).slice(0, 3), [monday]); // Senin, Selasa, Rabu
  const todayYmd = ymd(new Date());

  const [entries, setEntries] = useState<Record<string, AbsenOlahragaEntry>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<string | null>(null);

  const atThisWeek = ymd(monday) >= ymd(thisMonday);
  const [muatUlang, setMuatUlang] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    readAbsenOlahragaRange(ymd(days[0]), ymd(days[2]), {})
      .then((m) => {
        if (cancelled) return;
        setEntries(m);
        const t = days.find((d) => ymd(d) === todayYmd);
        setOpenDay(t ? todayYmd : null);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monday, muatUlang]);

  return (
    <>
      <RuleCard title="Peraturan absen olahraga" rules={ABSEN_OLAHRAGA_RULES} icon={<AbsenRuleIcon />} />

      <WeekNav
        label={labelRentangPekan(days)}
        sub={atThisWeek ? "Pekan ini" : undefined}
        onPrev={() => setMonday(shiftWeek(monday, -1))}
        onNext={atThisWeek ? undefined : () => setMonday(shiftWeek(monday, 1))}
      />

      {loading ? (
        <div className="mt-5">
          <PageLoadingSkeleton />
        </div>
      ) : error ? (
        <GagalMuat pesan={error} onUlang={() => setMuatUlang((n) => n + 1)} />
      ) : (
        <div className="mt-5 space-y-3">
          {days.map((d) => {
            const key = ymd(d);
            return (
              <AbsenOlahragaDayCard
                key={key}
                date={d}
                isToday={key === todayYmd}
                editable={key <= todayYmd}
                isPast={key < todayYmd}
                filled={isAbsenOlahragaFilled(entries[key])}
                entry={entries[key] ?? emptyAbsenOlahraga(key)}
                open={openDay === key}
                onToggle={() => setOpenDay((o) => (o === key ? null : key))}
                onSaved={(saved) => setEntries((prev) => ({ ...prev, [key]: saved }))}
                kelompok={kelompok}
              />
            );
          })}
        </div>
      )}
    </>
  );
}

function AbsenOlahragaDayCard({
  date,
  isToday,
  editable,
  isPast,
  filled,
  entry,
  open,
  onToggle,
  onSaved,
  kelompok,
}: {
  date: Date;
  isToday: boolean;
  editable: boolean;
  isPast: boolean;
  filled: boolean;
  entry: AbsenOlahragaEntry;
  open: boolean;
  onToggle: () => void;
  onSaved: (e: AbsenOlahragaEntry) => void;
  kelompok: OlahragaKelompok;
}) {
  const [form, setForm] = useState<AbsenOlahragaEntry>(entry);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setForm({ tanggal: entry.tanggal, status: entry.status, keterangan: entry.keterangan });
    setMsg(null);
    setErr(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.tanggal, entry.status, entry.keterangan]);

  const draft = useDraft({
    formKey: open && editable ? `olahraga-absen:${kelompok}:${ymd(date)}` : null,
    value: form,
    baseline: { tanggal: entry.tanggal, status: entry.status, keterangan: entry.keterangan } as AbsenOlahragaEntry,
    setValue: setForm,
  });

  // Belum pernah disimpan => tetap "dirty" walau status masih default "Hadir" (gak ada field jam
  // yang bisa dipakai buat mancing perubahan nilai kayak absen guru biasa — cuma status doang).
  const dirty = !filled || form.status !== entry.status || form.keterangan !== entry.keterangan;
  const set = <K extends keyof AbsenOlahragaEntry>(k: K, v: AbsenOlahragaEntry[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  async function handleSave() {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      await saveAbsenOlahraga({ kelompok, tanggal: ymd(date), status: form.status, keterangan: form.keterangan });
      const saved: AbsenOlahragaEntry = {
        tanggal: ymd(date),
        status: form.status,
        keterangan: form.status === "hadir" ? "" : form.keterangan,
        updated_at: new Date().toISOString(),
      };
      onSaved(saved);
      setForm(saved);
      draft.clear();
      toast.sukses("Tersimpan");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "#FFF", border: `1px solid ${isToday && !open ? C.green : C.line}` }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors"
        style={{ background: open ? C.leaf : "#FFF" }}
      >
        <span
          className="w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 leading-none"
          style={{ background: filled ? C.green : C.leaf, color: filled ? "#FFF" : C.green }}
        >
          <span className="text-[9px] font-semibold uppercase">{labelHari(date).slice(0, 3)}</span>
          <span className="text-sm font-bold">{date.getDate()}</span>
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold" style={{ color: C.ink }}>
            {labelHari(date)}
            {isToday && (
              <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full align-middle" style={{ background: C.leaf, color: C.green }}>
                HARI INI
              </span>
            )}
          </span>
          <span className="block text-xs truncate" style={{ color: C.muted }}>
            {!editable
              ? "Belum waktunya diisi"
              : filled
              ? STATUS_LABEL[entry.status]
              : isPast
              ? "Terlewat — belum diisi"
              : "Belum absen"}
          </span>
        </span>
        {filled && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0" style={{ color: C.green }}>
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          className="shrink-0 transition-transform"
          style={{ color: C.muted, transform: open ? "rotate(180deg)" : "none" }}
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="px-3.5 pb-4 pt-1" style={{ borderTop: `1px solid ${C.line}` }}>
          <p className="text-xs mt-2 mb-3" style={{ color: C.muted }}>{labelTanggal(date)}</p>


          {!editable ? (
            <p className="text-sm" style={{ color: C.muted }}>
              Tanggal ini belum tiba. Absen bisa diisi paling awal pada hari-H.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {(["hadir", "izin", "sakit", "cuti"] as AbsenStatus[]).map((s) => {
                  const on = form.status === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => set("status", s)}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                      style={{
                        background: on ? C.green : "#FFF",
                        color: on ? "#FFF" : C.ink,
                        border: `1px solid ${on ? C.green : C.line}`,
                      }}
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  );
                })}
              </div>

              {form.status !== "hadir" && (
                <label className="block mt-3">
                  <span className="block text-xs font-semibold mb-1" style={{ color: C.green }}>
                    Keterangan {STATUS_LABEL[form.status].toLowerCase()}
                  </span>
                  <textarea
                    value={form.keterangan}
                    onChange={(e) => set("keterangan", e.target.value)}
                    rows={2}
                    placeholder="Contoh: ada keperluan keluarga."
                    className="w-full text-sm outline-none px-3 py-2 rounded-lg resize-y"
                    style={{ border: `1px solid ${C.line}` }}
                  />
                </label>
              )}

              {err && <p className="mt-3 text-xs" style={{ color: "#8A2A20" }}>{err}</p>}
              {msg && <p className="mt-3 text-xs font-medium" style={{ color: C.green }}>{msg}</p>}

              <button
                onClick={handleSave}
                disabled={saving || !dirty}
                className="mt-3 w-full py-2.5 rounded-xl text-sm font-bold transition-opacity"
                style={{ background: C.green, color: "#FFF", opacity: saving || !dirty ? 0.5 : 1 }}
              >
                {saving ? "Menyimpan…" : filled ? "Simpan perubahan" : "Simpan"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ Management ═══════════════════════ */

/** Home-nya management buat Olahraga — 3 kartu terpisah (Rencana/Evaluasi/Absen), diakses
 *  dari route bare `/olahraga`. Ganti mode sekarang lewat sini, bukan tab di dalam halaman. */
export function OlahragaModePicker() {
  return (
    <div className="min-h-dvh" style={{ background: C.mist, color: C.ink }}>
      <div className="max-w-2xl mx-auto px-4 pt-6 sm:pt-9 pb-32 sm:pb-40">
        <header className="text-center">
          <h1
            className="text-xl sm:text-2xl font-semibold"
            style={{ color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Rekap Olahraga
          </h1>
          <p className="text-sm mt-1" style={{ color: C.muted }}>Kuttab Awwal 1–3 · Ikhwan & Akhwat</p>
        </header>

        <main className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AccentCard
            title="Rencana Kegiatan"
            desc="Rencana bulanan tiap kelas"
            icon={<RencanaIcon />}
            gradient={GRADIENTS[0]}
            to="/olahraga/rencana"
          />
          <AccentCard
            title="Evaluasi"
            desc="Evaluasi tiap anak per bulan"
            icon={<EvaluasiIcon />}
            gradient={GRADIENTS[1]}
            to="/olahraga/evaluasi"
          />
          <AccentCard
            title="Absen"
            desc="Kehadiran guru olahraga"
            icon={<AbsenIcon />}
            gradient={GRADIENTS[2]}
            to="/olahraga/absen"
          />
          <AccentCard
            title="Jurnal"
            desc="Jurnal harian guru olahraga"
            icon={<JurnalIcon />}
            gradient="linear-gradient(135deg, #2F8F83 0%, #1C5A52 100%)"
            to="/olahraga/jurnal"
          />
        </main>
      </div>
    </div>
  );
}

function ManagementOlahraga({ mode }: { mode: Mode }) {
  if (mode === "rencana") return <ManagementRencana />;
  if (mode === "evaluasi") return <ManagementEvaluasi />;
  if (mode === "jurnal") return <ManagementJurnalOlahraga />;
  return <ManagementAbsenWrapper />;
}

/** Bungkus header dipakai bareng halaman management Olahraga. Tombol kembali selalu di tempat yang sama
 *  (kiri, sebaris judul): tanpa `onBack` kembali ke Rekap Olahraga, dengan `onBack` mundur satu langkah.
 *  `sub` = pilihan yang sudah dibuat (mis. "Ikhwan · Oktober · Kuttab Awwal 1"). */
function ManagementShell({
  title,
  sub,
  onBack,
  children,
}: {
  title: string;
  sub?: string;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh" style={{ background: C.mist, color: C.ink }}>
      <div className="max-w-2xl mx-auto px-4 pt-6 sm:pt-9 pb-32 sm:pb-40">
        <header className="relative flex flex-col items-center justify-center text-center px-12 min-h-[44px]">
          {onBack ? (
            <BackButton onClick={onBack} label="Kembali" className="absolute left-0 inset-y-0 my-auto" />
          ) : (
            <BackButton to="/olahraga" label="Rekap Olahraga" className="absolute left-0 inset-y-0 my-auto" />
          )}
          <div className="min-w-0">
            <h1
              className="text-xl sm:text-2xl font-semibold"
              style={{ color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              {title}
            </h1>
            {sub && <p className="text-sm mt-1" style={{ color: C.muted }}>{sub}</p>}
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

function KelompokPicker({ onChange }: { onChange: (k: OlahragaKelompok) => void }) {
  return (
    <div className="mt-6">
      <span className="block text-xs font-bold uppercase tracking-wider mb-2.5 px-1" style={{ color: C.green }}>
        Pilih Kelompok
      </span>
      <div className="grid grid-cols-2 gap-4">
        <AccentCard title={KELOMPOK_LABEL.ikhwan} icon={<KelompokIcon />} gradient={GRADIENTS[0]} onClick={() => onChange("ikhwan")} />
        <AccentCard title={KELOMPOK_LABEL.akhwat} icon={<KelompokIcon />} gradient={GRADIENTS[1]} onClick={() => onChange("akhwat")} />
      </div>
    </div>
  );
}

function TingkatPicker({ value, onChange }: { value: number | null; onChange: (i: number | null) => void }) {
  return (
    <div className="mt-6">
      <PickerCard
        items={TINGKAT_LIST.map((t) => ({ label: `Kuttab Awwal ${t.replace("KA ", "")}` }))}
        value={value}
        onChange={onChange}
        placeholderLabel="Pilih kelas"
        selectedLabel="Kelas"
        countText={`${TINGKAT_LIST.length} kelas`}
        numbered={false}
      />
    </div>
  );
}

/* ───────── Rekap Rencana (management): Kelompok -> Bulan -> Kelas -> isi ───────── */

function ManagementRencana() {
  const [kelompok, setKelompok] = useState<OlahragaKelompok | null>(null);
  const [bulan, setBulan] = useState<string | null>(null);
  const [tingkatI, setTingkatI] = useState<number | null>(null);
  const [entries, setEntries] = useState<Record<string, OlahragaEntry>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tingkat = tingkatI != null ? TINGKAT_LIST[tingkatI] : null;

  useEffect(() => {
    if (!kelompok || !bulan) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    readOlahragaBulan(bulan, { kelompok })
      .then((m) => !cancelled && setEntries(m))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [bulan, kelompok]);

  const sub = [kelompok && KELOMPOK_LABEL[kelompok], bulan, tingkat && `Kuttab Awwal ${tingkat.replace("KA ", "")}`]
    .filter(Boolean)
    .join(" · ");
  const onBack = !kelompok ? undefined : !bulan ? () => setKelompok(null) : !tingkat ? () => setBulan(null) : () => setTingkatI(null);

  return (
    <ManagementShell title="Rencana Kegiatan Olahraga" sub={sub || undefined} onBack={onBack}>
      {!kelompok ? (
        <KelompokPicker onChange={setKelompok} />
      ) : !bulan ? (
        <div className="mt-6">
          <span className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: C.green }}>Bulan</span>
          <MonthGrid months={BULAN_OLAHRAGA} value={bulan} onSelect={setBulan} isOpen={isMonthOpen} />
        </div>
      ) : !tingkat ? (
        <TingkatPicker value={tingkatI} onChange={setTingkatI} />
      ) : (
        <>
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
            <div className="mt-6">
              <ReadOnlyTingkat tingkat={tingkat} entry={entries[tingkat]} />
            </div>
          )}
        </>
      )}
    </ManagementShell>
  );
}

/* ───────── Rekap Evaluasi (management): Kelompok -> Bulan -> Kelas -> Anak -> isi ───────── */

function ManagementEvaluasi() {
  const [kelompok, setKelompok] = useState<OlahragaKelompok | null>(null);
  const [bulan, setBulan] = useState<string | null>(null);
  const [tingkatI, setTingkatI] = useState<number | null>(null);
  const [anakI, setAnakI] = useState<number | null>(null);
  const [data, setData] = useState<Record<string, EvalAnakEntry>>({});
  const [aspek, setAspek] = useState<string[]>([]);
  const [rubrik, setRubrik] = useState<Record<string, Rubrik>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tingkat = tingkatI != null ? TINGKAT_LIST[tingkatI] : null;
  // Dipisah per kelompok: santri ikhwan hanya tampil di Ikhwan, santri akhwat hanya di Akhwat.
  const roster = useMemo(() => (tingkat && kelompok ? olahragaRoster(tingkat, kelompok) : []), [tingkat, kelompok]);
  const anakNama = anakI != null ? roster[anakI] : null;
  const entry = anakNama ? data[anakNama] : undefined;

  useEffect(() => {
    setAnakI(null);
    if (!tingkat || !bulan || !kelompok) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([readEvaluasiAnak(tingkat, bulan, { kelompok }), readOlahragaBulan(bulan, { kelompok }), bacaRubrik()])
      .then(([d, ren, rb]) => {
        if (cancelled) return;
        setData(d);
        setAspek(aspekDariRencana(ren[tingkat]));
        setRubrik(rb);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [tingkat, bulan, kelompok]);

  const sub = [kelompok && KELOMPOK_LABEL[kelompok], bulan, tingkat && `Kuttab Awwal ${tingkat.replace("KA ", "")}`, anakNama]
    .filter(Boolean)
    .join(" · ");
  const onBack = !kelompok
    ? undefined
    : !bulan
      ? () => setKelompok(null)
      : !tingkat
        ? () => setBulan(null)
        : anakNama == null
          ? () => setTingkatI(null)
          : () => setAnakI(null);

  return (
    <ManagementShell title="Evaluasi Kegiatan Olahraga" sub={sub || undefined} onBack={onBack}>
      {!kelompok ? (
        <KelompokPicker onChange={setKelompok} />
      ) : !bulan ? (
        <div className="mt-6">
          <span className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: C.green }}>Bulan</span>
          <MonthGrid months={BULAN_OLAHRAGA} value={bulan} onSelect={setBulan} isOpen={isMonthOpen} />
        </div>
      ) : !tingkat ? (
        <TingkatPicker value={tingkatI} onChange={setTingkatI} />
      ) : anakNama == null ? (
        <>
          {error && (
            <div className="mt-4 rounded-xl px-3.5 py-2.5 text-xs" style={{ background: "#FDEBEA", border: "1px solid #E8A6A0", color: "#8A2A20" }}>
              {error}
            </div>
          )}
          {loading ? (
            <div className="mt-5">
              <PageLoadingSkeleton />
            </div>
          ) : roster.length === 0 ? (
            <p className="mt-5 text-sm text-center" style={{ color: C.muted }}>Belum ada santri {KELOMPOK_LABEL[kelompok].toLowerCase()} di kelas ini.</p>
          ) : (
            <div className="mt-6 space-y-3">
              <SebaranNilai aspek={aspek} data={data} roster={roster} />
              <RubrikDaftar aspek={aspek} rubrik={rubrik} />
              <PickerCard
                items={roster.map((nama) => ({
                  label: nama,
                  sub: isEvalAnakFilled(data[nama]) ? "Sudah diisi" : "Belum diisi",
                }))}
                value={anakI}
                onChange={setAnakI}
                placeholderLabel="Pilih santri"
                selectedLabel="Santri"
                countText={`${roster.length} santri`}
              />
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mt-6 rounded-2xl p-4" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
            {!isEvalAnakFilled(entry) ? (
              <p className="text-sm" style={{ color: C.muted }}>Belum diisi.</p>
            ) : (
              <div className="space-y-3">
                {aspek.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold" style={{ color: C.green }}>Nilai kemampuan</div>
                    <div className="mt-2 space-y-2.5">
                      {aspek.map((a) => (
                        <NilaiAspek key={a} aspek={a} nilai={entry!.nilai?.[a]} rubrik={rubrik[kunciAspek(a)]} />
                      ))}
                    </div>
                  </div>
                )}
                {EVAL_FIELDS.map((f) => (
                  <ReadRow key={f.key} label={f.label} value={entry![f.key]} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </ManagementShell>
  );
}

/* ───────── Jurnal olahraga (management): Kelompok -> preview per pekan (tanpa tombol unduh) ───────── */

function ManagementJurnalOlahraga() {
  const [kelompok, setKelompok] = useState<OlahragaKelompok | null>(null);
  const thisMonday = useMemo(() => mondayOf(new Date()), []);
  const [monday, setMonday] = useState(thisMonday);
  // Guru olahraga hanya bertugas Senin–Rabu (sama seperti absennya).
  const days = useMemo(() => weekdaysFrom(monday).slice(0, 3), [monday]);
  const atThisWeek = ymd(monday) >= ymd(thisMonday);

  const [entries, setEntries] = useState<Record<string, JurnalEntry>>({});
  const [nama, setNama] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!kelompok) return;
    let cancelled = false;
    setNama(null);
    supabase
      .from("profiles")
      .select("full_name")
      .eq("role", "olahraga")
      .eq("kelompok", kelompok)
      .limit(1)
      .then(({ data }) => {
        if (!cancelled) setNama((data?.[0]?.full_name as string | undefined) || null);
      });
    return () => {
      cancelled = true;
    };
  }, [kelompok]);

  useEffect(() => {
    if (!kelompok) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    readJurnalRange(ymd(days[0]), ymd(days[days.length - 1]), { kelas: kelasJurnalOlahraga(kelompok) })
      .then((m) => !cancelled && setEntries(m))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Gagal memuat jurnal."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [kelompok, monday]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ManagementShell
      title="Jurnal Olahraga"
      sub={kelompok ? KELOMPOK_LABEL[kelompok] : undefined}
      onBack={kelompok ? () => setKelompok(null) : undefined}
    >
      {!kelompok ? (
        <KelompokPicker onChange={setKelompok} />
      ) : (
        <>
          <WeekNav
            label={labelRentangPekan(days)}
            sub={atThisWeek ? "Pekan ini" : undefined}
            onPrev={() => setMonday(shiftWeek(monday, -1))}
            onNext={atThisWeek ? undefined : () => setMonday(shiftWeek(monday, 1))}
          />
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
            <JurnalGabungan
              guru={nama ?? `Guru Olahraga ${KELOMPOK_LABEL[kelompok]}`}
              kelas={kelasJurnalOlahraga(kelompok)}
              rentang={labelRentangPekan(days)}
              days={days}
              entries={entries}
            />
          )}
        </>
      )}
    </ManagementShell>
  );
}

/* ───────── Rekap Absen (management): Kelompok -> isi (seperti biasa) ───────── */

function ManagementAbsenWrapper() {
  return (
    <ManagementShell title="Absen Olahraga">
      <ManagementAbsenTab />
    </ManagementShell>
  );
}

function ReadOnlyTingkat({
  tingkat,
  entry,
}: {
  tingkat: OlahragaTingkat;
  entry: OlahragaEntry | undefined;
}) {
  const filled = isRencanaFilled(entry);

  return (
    <div className="rounded-2xl p-3.5" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
      <div className="flex items-center gap-3">
        <span
          className="w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 leading-none"
          style={{ background: filled ? C.green : C.leaf, color: filled ? "#FFF" : C.green }}
        >
          <span className="text-[9px] font-semibold uppercase">KA</span>
          <span className="text-sm font-bold">{tingkat.replace("KA ", "")}</span>
        </span>
        <div className="text-sm font-semibold" style={{ color: C.ink }}>
          Kuttab Awwal {tingkat.replace("KA ", "")}
        </div>
      </div>

      {!filled ? (
        <p className="mt-2 text-xs" style={{ color: C.muted }}>Rencana belum diisi.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {PEKAN_FIELDS.map((f) => (
            <div key={f.key} className="rounded-xl p-3" style={{ background: C.mist, border: `1px solid ${C.line}` }}>
              <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: C.green }}>{f.label}</div>
              <div className="space-y-2.5">
                <ReadRow label="Kegiatan" value={entry![f.key]} />
                <TargetChips label="Target olahraga" value={entry![f.targetKey]} />
                {(adaAlatPekan(entry) || !entry!.alat.trim()) && <ReadRow label="Alat yang digunakan" value={entry![f.alatKey]} />}
              </div>
            </div>
          ))}
          {!adaTargetPekan(entry) && entry!.target.length > 0 && (
            <TargetChips label="Target (gabungan sebulan, format lama)" value={entry!.target} />
          )}
          {!adaAlatPekan(entry) && entry!.alat.trim() && <ReadRow label="Alat (sebulan, format lama)" value={entry!.alat} />}
        </div>
      )}
    </div>
  );
}

const CONTOH_RUBRIK: Record<NilaiOlahraga, string> = {
  A: "Contoh: sudah mampu dengan benar dan mandiri",
  B: "Contoh: mampu, sesekali perlu dibantu",
  C: "Contoh: baru sebagian, sering perlu dibantu",
  D: "Contoh: belum mampu",
};

/** Satu aspek: tombol A–D (tanpa onPilih = hanya tampil) + arti nilai yang dipilih. */
function NilaiAspek({ aspek, nilai, rubrik, onPilih }: { aspek: string; nilai?: NilaiOlahraga; rubrik?: Rubrik; onPilih?: (n: NilaiOlahraga) => void }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="flex-1 min-w-0 text-sm" style={{ color: C.ink }}>{aspek}</span>
        <div className="flex gap-1 shrink-0">
          {NILAI_OLAHRAGA.map((n) => {
            const on = nilai === n;
            return (
              <button
                key={n}
                type="button"
                onClick={onPilih ? () => onPilih(n) : undefined}
                disabled={!onPilih}
                aria-pressed={on}
                className="w-8 h-8 rounded-lg text-sm font-bold transition-colors"
                style={{ background: on ? C.green : "#FFF", color: on ? "#FFF" : onPilih ? C.ink : C.muted, border: `1px solid ${on ? C.green : C.line}` }}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>
      {nilai ? (
        <p className="mt-1 text-[11px] leading-relaxed" style={{ color: C.muted }}>
          {deskripsiNilai(rubrik, nilai) || "Arti nilai ini belum ditulis di Rencana."}
        </p>
      ) : !onPilih ? (
        <p className="mt-1 text-[11px]" style={{ color: C.muted }}>Belum dinilai.</p>
      ) : null}
    </div>
  );
}

/** Daftar aspek yang dinilai bulan ini + arti nilai A–D tiap aspek (bisa dibuka-tutup). */
function RubrikDaftar({ aspek, rubrik }: { aspek: string[]; rubrik: Record<string, Rubrik> }) {
  const [buka, setBuka] = useState(false);
  if (!aspek.length) return null;
  return (
    <div className="rounded-xl" style={{ background: C.mist, border: `1px solid ${C.line}` }}>
      <button type="button" onClick={() => setBuka((b) => !b)} className="w-full flex items-start justify-between gap-2 px-3 py-2.5 text-left">
        <span className="text-xs leading-relaxed" style={{ color: C.ink }}>
          <span className="font-semibold" style={{ color: C.green }}>Aspek dinilai:</span> {aspek.join(", ")}
        </span>
        <span className="text-[11px] font-bold shrink-0" style={{ color: C.green }}>{buka ? "Tutup" : "Arti A–D"}</span>
      </button>
      {buka && (
        <div className="px-3 pb-3 space-y-3">
          {aspek.map((a) => {
            const r = rubrik[kunciAspek(a)];
            return (
              <div key={a}>
                <div className="text-xs font-bold" style={{ color: C.ink }}>{a}</div>
                {NILAI_OLAHRAGA.map((n) => (
                  <div key={n} className="flex gap-2 mt-1 text-[11px] leading-relaxed" style={{ color: C.ink }}>
                    <span className="font-bold w-3 shrink-0" style={{ color: C.green }}>{n}</span>
                    <span>{deskripsiNilai(r, n) || "—"}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Management: berapa santri dapat A/B/C/D per aspek. */
function SebaranNilai({ aspek, data, roster }: { aspek: string[]; data: Record<string, EvalAnakEntry>; roster: string[] }) {
  if (!aspek.length) return null;
  return (
    <div className="rounded-2xl p-3.5" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
      <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: C.green }}>Sebaran nilai</div>
      <table className="w-full text-xs">
        <thead>
          <tr style={{ color: C.muted }}>
            <th className="text-left font-semibold py-1">Aspek</th>
            {NILAI_OLAHRAGA.map((n) => (
              <th key={n} className="w-8 font-semibold">{n}</th>
            ))}
            <th className="w-12 font-semibold">Belum</th>
          </tr>
        </thead>
        <tbody>
          {aspek.map((a) => {
            const hit = (n: NilaiOlahraga) => roster.filter((s) => data[s]?.nilai?.[a] === n).length;
            const sudah = NILAI_OLAHRAGA.reduce((x, n) => x + hit(n), 0);
            return (
              <tr key={a} style={{ borderTop: `1px solid ${C.line}` }}>
                <td className="py-1.5 pr-2" style={{ color: C.ink }}>{a}</td>
                {NILAI_OLAHRAGA.map((n) => (
                  <td key={n} className="text-center font-semibold" style={{ color: hit(n) ? C.green : C.muted }}>{hit(n) || "–"}</td>
                ))}
                <td className="text-center" style={{ color: C.muted }}>{roster.length - sudah}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TargetChips({ label, value }: { label: string; value: string[] }) {
  return (
    <div>
      <div className="text-[11px] font-semibold" style={{ color: C.green }}>{label}</div>
      {value.length ? (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {value.map((x) => (
            <span key={x} className="px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: C.leaf, color: C.green }}>
              {x}
            </span>
          ))}
        </div>
      ) : (
        <div className="text-sm" style={{ color: C.muted }}>—</div>
      )}
    </div>
  );
}

function ManagementAbsenTab() {
  const [tab, setTab] = useState<"santri" | "guru">("santri");
  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-1 p-1.5 rounded-full" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
        {(["santri", "guru"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setTab(m)}
            className="py-2 rounded-full text-sm font-semibold transition-colors"
            style={{ background: tab === m ? C.green : "transparent", color: tab === m ? "#FFF" : C.muted }}
          >
            {m === "santri" ? "Absen Santri" : "Absen Guru"}
          </button>
        ))}
      </div>
      {tab === "santri" ? <ManagementAbsenSantriOlahraga /> : <ManagementAbsenOlahraga />}
    </>
  );
}

/** Rekap absen SANTRI olahraga (management): per pekan, per hari, per kelompok dan tingkat -- hadir, tidak hadir + keterangan. */
function ManagementAbsenSantriOlahraga() {
  const thisMonday = useMemo(() => mondayOf(new Date()), []);
  const [monday, setMonday] = useState(thisMonday);
  const days = useMemo(() => weekdaysFrom(monday).slice(0, 3), [monday]);
  const atThisWeek = ymd(monday) >= ymd(thisMonday);
  const [baris, setBaris] = useState<BarisAbsenSantriOlahraga[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let batal = false;
    setLoading(true);
    setError(null);
    bacaAbsenSantriOlahragaRentang(ymd(days[0]), ymd(days[2]))
      .then((b) => !batal && setBaris(b))
      .catch((e) => !batal && setError(e.message))
      .finally(() => !batal && setLoading(false));
    return () => {
      batal = true;
    };
  }, [monday]); // eslint-disable-line react-hooks/exhaustive-deps

  const kelompokList: OlahragaKelompok[] = ["ikhwan", "akhwat"];
  // ringkasan pekan: per kelompok + tingkat -> hadir / total catatan
  const ringkas = kelompokList.flatMap((k) =>
    TINGKAT_LIST.map((t) => {
      const b = baris.filter((x) => x.kelompok === k && x.tingkat === t);
      return { k, t, hadir: b.filter((x) => x.status === "hadir").length, total: b.length };
    })
  ).filter((r) => r.total > 0);

  return (
    <>
      <WeekNav
        label={labelRentangPekan(days)}
        sub={atThisWeek ? "Pekan ini" : undefined}
        onPrev={() => setMonday(shiftWeek(monday, -1))}
        onNext={atThisWeek ? undefined : () => setMonday(shiftWeek(monday, 1))}
      />

      <UnduhKehadiranBulan
        judul="Unduh kehadiran per bulan"
        keterangan="PDF daftar kehadiran tiap santri di olahraga, diurutkan per kelompok dan tingkat, lengkap dengan keterangan tidak hadir."
        onUnduh={async (y, m0) => {
          const { unduhKehadiranBulanan } = await import("../lib/kehadiranSantriPdf");
          await unduhKehadiranBulanan(y, m0, "olahraga");
        }}
      />
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
        <div className="mt-5 space-y-3">
          <div className="rounded-2xl p-3.5" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
            <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: C.green }}>Kehadiran pekan ini</div>
            {ringkas.length === 0 ? (
              <p className="text-sm" style={{ color: C.muted }}>Belum ada absen santri pekan ini.</p>
            ) : (
              <div className="space-y-1.5">
                {ringkas.map((r) => {
                  const pct = Math.round((r.hadir / r.total) * 100);
                  return (
                    <div key={r.k + r.t} className="flex items-center gap-2 text-sm">
                      <span className="flex-1" style={{ color: C.ink }}>
                        {KELOMPOK_LABEL[r.k]} · KA {r.t.replace("KA ", "")}
                      </span>
                      <span style={{ color: C.muted }}>{r.hadir}/{r.total}</span>
                      <span className="w-12 text-right font-semibold" style={{ color: pct >= 90 ? C.green : pct >= 75 ? "#8A6A20" : "#9F240B" }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {days.map((d) => {
            const key = ymd(d);
            const hari = baris.filter((x) => x.tanggal === key);
            return (
              <div key={key} className="rounded-2xl p-3.5" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
                <div className="text-sm font-semibold mb-2" style={{ color: C.ink }}>{labelHari(d)} · {labelTanggal(d)}</div>
                {hari.length === 0 ? (
                  <p className="text-xs" style={{ color: C.muted }}>Belum diabsen.</p>
                ) : (
                  <div className="space-y-2">
                    {kelompokList.flatMap((k) =>
                      TINGKAT_LIST.map((t) => {
                        const b = hari.filter((x) => x.kelompok === k && x.tingkat === t);
                        if (!b.length) return null;
                        const tidak = b.filter((x) => x.status === "tidak_hadir");
                        return (
                          <div key={k + t} className="rounded-xl px-3 py-2" style={{ background: C.mist, border: `1px solid ${C.line}` }}>
                            <div className="flex items-center justify-between text-xs font-semibold" style={{ color: C.green }}>
                              <span>{KELOMPOK_LABEL[k]} · KA {t.replace("KA ", "")}</span>
                              <span>{b.length - tidak.length} dari {b.length} hadir</span>
                            </div>
                            {tidak.length > 0 && (
                              <ul className="mt-1.5 space-y-0.5">
                                {tidak.map((x) => (
                                  <li key={x.nama_santri} className="text-xs" style={{ color: C.ink }}>
                                    {x.nama_santri}
                                    <span style={{ color: C.muted }}>{x.keterangan ? ` — ${x.keterangan}` : " — tanpa keterangan"}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function ManagementAbsenOlahraga() {
  const thisMonday = useMemo(() => mondayOf(new Date()), []);
  const [monday, setMonday] = useState(thisMonday);
  const days = useMemo(() => weekdaysFrom(monday).slice(0, 3), [monday]);
  const atThisWeek = ymd(monday) >= ymd(thisMonday);

  const [entries, setEntries] = useState<Record<string, AbsenOlahragaPerKelompok>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    readAbsenOlahragaRangeGabungan(ymd(days[0]), ymd(days[2]))
      .then((m) => !cancelled && setEntries(m))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [monday]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <WeekNav
        label={labelRentangPekan(days)}
        sub={atThisWeek ? "Pekan ini" : undefined}
        onPrev={() => setMonday(shiftWeek(monday, -1))}
        onNext={atThisWeek ? undefined : () => setMonday(shiftWeek(monday, 1))}
      />

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
        <div className="mt-5 space-y-3">
          {days.map((d) => (
            <ReadOnlyAbsenOlahragaDay key={ymd(d)} date={d} entries={entries[ymd(d)]} />
          ))}
        </div>
      )}
    </>
  );
}

function ReadOnlyAbsenOlahragaDay({ date, entries }: { date: Date; entries: AbsenOlahragaPerKelompok | undefined }) {
  const kelompokList: OlahragaKelompok[] = ["ikhwan", "akhwat"];
  const anyFilled = kelompokList.some((k) => isAbsenOlahragaFilled(entries?.[k]));
  return (
    <div className="rounded-2xl p-3.5" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
      <div className="flex items-center gap-3">
        <span
          className="w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 leading-none"
          style={{ background: anyFilled ? C.green : C.leaf, color: anyFilled ? "#FFF" : C.green }}
        >
          <span className="text-[9px] font-semibold uppercase">{labelHari(date).slice(0, 3)}</span>
          <span className="text-sm font-bold">{date.getDate()}</span>
        </span>
        <div>
          <div className="text-sm font-semibold" style={{ color: C.ink }}>{labelHari(date)}</div>
          <div className="text-xs" style={{ color: C.muted }}>{labelTanggal(date)}</div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {kelompokList.map((k) => {
          const entry = entries?.[k];
          const filled = isAbsenOlahragaFilled(entry);
          return (
            <div key={k} className="flex items-start gap-2.5">
              <span className="text-xs font-semibold w-14 shrink-0 pt-0.5" style={{ color: C.green }}>{KELOMPOK_LABEL[k]}</span>
              {!filled ? (
                <span className="text-xs pt-0.5" style={{ color: C.muted }}>Belum absen.</span>
              ) : (
                <div className="min-w-0">
                  <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: C.leaf, color: C.green }}>
                    {STATUS_LABEL[(entry as AbsenOlahragaEntry).status]}
                  </span>
                  {(entry as AbsenOlahragaEntry).keterangan.trim() && (
                    <p className="mt-1 text-sm whitespace-pre-wrap" style={{ color: C.ink }}>
                      {(entry as AbsenOlahragaEntry).keterangan.trim()}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════ shared bits ═══════════════════════ */

/** Judul halaman guru olahraga: rata tengah seperti Daily Jurnal. */
function HeaderCard({ title, name, sub }: { title: string; name: string; sub: string }) {
  return (
    <header className="text-center">
      <h1 className="text-xl sm:text-2xl font-semibold" style={{ color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}>
        {title}
      </h1>
      <p className="text-sm mt-1" style={{ color: C.muted }}>
        {name} · {sub}
      </p>
    </header>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold mb-1" style={{ color: C.green }}>{label}</span>
      {children}
    </label>
  );
}

function ReadRow({ label, value }: { label: string; value: string }) {
  const v = (value ?? "").trim();
  return (
    <div>
      <div className="text-[11px] font-semibold" style={{ color: C.green }}>{label}</div>
      <div className="text-sm whitespace-pre-wrap" style={{ color: v ? C.ink : C.muted }}>{v || "—"}</div>
    </div>
  );
}

function AbsenRuleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BackArrowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function KelompokIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3" stroke="#FFF" strokeWidth="1.7" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="#FFF" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="17" cy="8.5" r="2.3" stroke="#FFF" strokeWidth="1.5" />
      <path d="M15.5 13.3c2.3.4 4 2.1 4 4.7" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function RencanaIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M6 3.5h9l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" stroke="#FFF" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8.5 11.5h7M8.5 15h5" stroke="#FFF" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function EvaluasiIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M4 20V10M11 20V4M18 20v-7" stroke="#FFF" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M3 20h18" stroke="#FFF" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function JurnalIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="4.5" y="3.5" width="15" height="17" rx="2" stroke="#FFF" strokeWidth="1.7" />
      <path d="M8 3.5v17" stroke="#FFF" strokeWidth="1.7" />
      <path d="M11.5 9h5M11.5 12.5h5M11.5 16h3.5" stroke="#FFF" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function AbsenIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="#FFF" strokeWidth="1.7" />
      <path d="M3.5 9.5h17" stroke="#FFF" strokeWidth="1.7" />
      <path d="M8 3v3.5M16 3v3.5" stroke="#FFF" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8.5 14.5l2 2 4.5-4.5" stroke="#FFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WeekNav({
  label,
  sub,
  onPrev,
  onNext,
}: {
  label: string;
  sub?: string;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  return (
    <div className="mt-5 flex items-center gap-2">
      <ArrowBtn dir="prev" disabled={!onPrev} onClick={onPrev} />
      <div
        className="flex-1 text-center rounded-xl px-3 py-2"
        style={{ background: "#FFF", border: `1px solid ${C.line}` }}
      >
        <div className="text-sm font-semibold" style={{ color: C.ink }}>{label}</div>
        {sub && <div className="text-[11px]" style={{ color: C.green }}>{sub}</div>}
      </div>
      <ArrowBtn dir="next" disabled={!onNext} onClick={onNext} />
    </div>
  );
}

function ArrowBtn({ dir, disabled, onClick }: { dir: "prev" | "next"; disabled?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "prev" ? "Pekan sebelumnya" : "Pekan berikutnya"}
      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
      style={{
        background: "#FFF",
        border: `1px solid ${C.line}`,
        color: C.green,
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ transform: dir === "next" ? "rotate(180deg)" : "none" }}>
        <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function shiftWeek(monday: Date, weeks: number): Date {
  const x = new Date(monday);
  x.setDate(x.getDate() + weeks * 7);
  return x;
}

/* ───────── Absen olahraga: tab Guru / Santri ───────── */

function AbsenOlahragaTab({ kelompok }: { kelompok: OlahragaKelompok }) {
  const [tab, setTab] = useState<"guru" | "santri">("santri");
  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-1 p-1.5 rounded-full" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
        {(["santri", "guru"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setTab(m)}
            className="py-2 rounded-full text-sm font-semibold transition-colors"
            style={{ background: tab === m ? C.green : "transparent", color: tab === m ? "#FFF" : C.muted }}
          >
            {m === "santri" ? "Absen Santri" : "Absen Guru"}
          </button>
        ))}
      </div>
      {tab === "guru" ? <GuruAbsenOlahraga kelompok={kelompok} /> : <GuruAbsenSantriOlahraga kelompok={kelompok} />}
    </>
  );
}

const ATURAN_ABSEN_SANTRI = [
  "Tandai kehadiran santri tiap pertemuan olahraga (Senin, Selasa, Rabu), per tingkat KA 1–3.",
  "Semua santri awalnya Hadir; ketuk Tidak Hadir untuk yang absen dan tulis keterangannya.",
  "Hari yang terlewat masih bisa dikoreksi; tanggal yang belum tiba belum bisa diisi.",
];

function GuruAbsenSantriOlahraga({ kelompok }: { kelompok: OlahragaKelompok }) {
  const { session } = useAuth();
  const uid = session?.user?.id;
  const thisMonday = useMemo(() => mondayOf(new Date()), []);
  const [monday, setMonday] = useState(thisMonday);
  const days = useMemo(() => weekdaysFrom(monday).slice(0, 3), [monday]);
  const todayYmd = ymd(new Date());
  const atThisWeek = ymd(monday) >= ymd(thisMonday);
  const [data, setData] = useState<Record<string, AbsenHariOlahraga>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [muatUlang, setMuatUlang] = useState(0);

  useEffect(() => {
    if (!uid) return;
    let batal = false;
    setLoading(true);
    setError(null);
    Promise.all(days.map((d) => bacaAbsenSantriOlahraga(ymd(d), { userId: uid }).then((a) => [ymd(d), a] as const)))
      .then((pairs) => {
        if (batal) return;
        setData(Object.fromEntries(pairs));
        const t = days.find((d) => ymd(d) === todayYmd);
        setOpenDay(t ? todayYmd : null);
      })
      .catch((e) => !batal && setError(e.message))
      .finally(() => !batal && setLoading(false));
    return () => {
      batal = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monday, muatUlang, uid]);

  return (
    <>
      <RuleCard title="Peraturan absen santri olahraga" rules={ATURAN_ABSEN_SANTRI} icon={<AbsenRuleIcon />} />
      <WeekNav
        label={labelRentangPekan(days)}
        sub={atThisWeek ? "Pekan ini" : undefined}
        onPrev={() => setMonday(shiftWeek(monday, -1))}
        onNext={atThisWeek ? undefined : () => setMonday(shiftWeek(monday, 1))}
      />
      {loading ? (
        <div className="mt-5">
          <PageLoadingSkeleton />
        </div>
      ) : error ? (
        <GagalMuat pesan={error} onUlang={() => setMuatUlang((n) => n + 1)} />
      ) : (
        <div className="mt-5 space-y-3">
          {days.map((d) => {
            const key = ymd(d);
            return (
              <HariAbsenSantriOlahraga
                key={key}
                date={d}
                kelompok={kelompok}
                isToday={key === todayYmd}
                editable={key <= todayYmd}
                tersimpan={data[key]}
                open={openDay === key}
                onToggle={() => setOpenDay((o) => (o === key ? null : key))}
                onSaved={(a) => setData((p) => ({ ...p, [key]: a }))}
              />
            );
          })}
        </div>
      )}
    </>
  );
}

function HariAbsenSantriOlahraga({
  date,
  kelompok,
  isToday,
  editable,
  tersimpan,
  open,
  onToggle,
  onSaved,
}: {
  date: Date;
  kelompok: OlahragaKelompok;
  isToday: boolean;
  editable: boolean;
  tersimpan: AbsenHariOlahraga | undefined;
  open: boolean;
  onToggle: () => void;
  onSaved: (a: AbsenHariOlahraga) => void;
}) {
  const tanggal = ymd(date);
  const roster = useMemo(() => Object.fromEntries(TINGKAT_LIST.map((t) => [t, olahragaRoster(t, kelompok)])) as Record<OlahragaTingkat, string[]>, [kelompok]);
  const dasar = (): Record<OlahragaTingkat, Record<string, EntriSantriOlahraga>> =>
    Object.fromEntries(TINGKAT_LIST.map((t) => [t, Object.fromEntries(roster[t].map((n) => [n, tersimpan?.[t]?.[n] ?? entriBaru()]))])) as never;
  const [form, setForm] = useState(dasar);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setForm(dasar());
    setErr(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tersimpan, tanggal, kelompok]);

  const totalSantri = TINGKAT_LIST.reduce((a, t) => a + roster[t].length, 0);
  const sudahTingkat = TINGKAT_LIST.filter((t) => sudahDiabsen(tersimpan, t)).length;
  const lengkap = sudahTingkat === TINGKAT_LIST.filter((t) => roster[t].length > 0).length && sudahTingkat > 0;
  const dirty = JSON.stringify(form) !== JSON.stringify(dasar());

  const ubah = (t: OlahragaTingkat, nama: string, patch: Partial<EntriSantriOlahraga>) =>
    setForm((p) => ({ ...p, [t]: { ...p[t], [nama]: { ...p[t][nama], ...patch } } }));

  async function simpan() {
    setSaving(true);
    setErr(null);
    try {
      await simpanAbsenSantriOlahraga(kelompok, tanggal, form);
      onSaved(JSON.parse(JSON.stringify(form)));
      toast.sukses("Tersimpan");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#FFF", border: `1px solid ${isToday ? C.green : C.line}` }}>
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-3 px-3.5 py-3 text-left" style={{ background: open ? C.leaf : "#FFF" }}>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold" style={{ color: C.ink }}>
            {labelHari(date)} · {labelTanggal(date)}
            {isToday && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: C.green, color: "#FFF" }}>HARI INI</span>}
          </span>
          <span className="block text-xs" style={{ color: C.muted }}>
            {!editable ? "Belum bisa diisi" : lengkap ? "Semua tingkat sudah diabsen" : sudahTingkat > 0 ? `${sudahTingkat} tingkat sudah diabsen` : "Belum diabsen"}
          </span>
        </span>
        <span className="text-xs shrink-0" style={{ color: C.muted }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && editable && (
        <div className="px-3.5 pb-4 pt-3 space-y-4" style={{ borderTop: `1px solid ${C.line}` }}>
          {totalSantri === 0 && <p className="text-sm" style={{ color: C.muted }}>Belum ada daftar santri untuk kelompok ini.</p>}
          {TINGKAT_LIST.filter((t) => roster[t].length > 0).map((t) => (
            <div key={t}>
              <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: C.green }}>
                Kuttab Awwal {t.replace("KA ", "")} · {roster[t].length} santri
              </div>
              <div className="space-y-1.5">
                {roster[t].map((nama) => {
                  const e = form[t]?.[nama] ?? entriBaru();
                  return (
                    <div key={nama} className="rounded-xl px-3 py-2" style={{ background: e.status === "hadir" ? C.mist : "#FFF1EE", border: `1px solid ${C.line}` }}>
                      <div className="flex items-center gap-2">
                        <span className="flex-1 min-w-0 text-sm truncate" style={{ color: C.ink }}>{nama}</span>
                        {(["hadir", "tidak_hadir"] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => ubah(t, nama, { status: s })}
                            aria-pressed={e.status === s}
                            className="px-2.5 py-1 rounded-full text-[11px] font-bold"
                            style={{
                              background: e.status === s ? (s === "hadir" ? C.green : "#C0392B") : "#FFF",
                              color: e.status === s ? "#FFF" : C.muted,
                              border: `1px solid ${e.status === s ? "transparent" : C.line}`,
                            }}
                          >
                            {s === "hadir" ? "Hadir" : "Tidak"}
                          </button>
                        ))}
                      </div>
                      {e.status === "tidak_hadir" && (
                        <input
                          value={e.keterangan}
                          onChange={(ev) => ubah(t, nama, { keterangan: ev.target.value })}
                          placeholder="Keterangan (sakit, izin, …)"
                          aria-label={`Keterangan ${nama}`}
                          className="mt-1.5 w-full text-xs outline-none px-2.5 py-1.5 rounded-md"
                          style={{ background: "#FFF", border: `1px solid ${C.line}` }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {err && <p className="text-xs" style={{ color: "#8A2A20" }}>{err}</p>}
          {totalSantri > 0 && (
            <button
              onClick={simpan}
              disabled={saving || (!dirty && sudahTingkat > 0)}
              className="w-full py-2.5 rounded-xl text-sm font-bold transition-opacity"
              style={{ background: C.green, color: "#FFF", opacity: saving || (!dirty && sudahTingkat > 0) ? 0.5 : 1 }}
            >
              {saving ? "Menyimpan…" : sudahTingkat > 0 ? "Simpan perubahan" : "Simpan absen"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
