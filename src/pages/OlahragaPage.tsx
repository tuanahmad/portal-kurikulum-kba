import { useEffect, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { C, isMonthOpen, olahragaRoster } from "../data";
import { useAuth } from "../contexts/AuthContext";
import { PageLoadingSkeleton } from "../components/Skeleton";
import { RuleCard } from "../components/RuleCard";
import { MonthGrid } from "../components/MonthGrid";
import { PickerCard } from "../components/PickerCard";
import { AccentCard, BackButton } from "../components/PortalComponents";
import { WhistleIcon } from "../components/navIcons";
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
  readEvaluasiAnak,
  saveEvaluasiAnakBatch,
  emptyEvalAnak,
  isEvalAnakFilled,
  readAbsenOlahragaRange,
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
} from "../lib/olahraga";

type Mode = "rencana" | "evaluasi" | "absen";
const MODES: Mode[] = ["rencana", "evaluasi", "absen"];
const MODE_TITLE: Record<Mode, string> = {
  rencana: "Rencana Kegiatan Olahraga",
  evaluasi: "Evaluasi Kegiatan Olahraga",
  absen: "Absen Olahraga",
};

const GRADIENTS = [
  `linear-gradient(135deg, ${C.green} 0%, ${C.greenDeep} 100%)`,
  "linear-gradient(135deg, #C79A3B 0%, #8A6A20 100%)",
  `linear-gradient(135deg, ${C.green} 0%, ${C.gold} 100%)`,
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

  return role === "management" ? <ManagementOlahraga mode={mode} /> : <GuruOlahraga mode={mode} />;
}

/* ═══════════════════════ Guru olahraga ═══════════════════════ */

function GuruOlahraga({ mode }: { mode: Mode }) {
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
          <GuruAbsenOlahraga kelompok={kelompok} />
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
  }, [bulan]);

  return (
    <>
      <div className="mt-4">
        <span className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: C.green }}>Bulan</span>
        <MonthGrid months={BULAN_OLAHRAGA} value={bulan} onSelect={setBulan} isOpen={isMonthOpen} />
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

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    setMsg(null);
    readEvaluasiAnak(tingkat, bulan, {})
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setForm(d);
      })
      .catch((e) => !cancelled && setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tingkat, bulan]);

  const anyFilled = Object.values(data).some((e) => isEvalAnakFilled(e));
  const dirty = JSON.stringify(form) !== JSON.stringify(data);

  const setAnak = (nama: string, k: keyof EvalAnakEntry, v: string) =>
    setForm((p) => ({ ...p, [nama]: { ...(p[nama] ?? emptyEvalAnak()), [k]: v } }));

  async function handleSave() {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      await saveEvaluasiAnakBatch({ kelompok, tingkat, bulan, entries: form });
      setData(form);
      setMsg("Tersimpan.");
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
          ) : (
            <>
              <div className="space-y-2">
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
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const targetKey = entry.target.join("");
  useEffect(() => {
    setForm({
      tingkat: entry.tingkat,
      bulan: entry.bulan,
      pekan1: entry.pekan1,
      pekan2: entry.pekan2,
      pekan3: entry.pekan3,
      pekan4: entry.pekan4,
      target: [...entry.target],
      alat: entry.alat,
    });
    setMsg(null);
    setErr(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    entry.tingkat, entry.bulan, targetKey, entry.alat,
    entry.pekan1, entry.pekan2, entry.pekan3, entry.pekan4,
  ]);

  const rencanaOk = isRencanaFilled(entry);

  const dirty =
    form.alat !== entry.alat ||
    form.target.join("") !== targetKey ||
    PEKAN_FIELDS.some((f) => form[f.key] !== entry[f.key]);

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
        target: form.target,
        alat: form.alat,
      });
      const saved: OlahragaEntry = { ...form, tingkat, bulan };
      onSaved(saved);
      setForm(saved);
      setMsg("Tersimpan.");
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
          <div className="space-y-3">
            {PEKAN_FIELDS.map((f) => (
              <Field key={f.key} label={f.label}>
                <textarea
                  value={form[f.key] as string}
                  onChange={(e) => set(f.key, e.target.value as OlahragaEntry[typeof f.key])}
                  rows={2}
                  placeholder="Kegiatan olahraga pekan ini…"
                  className="w-full text-sm outline-none px-3 py-2 rounded-lg resize-y"
                  style={{ border: `1px solid ${C.line}` }}
                />
              </Field>
            ))}

            <Field label="Target olahraga">
              <TargetPicker value={form.target} onChange={(v) => set("target", v)} />
            </Field>

            <Field label="Alat yang digunakan">
              <textarea
                value={form.alat}
                onChange={(e) => set("alat", e.target.value)}
                rows={2}
                placeholder="Bola, cone, tali, matras…"
                className="w-full text-sm outline-none px-3 py-2 rounded-lg resize-y"
                style={{ border: `1px solid ${C.line}` }}
              />
            </Field>
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
    const t = custom.trim();
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
  "Cuma bisa diisi pada hari itu juga — begitu lewat, dianggap sudah disetor ke manajemen dan gak bisa diubah lagi.",
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
  }, [monday]);

  return (
    <>
      <RuleCard title="Peraturan absen olahraga" rules={ABSEN_OLAHRAGA_RULES} icon={<AbsenRuleIcon />} />

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
          {days.map((d) => {
            const key = ymd(d);
            return (
              <AbsenOlahragaDayCard
                key={key}
                date={d}
                isToday={key === todayYmd}
                editable={key === todayYmd}
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
      setMsg("Tersimpan.");
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
              ? isPast
                ? filled ? STATUS_LABEL[entry.status] : "Terlewat — tidak diisi"
                : "Belum waktunya diisi"
              : filled ? STATUS_LABEL[entry.status] : "Belum absen"}
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
              {isPast
                ? "Tanggal ini sudah lewat — dianggap sudah disetor ke manajemen, gak bisa diedit lagi."
                : "Tanggal ini belum tiba. Absen bisa diisi paling awal pada hari-H."}
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
        <header>
          <h1
            className="text-xl sm:text-2xl font-semibold"
            style={{ color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Rekap Olahraga
          </h1>
          <p className="text-sm mt-1" style={{ color: C.muted }}>Kuttab Awwal 1–3 · Ikhwan & Akhwat</p>
        </header>

        <main className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
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
        </main>
      </div>
    </div>
  );
}

function ManagementOlahraga({ mode }: { mode: Mode }) {
  if (mode === "rencana") return <ManagementRencana />;
  if (mode === "evaluasi") return <ManagementEvaluasi />;
  return <ManagementAbsenWrapper />;
}

/** Bungkus header + tombol back dipakai bareng ke-3 halaman management di bawah. */
function ManagementShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh" style={{ background: C.mist, color: C.ink }}>
      <div className="max-w-2xl mx-auto px-4 pt-6 sm:pt-9 pb-32 sm:pb-40">
        <BackButton to="/olahraga" label="Rekap Olahraga" />
        <header className="mt-4">
          <h1
            className="text-xl sm:text-2xl font-semibold"
            style={{ color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            {title}
          </h1>
        </header>
        {children}
      </div>
    </div>
  );
}

function StepBackPill({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-full transition-colors hover:opacity-80"
      style={{ background: C.leaf, color: C.green, border: `1px solid ${C.green}` }}
    >
      <BackArrowIcon />
      {label}
    </button>
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
    <div className="mt-4">
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

  return (
    <ManagementShell title="Rencana Kegiatan Olahraga">
      {!kelompok ? (
        <KelompokPicker onChange={setKelompok} />
      ) : !bulan ? (
        <>
          <StepBackPill label={KELOMPOK_LABEL[kelompok]} onClick={() => setKelompok(null)} />
          <div className="mt-4">
            <span className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: C.green }}>Bulan</span>
            <MonthGrid months={BULAN_OLAHRAGA} value={bulan} onSelect={setBulan} isOpen={isMonthOpen} />
          </div>
        </>
      ) : !tingkat ? (
        <>
          <StepBackPill label={`${KELOMPOK_LABEL[kelompok]} · ${bulan}`} onClick={() => setBulan(null)} />
          <TingkatPicker value={tingkatI} onChange={setTingkatI} />
        </>
      ) : (
        <>
          <StepBackPill
            label={`${KELOMPOK_LABEL[kelompok]} · ${bulan} · Kuttab Awwal ${tingkat.replace("KA ", "")}`}
            onClick={() => setTingkatI(null)}
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
            <div className="mt-5">
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tingkat = tingkatI != null ? TINGKAT_LIST[tingkatI] : null;
  const roster = useMemo(() => (tingkat && kelompok ? olahragaRoster(tingkat, kelompok) : []), [tingkat, kelompok]);
  const anakNama = anakI != null ? roster[anakI] : null;
  const entry = anakNama ? data[anakNama] : undefined;

  useEffect(() => {
    setAnakI(null);
    if (!tingkat || !bulan || !kelompok) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    readEvaluasiAnak(tingkat, bulan, { kelompok })
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [tingkat, bulan, kelompok]);

  return (
    <ManagementShell title="Evaluasi Kegiatan Olahraga">
      {!kelompok ? (
        <KelompokPicker onChange={setKelompok} />
      ) : !bulan ? (
        <>
          <StepBackPill label={KELOMPOK_LABEL[kelompok]} onClick={() => setKelompok(null)} />
          <div className="mt-4">
            <span className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: C.green }}>Bulan</span>
            <MonthGrid months={BULAN_OLAHRAGA} value={bulan} onSelect={setBulan} isOpen={isMonthOpen} />
          </div>
        </>
      ) : !tingkat ? (
        <>
          <StepBackPill label={`${KELOMPOK_LABEL[kelompok]} · ${bulan}`} onClick={() => setBulan(null)} />
          <TingkatPicker value={tingkatI} onChange={setTingkatI} />
        </>
      ) : anakNama == null ? (
        <>
          <StepBackPill
            label={`${KELOMPOK_LABEL[kelompok]} · ${bulan} · Kuttab Awwal ${tingkat.replace("KA ", "")}`}
            onClick={() => setTingkatI(null)}
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
          ) : roster.length === 0 ? (
            <p className="mt-5 text-sm text-center" style={{ color: C.muted }}>Belum ada daftar santri buat kelas ini.</p>
          ) : (
            <div className="mt-4">
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
          <StepBackPill label={anakNama} onClick={() => setAnakI(null)} />
          <div className="mt-5 rounded-2xl p-4" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
            {!isEvalAnakFilled(entry) ? (
              <p className="text-sm" style={{ color: C.muted }}>Belum diisi.</p>
            ) : (
              <div className="space-y-3">
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

/* ───────── Rekap Absen (management): Kelompok -> isi (seperti biasa) ───────── */

function ManagementAbsenWrapper() {
  const [kelompok, setKelompok] = useState<OlahragaKelompok | null>(null);
  return (
    <ManagementShell title="Absen Olahraga">
      {!kelompok ? (
        <KelompokPicker onChange={setKelompok} />
      ) : (
        <>
          <StepBackPill label={KELOMPOK_LABEL[kelompok]} onClick={() => setKelompok(null)} />
          <ManagementAbsenOlahraga kelompok={kelompok} />
        </>
      )}
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
            <ReadRow key={f.key} label={f.label} value={entry![f.key] as string} />
          ))}
          <div>
            <div className="text-[11px] font-semibold" style={{ color: C.green }}>Target olahraga</div>
            {entry!.target.length ? (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {entry!.target.map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: C.leaf, color: C.green }}>
                    {t}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-sm" style={{ color: C.muted }}>—</div>
            )}
          </div>
          <ReadRow label="Alat yang digunakan" value={entry!.alat} />
        </div>
      )}
    </div>
  );
}

function ManagementAbsenOlahraga({ kelompok }: { kelompok: OlahragaKelompok }) {
  const thisMonday = useMemo(() => mondayOf(new Date()), []);
  const [monday, setMonday] = useState(thisMonday);
  const days = useMemo(() => weekdaysFrom(monday).slice(0, 3), [monday]);
  const atThisWeek = ymd(monday) >= ymd(thisMonday);

  const [entries, setEntries] = useState<Record<string, AbsenOlahragaEntry>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    readAbsenOlahragaRange(ymd(days[0]), ymd(days[2]), { kelompok })
      .then((m) => !cancelled && setEntries(m))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [kelompok, monday]); // eslint-disable-line react-hooks/exhaustive-deps

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
            <ReadOnlyAbsenOlahragaDay key={ymd(d)} date={d} entry={entries[ymd(d)]} />
          ))}
        </div>
      )}
    </>
  );
}

function ReadOnlyAbsenOlahragaDay({ date, entry }: { date: Date; entry: AbsenOlahragaEntry | undefined }) {
  const filled = isAbsenOlahragaFilled(entry);
  return (
    <div className="rounded-2xl p-3.5" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
      <div className="flex items-center gap-3">
        <span
          className="w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 leading-none"
          style={{ background: filled ? C.green : C.leaf, color: filled ? "#FFF" : C.green }}
        >
          <span className="text-[9px] font-semibold uppercase">{labelHari(date).slice(0, 3)}</span>
          <span className="text-sm font-bold">{date.getDate()}</span>
        </span>
        <div>
          <div className="text-sm font-semibold" style={{ color: C.ink }}>{labelHari(date)}</div>
          <div className="text-xs" style={{ color: C.muted }}>{labelTanggal(date)}</div>
        </div>
      </div>

      {!filled ? (
        <p className="mt-2 text-xs" style={{ color: C.muted }}>Belum absen.</p>
      ) : (
        <div className="mt-3">
          <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: C.leaf, color: C.green }}>
            {STATUS_LABEL[(entry as AbsenOlahragaEntry).status]}
          </span>
          {(entry as AbsenOlahragaEntry).keterangan.trim() && (
            <p className="mt-1.5 text-sm whitespace-pre-wrap" style={{ color: C.ink }}>
              {(entry as AbsenOlahragaEntry).keterangan.trim()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ shared bits ═══════════════════════ */

function HeaderCard({ title, name, sub }: { title: string; name: string; sub: string }) {
  return (
    <div
      className="relative rounded-2xl p-4 sm:p-5 overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${C.greenDeep} 0%, ${C.green} 100%)`, boxShadow: "0 4px 14px rgba(28,74,51,0.16)" }}
    >
      <span
        className="absolute -right-6 -top-6 w-28 h-28 rounded-full"
        style={{ background: "rgba(255,255,255,0.08)" }}
        aria-hidden="true"
      />
      <div className="relative flex items-center gap-3">
        <span
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(255,255,255,0.16)", color: "#FFF" }}
        >
          <WhistleIcon />
        </span>
        <div className="min-w-0">
          <div className="text-base font-semibold text-white truncate" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>{title}</div>
          <div className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.8)" }}>{name} · {sub}</div>
        </div>
      </div>
    </div>
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
      <path d="M8.5 11.5h7M8.5 15h5" stroke="#FFF" strokeWidth="1.6" strokeLinecap="round" />
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

function AbsenIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="#FFF" strokeWidth="1.7" />
      <path d="M3.5 9.5h17" stroke="#FFF" strokeWidth="1.7" />
      <path d="M8 3v3.5M16 3v3.5" stroke="#FFF" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8.5 14.5l2 2 4.5-4.5" stroke="#FFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
