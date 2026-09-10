import { useEffect, useState } from "react";
import { C } from "../data";
import { useAuth } from "../contexts/AuthContext";
import { PageLoadingSkeleton } from "../components/Skeleton";
import {
  readOlahragaBulan,
  saveOlahraga,
  emptyOlahraga,
  isRencanaFilled,
  isEvalFilled,
  TINGKAT_LIST,
  BULAN_OLAHRAGA,
  TARGET_PRESET,
  PEKAN_FIELDS,
  EVAL_FIELDS,
  KELOMPOK_LABEL,
  type OlahragaEntry,
  type OlahragaTingkat,
  type OlahragaKelompok,
} from "../lib/olahraga";

type Mode = "rencana" | "evaluasi";

const MONTH_NUM: Record<string, number> = {
  Juli: 7, Agustus: 8, September: 9, Oktober: 10, November: 11, Desember: 12,
};
function defaultBulan(): string {
  const m = new Date().getMonth() + 1;
  return BULAN_OLAHRAGA.find((b) => MONTH_NUM[b] === m) ?? BULAN_OLAHRAGA[0];
}

export default function OlahragaPage() {
  const { role } = useAuth();
  return role === "management" ? <ManagementOlahraga /> : <GuruOlahraga />;
}

/* ═══════════════════════ Guru olahraga ═══════════════════════ */

function GuruOlahraga() {
  const { kelompok, fullName } = useAuth();
  const [mode, setMode] = useState<Mode>("rencana");
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
        <header>
          <h1
            className="text-xl sm:text-2xl font-semibold"
            style={{ color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            {mode === "rencana" ? "Rencana Kegiatan Olahraga" : "Evaluasi Kegiatan Olahraga"}
          </h1>
          <p className="text-sm mt-1" style={{ color: C.muted }}>
            {fullName || `Guru Olahraga ${KELOMPOK_LABEL[kelompok]}`} · Kuttab Awwal 1–3
          </p>
        </header>

        <ModeToggle mode={mode} onChange={setMode} />

        <MonthChips value={bulan} onChange={setBulan} />

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
                mode={mode}
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
      </div>
    </div>
  );
}

function TingkatCard({
  mode,
  tingkat,
  bulan,
  kelompok,
  entry,
  open,
  onToggle,
  onSaved,
}: {
  mode: Mode;
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
      eval_ketercapaian: entry.eval_ketercapaian,
      eval_partisipasi: entry.eval_partisipasi,
      eval_kendala: entry.eval_kendala,
      eval_perkembangan: entry.eval_perkembangan,
      eval_tindak_lanjut: entry.eval_tindak_lanjut,
    });
    setMsg(null);
    setErr(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    entry.tingkat, entry.bulan, targetKey, entry.alat,
    entry.pekan1, entry.pekan2, entry.pekan3, entry.pekan4,
    entry.eval_ketercapaian, entry.eval_partisipasi, entry.eval_kendala,
    entry.eval_perkembangan, entry.eval_tindak_lanjut,
  ]);

  // ganti mode => tutup pesan lama
  useEffect(() => {
    setMsg(null);
    setErr(null);
  }, [mode]);

  const rencanaOk = isRencanaFilled(entry);
  const evalOk = isEvalFilled(entry);

  const dirtyRencana =
    form.alat !== entry.alat ||
    form.target.join("") !== targetKey ||
    PEKAN_FIELDS.some((f) => form[f.key] !== entry[f.key]);
  const dirtyEval = EVAL_FIELDS.some((f) => form[f.key] !== entry[f.key]);
  const dirty = mode === "rencana" ? dirtyRencana : dirtyEval;

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
        eval_ketercapaian: form.eval_ketercapaian,
        eval_partisipasi: form.eval_partisipasi,
        eval_kendala: form.eval_kendala,
        eval_perkembangan: form.eval_perkembangan,
        eval_tindak_lanjut: form.eval_tindak_lanjut,
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

  const done = mode === "rencana" ? rencanaOk : evalOk;
  const statusLine =
    mode === "rencana"
      ? rencanaOk
        ? "Rencana sudah diisi — ketuk untuk lihat / edit"
        : "Rencana belum diisi"
      : evalOk
        ? "Evaluasi sudah diisi — ketuk untuk lihat / edit"
        : "Evaluasi belum diisi";

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
          className="px-2.5 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold"
          style={{ background: done ? C.green : C.leaf, color: done ? "#FFF" : C.green }}
        >
          {tingkat}
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
          {mode === "rencana" ? (
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
          ) : (
            <div className="space-y-3">
              {EVAL_FIELDS.map((f) => (
                <Field key={f.key} label={f.label}>
                  <textarea
                    value={form[f.key] as string}
                    onChange={(e) => set(f.key, e.target.value as OlahragaEntry[typeof f.key])}
                    rows={2}
                    placeholder="Tulis di sini…"
                    className="w-full text-sm outline-none px-3 py-2 rounded-lg resize-y"
                    style={{ border: `1px solid ${C.line}` }}
                  />
                </Field>
              ))}
            </div>
          )}

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

/* ═══════════════════════ Management ═══════════════════════ */

function ManagementOlahraga() {
  const [mode, setMode] = useState<Mode>("rencana");
  const [kelompok, setKelompok] = useState<OlahragaKelompok>("ikhwan");
  const [bulan, setBulan] = useState<string>(defaultBulan);
  const [entries, setEntries] = useState<Record<string, OlahragaEntry>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
    <div className="min-h-dvh" style={{ background: C.mist, color: C.ink }}>
      <div className="max-w-2xl mx-auto px-4 pt-6 sm:pt-9 pb-32 sm:pb-40">
        <header>
          <h1
            className="text-xl sm:text-2xl font-semibold"
            style={{ color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Rekap Olahraga
          </h1>
          <p className="text-sm mt-1" style={{ color: C.muted }}>
            {mode === "rencana" ? "Rencana kegiatan" : "Evaluasi kegiatan"} olahraga Kuttab Awwal 1–3
          </p>
        </header>

        <ModeToggle mode={mode} onChange={setMode} />

        <div className="mt-3 flex flex-wrap gap-2">
          {(["ikhwan", "akhwat"] as OlahragaKelompok[]).map((k) => {
            const active = k === kelompok;
            return (
              <button
                key={k}
                onClick={() => setKelompok(k)}
                className="text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                style={{
                  background: active ? C.green : "#FFF",
                  color: active ? "#FFF" : C.ink,
                  border: `1px solid ${active ? C.green : C.line}`,
                }}
              >
                {KELOMPOK_LABEL[k]}
              </button>
            );
          })}
        </div>

        <MonthChips value={bulan} onChange={setBulan} />

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
              <ReadOnlyTingkat key={t} mode={mode} tingkat={t} entry={entries[t]} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReadOnlyTingkat({
  mode,
  tingkat,
  entry,
}: {
  mode: Mode;
  tingkat: OlahragaTingkat;
  entry: OlahragaEntry | undefined;
}) {
  const filled = mode === "rencana" ? isRencanaFilled(entry) : isEvalFilled(entry);

  return (
    <div className="rounded-2xl p-3.5" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
      <div className="flex items-center gap-3">
        <span
          className="px-2.5 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold"
          style={{ background: filled ? C.green : C.leaf, color: filled ? "#FFF" : C.green }}
        >
          {tingkat}
        </span>
        <div className="text-sm font-semibold" style={{ color: C.ink }}>
          Kuttab Awwal {tingkat.replace("KA ", "")}
        </div>
      </div>

      {!filled ? (
        <p className="mt-2 text-xs" style={{ color: C.muted }}>
          {mode === "rencana" ? "Rencana belum diisi." : "Evaluasi belum diisi."}
        </p>
      ) : mode === "rencana" ? (
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
      ) : (
        <div className="mt-3 space-y-3">
          {EVAL_FIELDS.map((f) => (
            <ReadRow key={f.key} label={f.label} value={entry![f.key] as string} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ shared bits ═══════════════════════ */

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div
      className="mt-5 grid grid-cols-2 gap-1 p-1 rounded-xl"
      style={{ background: "#FFF", border: `1px solid ${C.line}` }}
    >
      {(["rencana", "evaluasi"] as Mode[]).map((m) => {
        const active = m === mode;
        return (
          <button
            key={m}
            onClick={() => onChange(m)}
            className="py-2 rounded-lg text-sm font-semibold transition-colors"
            style={{ background: active ? C.green : "transparent", color: active ? "#FFF" : C.muted }}
          >
            {m === "rencana" ? "Rencana Kegiatan" : "Evaluasi"}
          </button>
        );
      })}
    </div>
  );
}

function MonthChips({ value, onChange }: { value: string; onChange: (b: string) => void }) {
  return (
    <div className="mt-3">
      <span className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: C.green }}>
        Bulan
      </span>
      <div className="flex flex-wrap gap-2">
        {BULAN_OLAHRAGA.map((b) => {
          const active = b === value;
          return (
            <button
              key={b}
              onClick={() => onChange(b)}
              className="text-sm font-medium px-3.5 py-2 rounded-xl transition-colors"
              style={{
                background: active ? C.green : "#FFF",
                color: active ? "#FFF" : C.ink,
                border: `1px solid ${active ? C.green : C.line}`,
              }}
            >
              {b}
            </button>
          );
        })}
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
