import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { C, capaianRoster } from "../data";
import { useAuth } from "../contexts/AuthContext";
import { PageLoadingSkeleton } from "../components/Skeleton";
import { useDraft } from "../lib/useDraft";
import { PickerCard } from "../components/PickerCard";
import {
  readTasmiByKelas,
  createTasmiRecord,
  updateTasmiRecord,
  deleteTasmiRecord,
  emptyTasmiDraft,
  type TasmiRecord,
  type TasmiDraft,
} from "../lib/tasmi";

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function labelTanggal(ymd: string): string {
  const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const [y, m, d] = ymd.split("-").map(Number);
  return `${d} ${BULAN[m - 1]} ${y}`;
}

export default function TasmiPage() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const { role, kelas: authKelas, fullName } = useAuth();
  const isGuru = role === "guru";
  const kelas = isGuru ? authKelas : sp.get("kelas");
  const roster = useMemo(() => (kelas ? capaianRoster(kelas) : []), [kelas]);

  const [records, setRecords] = useState<TasmiRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TasmiRecord | null>(null);
  const [filterSantri, setFilterSantri] = useState<string>("");

  function reload() {
    if (!kelas) return;
    setLoading(true);
    setError(null);
    readTasmiByKelas(kelas)
      .then(setRecords)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kelas]);

  if (isGuru && !kelas) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: C.mist }}>
        <p className="text-sm" style={{ color: C.muted }}>Kelas belum diset untuk akun ini.</p>
      </div>
    );
  }

  const shown = filterSantri ? records.filter((r) => r.nama_santri === filterSantri) : records;
  const santriWithRecords = [...new Set(records.map((r) => r.nama_santri))];

  return (
    <div className="min-h-dvh" style={{ background: C.mist, color: C.ink }}>
      <div className="max-w-2xl mx-auto px-4 pt-6 sm:pt-9 pb-28">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(isGuru ? "/capaian" : `/capaian?kelas=${encodeURIComponent(kelas ?? "")}`)}
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
              Tasmi'
            </h1>
            <p className="text-sm" style={{ color: C.muted }}>{kelas}</p>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl px-3.5 py-2.5 text-xs" style={{ background: "#FDEBEA", border: "1px solid #E8A6A0", color: "#8A2A20" }}>
            {error}
          </div>
        )}

        {isGuru && !formOpen && (
          <button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="mt-5 w-full flex items-center justify-center gap-2 text-sm font-semibold py-3 rounded-2xl transition-colors"
            style={{ background: C.leaf, color: C.green, border: `1.5px dashed ${C.green}` }}
          >
            <PlusIcon />
            Catat Tasmi'
          </button>
        )}

        {isGuru && formOpen && (
          <TasmiForm
            kelas={kelas!}
            roster={roster}
            fullName={fullName ?? ""}
            existing={editing}
            onCancel={() => {
              setFormOpen(false);
              setEditing(null);
            }}
            onSaved={() => {
              setFormOpen(false);
              setEditing(null);
              reload();
            }}
          />
        )}

        {/* Filter santri — cuma muncul kalau udah ada >1 santri yang punya riwayat */}
        {santriWithRecords.length > 1 && (
          <div className="mt-5 flex items-center gap-2 overflow-x-auto pb-1">
            <FilterChip label="Semua" active={!filterSantri} onClick={() => setFilterSantri("")} />
            {santriWithRecords.map((n) => (
              <FilterChip key={n} label={n} active={filterSantri === n} onClick={() => setFilterSantri(n)} />
            ))}
          </div>
        )}

        <div className="mt-5">
          {loading ? (
            <PageLoadingSkeleton />
          ) : shown.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: C.muted }}>
              {records.length === 0 ? "Belum ada riwayat tasmi'." : "Gak ada riwayat buat santri ini."}
            </p>
          ) : (
            <div className="space-y-3">
              {shown.map((r) => (
                <TasmiCard
                  key={r.id}
                  record={r}
                  kelas={kelas ?? ""}
                  editable={isGuru}
                  onEdit={() => {
                    setEditing(r);
                    setFormOpen(true);
                  }}
                  onDeleted={reload}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TasmiForm({
  kelas,
  roster,
  fullName,
  existing,
  onCancel,
  onSaved,
}: {
  kelas: string;
  roster: string[];
  fullName: string;
  existing: TasmiRecord | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  // Isi awal form (dan sekaligus "baseline" buat draf): data yang lagi diedit, atau form kosong.
  const [initial] = useState<TasmiDraft>(() =>
    existing
      ? {
          tanggal: existing.tanggal,
          nama_santri: existing.nama_santri,
          nama_ayah: existing.nama_ayah,
          usia_santri: existing.usia_santri,
          nama_guru: existing.nama_guru,
          juz: existing.juz,
          durasi: existing.durasi,
          jumlah_kesalahan: existing.jumlah_kesalahan,
        }
      : emptyTasmiDraft(todayYmd(), fullName)
  );
  const [form, setForm] = useState<TasmiDraft>(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const draft = useDraft({
    formKey: `tasmi:${kelas}:${existing?.id ?? "baru"}`,
    value: form,
    baseline: initial,
    setValue: setForm,
  });

  const valid = form.tanggal.trim() !== "" && form.nama_santri.trim() !== "";

  async function handleSave() {
    if (!valid) {
      setErr("Tanggal & nama santri wajib diisi.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      if (existing) await updateTasmiRecord(existing.id, form);
      else await createTasmiRecord(kelas, form);
      draft.clear();
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-5 rounded-2xl p-4 sm:p-5" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
      <div className="text-sm font-bold uppercase tracking-[0.1em] mb-3.5" style={{ color: C.green }}>
        {existing ? "Edit Catatan Tasmi'" : "Catat Tasmi' Baru"}
      </div>
      <div className="space-y-3 mt-3">
        <Field label="Tanggal">
          <input
            type="date"
            value={form.tanggal}
            onChange={(e) => setForm((p) => ({ ...p, tanggal: e.target.value }))}
            className="w-full text-sm outline-none px-3.5 py-2.5 rounded-xl"
            style={{ border: `1px solid ${C.line}` }}
          />
        </Field>
        <Field label="Nama Santri">
          {roster.length > 0 ? (
            <PickerCard
              items={roster.map((n) => ({ label: n }))}
              value={(() => {
                const i = roster.findIndex((n) => n === form.nama_santri);
                return i >= 0 ? i : null;
              })()}
              onChange={(i) => setForm((p) => ({ ...p, nama_santri: i == null ? "" : roster[i] }))}
              placeholderLabel="Pilih santri"
              selectedLabel="Santri"
              countText={`${roster.length} santri`}
              numbered={false}
            />
          ) : (
            <input
              value={form.nama_santri}
              onChange={(e) => setForm((p) => ({ ...p, nama_santri: e.target.value }))}
              placeholder="Nama santri"
              className="w-full text-sm outline-none px-3.5 py-2.5 rounded-xl"
              style={{ border: `1px solid ${C.line}` }}
            />
          )}
        </Field>
        <Field label="Nama Ayah/Wali">
          <input
            value={form.nama_ayah}
            onChange={(e) => setForm((p) => ({ ...p, nama_ayah: e.target.value }))}
            placeholder="Nama ayah/wali"
            className="w-full text-sm outline-none px-3.5 py-2.5 rounded-xl"
            style={{ border: `1px solid ${C.line}` }}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Usia Santri">
            <input
              value={form.usia_santri}
              onChange={(e) => setForm((p) => ({ ...p, usia_santri: e.target.value }))}
              placeholder="mis. 8 tahun"
              className="w-full text-sm outline-none px-3.5 py-2.5 rounded-xl"
              style={{ border: `1px solid ${C.line}` }}
            />
          </Field>
          <Field label="Nama Guru">
            <input
              value={form.nama_guru}
              onChange={(e) => setForm((p) => ({ ...p, nama_guru: e.target.value }))}
              className="w-full text-sm outline-none px-3.5 py-2.5 rounded-xl"
              style={{ border: `1px solid ${C.line}` }}
            />
          </Field>
        </div>
        <Field label="Juz">
          <input
            value={form.juz}
            onChange={(e) => setForm((p) => ({ ...p, juz: e.target.value }))}
            placeholder="mis. Juz 28"
            className="w-full text-sm outline-none px-3.5 py-2.5 rounded-xl"
            style={{ border: `1px solid ${C.line}` }}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Durasi">
            <input
              value={form.durasi}
              onChange={(e) => setForm((p) => ({ ...p, durasi: e.target.value }))}
              placeholder="mis. 15 menit"
              className="w-full text-sm outline-none px-3.5 py-2.5 rounded-xl"
              style={{ border: `1px solid ${C.line}` }}
            />
          </Field>
          <Field label="Jumlah Kesalahan">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={form.jumlah_kesalahan}
              onChange={(e) => setForm((p) => ({ ...p, jumlah_kesalahan: Math.max(0, Number(e.target.value) || 0) }))}
              className="w-full text-sm outline-none px-3.5 py-2.5 rounded-xl"
              style={{ border: `1px solid ${C.line}` }}
            />
          </Field>
        </div>
      </div>

      {err && <p className="mt-3 text-xs" style={{ color: "#8A2A20" }}>{err}</p>}

      <div className="flex gap-2 mt-4">
        <button
          onClick={onCancel}
          className="flex-1 text-sm font-semibold py-2.5 rounded-xl"
          style={{ background: C.leaf, color: C.green }}
        >
          Batal
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !valid}
          className="flex-1 text-sm font-bold py-2.5 rounded-xl transition-opacity"
          style={{ background: C.green, color: "#FFF", opacity: saving || !valid ? 0.6 : 1 }}
        >
          {saving ? "Menyimpan…" : "Simpan"}
        </button>
      </div>
    </div>
  );
}

function TasmiCard({
  record,
  kelas,
  editable,
  onEdit,
  onDeleted,
}: {
  record: TasmiRecord;
  kelas: string;
  editable: boolean;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteTasmiRecord(record.id);
      onDeleted();
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="rounded-2xl p-3.5 sm:p-4" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: C.ink }}>{record.nama_santri}</div>
          <div className="text-xs mt-0.5" style={{ color: C.muted }}>
            {labelTanggal(record.tanggal)}
            {record.usia_santri && ` · ${record.usia_santri}`}
          </div>
        </div>
        {editable && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onEdit}
              aria-label="Edit"
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: C.leaf, color: C.green }}
            >
              <PencilIcon />
            </button>
            {confirmDelete ? (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-[11px] font-semibold px-2.5 h-8 rounded-lg"
                style={{ background: "#FDEBEA", color: "#B3441C" }}
              >
                {deleting ? "…" : "Yakin?"}
              </button>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                aria-label="Hapus"
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "#FDEBEA", color: "#B3441C" }}
              >
                <TrashIcon />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3">
        <MiniStat label="Juz" value={record.juz || "—"} />
        <MiniStat label="Durasi" value={record.durasi || "—"} />
        <MiniStat label="Kesalahan" value={String(record.jumlah_kesalahan)} />
      </div>
      <div className="flex items-center justify-between gap-3 mt-2.5">
        {record.nama_guru ? (
          <div className="text-[11px]" style={{ color: C.muted }}>Diuji oleh {record.nama_guru}</div>
        ) : (
          <span />
        )}
        <Link
          to={`/capaian/tasmi/${record.id}/sertifikat?kelas=${encodeURIComponent(kelas)}`}
          className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold"
          style={{ color: C.gold }}
        >
          Lihat Sertifikat
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl px-2.5 py-2" style={{ background: C.leaf }}>
      <div className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: C.muted }}>{label}</div>
      <div className="text-sm font-semibold truncate" style={{ color: C.ink }}>{value}</div>
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors"
      style={{ background: active ? C.green : C.leaf, color: active ? "#FFF" : C.green }}
    >
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M4 20h4L18.5 9.5a2 2 0 0 0 0-2.83l-1.17-1.17a2 2 0 0 0-2.83 0L4 15.5V20Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M13 6l4.5 4.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7m2 0v13a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 20V7h10Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
