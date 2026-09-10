import { useEffect, useMemo, useState } from "react";
import { C } from "../data";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { PageLoadingSkeleton } from "../components/Skeleton";
import { PickerCard } from "../components/PickerCard";
import { RuleCard } from "../components/RuleCard";
import {
  readJurnalRange,
  saveJurnalDay,
  isEntryFilled,
  emptyEntry,
  mondayOf,
  weekdaysFrom,
  ymd,
  labelHari,
  labelTanggal,
  labelRentangPekan,
  type JurnalEntry,
} from "../lib/jurnal";

const QUESTIONS: { key: keyof Pick<JurnalEntry, "kondisi_guru" | "kondisi_santri" | "kabar_kendala">; label: string }[] = [
  { key: "kondisi_guru", label: "Bagaimana kondisi/kabarmu hari ini, wahai guru?" },
  { key: "kondisi_santri", label: "Bagaimana kondisi santri-santrimu pada hari ini, wahai guru?" },
  {
    key: "kabar_kendala",
    label: "Momen (baik/buruk) apa yang terjadi pada hari ini, dan bagaimana caramu menyikapinya?",
  },
];

const PERATURAN = [
  "Tulis jurnal sesuai format yang sudah ditentukan.",
  "Wajib menuliskan dengan bahasa yang baik dan benar.",
  "Isi jurnal setiap hari (Senin–Jumat); jurnal satu pekan otomatis terkumpul.",
];

export default function JurnalPage() {
  const { role } = useAuth();
  return role === "management" ? <ManagementJurnal /> : <GuruJurnal />;
}

/* ═══════════════════════ Guru ═══════════════════════ */

function GuruJurnal() {
  const { kelas } = useAuth();
  const thisMonday = useMemo(() => mondayOf(new Date()), []);
  const [monday, setMonday] = useState(thisMonday);
  const days = useMemo(() => weekdaysFrom(monday), [monday]);
  const todayYmd = ymd(new Date());

  const [entries, setEntries] = useState<Record<string, JurnalEntry>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<string | null>(null);

  const atThisWeek = ymd(monday) >= ymd(thisMonday);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    readJurnalRange(ymd(days[0]), ymd(days[4]), {})
      .then((m) => {
        if (cancelled) return;
        setEntries(m);
        // default buka hari ini kalau ada di pekan ini, kalau nggak buka hari pertama
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

  if (!kelas) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: C.mist }}>
        <p className="text-sm" style={{ color: C.muted }}>Kelas belum diset untuk akun ini.</p>
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
            Daily Jurnal
          </h1>
          <p className="text-sm mt-1" style={{ color: C.muted }}>{kelas}</p>
        </header>

        <RuleCard title="Peraturan mengisi jurnal" rules={PERATURAN} icon={<JurnalRuleIcon />} />

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
                <DayCard
                  key={key}
                  date={d}
                  isToday={key === todayYmd}
                  entry={entries[key] ?? emptyEntry(key)}
                  open={openDay === key}
                  onToggle={() => setOpenDay((o) => (o === key ? null : key))}
                  onSaved={(saved) => setEntries((prev) => ({ ...prev, [key]: saved }))}
                  kelas={kelas}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function DayCard({
  date,
  isToday,
  entry,
  open,
  onToggle,
  onSaved,
  kelas,
}: {
  date: Date;
  isToday: boolean;
  entry: JurnalEntry;
  open: boolean;
  onToggle: () => void;
  onSaved: (e: JurnalEntry) => void;
  kelas: string;
}) {
  const [form, setForm] = useState(entry);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // sinkronkan form dgn data server — pakai nilai primitifnya sbg dep (bukan identity objek,
  // yg berubah tiap render parent).
  useEffect(() => {
    setForm({
      tanggal: entry.tanggal,
      kondisi_guru: entry.kondisi_guru,
      kondisi_santri: entry.kondisi_santri,
      kabar_kendala: entry.kabar_kendala,
    });
    setMsg(null);
    setErr(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.tanggal, entry.kondisi_guru, entry.kondisi_santri, entry.kabar_kendala]);

  const filled = isEntryFilled(entry);
  const dirty =
    form.kondisi_guru !== entry.kondisi_guru ||
    form.kondisi_santri !== entry.kondisi_santri ||
    form.kabar_kendala !== entry.kabar_kendala;

  async function handleSave() {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      await saveJurnalDay({
        kelas,
        tanggal: ymd(date),
        kondisi_guru: form.kondisi_guru,
        kondisi_santri: form.kondisi_santri,
        kabar_kendala: form.kabar_kendala,
      });
      onSaved({ ...form, tanggal: ymd(date) });
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
            {filled ? "Sudah diisi — ketuk untuk lihat / edit" : "Belum diisi"}
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
          <div className="space-y-3">
            {QUESTIONS.map((q) => (
              <label key={q.key} className="block">
                <span className="block text-xs font-semibold mb-1" style={{ color: C.green }}>{q.label}</span>
                <textarea
                  value={form[q.key]}
                  onChange={(e) => setForm((p) => ({ ...p, [q.key]: e.target.value }))}
                  rows={2}
                  placeholder="Tulis di sini…"
                  className="w-full text-sm outline-none px-3 py-2 rounded-lg resize-y"
                  style={{ border: `1px solid ${C.line}` }}
                />
              </label>
            ))}
          </div>

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
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ Management ═══════════════════════ */

function ManagementJurnal() {
  const [kelasList, setKelasList] = useState<string[]>([]);
  const [kelasI, setKelasI] = useState<number | null>(null);
  const [monday, setMonday] = useState(() => mondayOf(new Date()));
  const days = useMemo(() => weekdaysFrom(monday), [monday]);
  const thisMonday = useMemo(() => mondayOf(new Date()), []);
  const atThisWeek = ymd(monday) >= ymd(thisMonday);

  const [entries, setEntries] = useState<Record<string, JurnalEntry>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("kelas")
      .eq("role", "guru")
      .then(({ data, error }) => {
        if (error) return setError(error.message);
        setKelasList((data ?? []).map((r) => r.kelas as string).filter(Boolean).sort());
      });
  }, []);

  const kelas = kelasI != null ? kelasList[kelasI] : null;

  useEffect(() => {
    if (!kelas) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    readJurnalRange(ymd(days[0]), ymd(days[4]), { kelas })
      .then((m) => !cancelled && setEntries(m))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [kelas, monday]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-dvh" style={{ background: C.mist, color: C.ink }}>
      <div className="max-w-2xl mx-auto px-4 pt-6 sm:pt-9 pb-32 sm:pb-40">
        <header>
          <h1
            className="text-xl sm:text-2xl font-semibold"
            style={{ color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Daily Jurnal
          </h1>
          <p className="text-sm mt-1" style={{ color: C.muted }}>Rekap jurnal harian guru</p>
        </header>

        <div className="mt-5">
          <PickerCard
            items={kelasList.map((k) => ({ label: k }))}
            value={kelasI}
            onChange={setKelasI}
            placeholderLabel="Pilih kelas"
            selectedLabel="Kelas"
            countText={`${kelasList.length} kelas`}
            numbered={false}
          />
        </div>

        {kelas && (
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
                {days.map((d) => {
                  const e = entries[ymd(d)];
                  return <ReadOnlyDay key={ymd(d)} date={d} entry={e} />;
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ReadOnlyDay({ date, entry }: { date: Date; entry: JurnalEntry | undefined }) {
  const filled = isEntryFilled(entry);
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

      {filled ? (
        <div className="mt-3 space-y-2.5">
          {QUESTIONS.map((q) => {
            const v = (entry as JurnalEntry)[q.key]?.trim();
            return (
              <div key={q.key}>
                <div className="text-[11px] font-semibold" style={{ color: C.green }}>{q.label}</div>
                <div className="text-sm whitespace-pre-wrap" style={{ color: v ? C.ink : C.muted }}>
                  {v || "—"}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-2 text-xs" style={{ color: C.muted }}>Belum diisi.</p>
      )}
    </div>
  );
}

/* ═══════════════════════ shared ═══════════════════════ */

function JurnalRuleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="4.5" y="3.5" width="15" height="17" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 3.5v17" stroke="currentColor" strokeWidth="1.7" />
      <path d="M11.5 9h5M11.5 12.5h5M11.5 16h3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
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
