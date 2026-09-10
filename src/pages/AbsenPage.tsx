import { useEffect, useMemo, useState } from "react";
import { C } from "../data";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { PageLoadingSkeleton } from "../components/Skeleton";
import { PickerCard } from "../components/PickerCard";
import { RuleCard } from "../components/RuleCard";
import {
  readAbsenRange,
  saveAbsenDay,
  emptyAbsen,
  isAbsenFilled,
  ringkasAbsen,
  nowHM,
  STATUS_LABEL,
  mondayOf,
  weekdaysFrom,
  ymd,
  labelHari,
  labelTanggal,
  labelRentangPekan,
  type AbsenEntry,
  type AbsenStatus,
} from "../lib/absen";

const STATUSES: AbsenStatus[] = ["hadir", "izin", "sakit", "cuti"];

const PERATURAN = [
  "Absen setiap hari kerja (Senin–Jumat) pada jam kedatangan dan kepulangan.",
  "Ketuk tombol untuk mencatat jam otomatis; jam bisa dikoreksi manual bila perlu.",
  "Kalau berhalangan hadir, pilih Izin / Sakit / Cuti dan tulis keterangannya.",
  "Hari yang terlewat masih bisa dikoreksi; tanggal yang belum tiba belum bisa diisi.",
];

export default function AbsenPage() {
  const { role } = useAuth();
  return role === "management" ? <ManagementAbsen /> : <GuruAbsen />;
}

/* ═══════════════════════ Guru ═══════════════════════ */

function GuruAbsen() {
  const { kelas } = useAuth();
  const thisMonday = useMemo(() => mondayOf(new Date()), []);
  const [monday, setMonday] = useState(thisMonday);
  const days = useMemo(() => weekdaysFrom(monday), [monday]);
  const todayYmd = ymd(new Date());

  const [entries, setEntries] = useState<Record<string, AbsenEntry>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<string | null>(null);

  const atThisWeek = ymd(monday) >= ymd(thisMonday);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    readAbsenRange(ymd(days[0]), ymd(days[4]), {})
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
            Absen Guru
          </h1>
          <p className="text-sm mt-1" style={{ color: C.muted }}>{kelas}</p>
        </header>

        <RuleCard title="Peraturan mengisi absen" rules={PERATURAN} icon={<AbsenRuleIcon />} />

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
                <AbsenDayCard
                  key={key}
                  date={d}
                  isToday={key === todayYmd}
                  editable={key <= todayYmd}
                  entry={entries[key] ?? emptyAbsen(key)}
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

function AbsenDayCard({
  date,
  isToday,
  editable,
  entry,
  open,
  onToggle,
  onSaved,
  kelas,
}: {
  date: Date;
  isToday: boolean;
  editable: boolean;
  entry: AbsenEntry;
  open: boolean;
  onToggle: () => void;
  onSaved: (e: AbsenEntry) => void;
  kelas: string;
}) {
  const [form, setForm] = useState<AbsenEntry>(entry);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // sinkronkan form dgn data server — dep pakai nilai primitif (bukan identity objek).
  useEffect(() => {
    setForm({
      tanggal: entry.tanggal,
      status: entry.status,
      jam_datang: entry.jam_datang,
      jam_pulang: entry.jam_pulang,
      keterangan: entry.keterangan,
    });
    setMsg(null);
    setErr(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.tanggal, entry.status, entry.jam_datang, entry.jam_pulang, entry.keterangan]);

  const filled = isAbsenFilled(entry);
  const dirty =
    form.status !== entry.status ||
    form.jam_datang !== entry.jam_datang ||
    form.jam_pulang !== entry.jam_pulang ||
    form.keterangan !== entry.keterangan;

  const set = <K extends keyof AbsenEntry>(k: K, v: AbsenEntry[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  async function handleSave() {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      await saveAbsenDay({
        kelas,
        tanggal: ymd(date),
        status: form.status,
        jam_datang: form.jam_datang,
        jam_pulang: form.jam_pulang,
        keterangan: form.keterangan,
      });
      const saved: AbsenEntry =
        form.status === "hadir"
          ? { ...form, keterangan: "", tanggal: ymd(date) }
          : { ...form, jam_datang: null, jam_pulang: null, tanggal: ymd(date) };
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
            {editable ? ringkasAbsen(entry) : "Belum waktunya diisi"}
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
              {/* status */}
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((s) => {
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

              {form.status === "hadir" ? (
                <div className="mt-3 space-y-2.5">
                  <TimeField
                    label="Jam datang"
                    value={form.jam_datang}
                    onNow={() => set("jam_datang", nowHM())}
                    onManual={(v) => set("jam_datang", v)}
                  />
                  <TimeField
                    label="Jam pulang"
                    value={form.jam_pulang}
                    onNow={() => set("jam_pulang", nowHM())}
                    onManual={(v) => set("jam_pulang", v)}
                  />
                </div>
              ) : (
                <label className="block mt-3">
                  <span className="block text-xs font-semibold mb-1" style={{ color: C.green }}>
                    Keterangan {STATUS_LABEL[form.status].toLowerCase()}
                  </span>
                  <textarea
                    value={form.keterangan}
                    onChange={(e) => set("keterangan", e.target.value)}
                    rows={2}
                    placeholder="Contoh: ada keperluan keluarga, sudah izin ke kepala kuttab."
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

function TimeField({
  label,
  value,
  onNow,
  onManual,
}: {
  label: string;
  value: string | null;
  onNow: () => void;
  onManual: (v: string | null) => void;
}) {
  return (
    <div className="rounded-xl p-3" style={{ border: `1px solid ${C.line}` }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: C.green }}>{label}</span>
        {value ? (
          <span className="text-lg font-bold tabular-nums" style={{ color: C.ink }}>
            {value.replace(":", ".")}
          </span>
        ) : (
          <span className="text-xs" style={{ color: C.muted }}>Belum dicatat</span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={onNow}
          className="flex-1 py-2 rounded-lg text-xs font-bold transition-colors"
          style={{ background: C.leaf, color: C.green, border: `1px solid ${C.green}` }}
        >
          {value ? "Perbarui ke jam sekarang" : "Catat jam sekarang"}
        </button>
        <input
          type="time"
          value={value ?? ""}
          onChange={(e) => onManual(e.target.value || null)}
          aria-label={`${label} — atur manual`}
          className="text-sm px-2 py-1.5 rounded-lg outline-none tabular-nums"
          style={{ border: `1px solid ${C.line}`, color: C.ink }}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════ Management ═══════════════════════ */

function ManagementAbsen() {
  const [kelasList, setKelasList] = useState<string[]>([]);
  const [kelasI, setKelasI] = useState<number | null>(null);
  const [monday, setMonday] = useState(() => mondayOf(new Date()));
  const days = useMemo(() => weekdaysFrom(monday), [monday]);
  const thisMonday = useMemo(() => mondayOf(new Date()), []);
  const atThisWeek = ymd(monday) >= ymd(thisMonday);

  const [entries, setEntries] = useState<Record<string, AbsenEntry>>({});
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
    readAbsenRange(ymd(days[0]), ymd(days[4]), { kelas })
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
            Absen Guru
          </h1>
          <p className="text-sm mt-1" style={{ color: C.muted }}>Rekap kehadiran harian guru</p>
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
                {days.map((d) => (
                  <ReadOnlyAbsenDay key={ymd(d)} date={d} entry={entries[ymd(d)]} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ReadOnlyAbsenDay({ date, entry }: { date: Date; entry: AbsenEntry | undefined }) {
  const filled = isAbsenFilled(entry);
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
      ) : (entry as AbsenEntry).status === "hadir" ? (
        <div className="mt-3 flex gap-6">
          <div>
            <div className="text-[11px] font-semibold" style={{ color: C.green }}>Datang</div>
            <div className="text-base font-bold tabular-nums" style={{ color: C.ink }}>
              {(entry as AbsenEntry).jam_datang?.replace(":", ".") ?? "–"}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold" style={{ color: C.green }}>Pulang</div>
            <div className="text-base font-bold tabular-nums" style={{ color: C.ink }}>
              {(entry as AbsenEntry).jam_pulang?.replace(":", ".") ?? "–"}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <span
            className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold"
            style={{ background: C.leaf, color: C.green }}
          >
            {STATUS_LABEL[(entry as AbsenEntry).status]}
          </span>
          {(entry as AbsenEntry).keterangan.trim() && (
            <p className="mt-1.5 text-sm whitespace-pre-wrap" style={{ color: C.ink }}>
              {(entry as AbsenEntry).keterangan.trim()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ shared ═══════════════════════ */

function AbsenRuleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
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
