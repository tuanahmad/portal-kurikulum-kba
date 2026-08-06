import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { C, LOGO, RPB_FILES, REFLEKSI_FILES, fileUrl, isMonthOpen, getCurrentMonthFile } from "../data";
import { GoldDivider } from "../components/PortalComponents";
import { BottomNav } from "../components/BottomNav";
import { PageLoadingSkeleton } from "../components/Skeleton";
import { useAuth } from "../contexts/AuthContext";
import { getMyChecklist, setChecked, getAllChecklist, getMyName, updateMyName, type GuruChecklistRow } from "../lib/checklist";

export default function RpbPage() {
  const { role } = useAuth();

  return (
    <div className="min-h-screen" style={{ background: C.mist, color: C.ink }}>
      <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${C.green}, ${C.gold}, ${C.green})` }} />

      <div className="max-w-3xl mx-auto px-4 py-7 sm:py-10 pb-24">
        <div className="mb-2">
          <Link to="/home" className="text-xs underline" style={{ color: C.green }}>
            ← Home
          </Link>
        </div>

        <header className="text-center">
          <img src={LOGO} alt="Logo Kuttab Budi Ashari" className="mx-auto w-40 sm:w-48 h-auto" style={{ mixBlendMode: "multiply" }} />
          <div className="max-w-md mx-auto mt-3">
            <GoldDivider />
          </div>
          <h1
            className="text-xl sm:text-2xl font-semibold mt-3"
            style={{ color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Rencana Pembelajaran Guru
          </h1>
          <p className="text-sm mt-2 max-w-md mx-auto" style={{ color: C.muted }}>
            {role === "management"
              ? "Rekap checklist pengisian RPB & Refleksi seluruh guru."
              : "Isi RPB bulanan & refleksi di sheet-nya, lalu centang kalau sudah selesai."}
          </p>
        </header>

        <main className="mt-6">
          {role === "management" ? <ManagementView /> : <GuruView />}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}

/* ————————————————————— Tampilan Guru ————————————————————— */

function GuruView() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [checklist, setChecklist] = useState<Map<string, boolean> | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    getMyChecklist(userId).then(setChecklist);
    getMyName(userId).then(setName);
  }, [userId]);

  async function toggle(fileId: string, section: "rpb" | "refleksi", current: boolean) {
    if (!userId) return;
    const key = `${section}:${fileId}`;
    setSaving(key);
    try {
      await setChecked(userId, fileId, section, !current);
      setChecklist((prev) => {
        const next = new Map(prev);
        next.set(key, !current);
        return next;
      });
    } finally {
      setSaving(null);
    }
  }

  if (!checklist) return <PageLoadingSkeleton />;

  return (
    <div className="space-y-6">
      <NameField name={name} onSaved={setName} />
      <ChecklistGroup
        title="Rencana Pembelajaran Bulanan (RPB)"
        subtitle="Diisi tanggal 1–5"
        files={RPB_FILES}
        section="rpb"
        checklist={checklist}
        saving={saving}
        onToggle={toggle}
      />
      <ChecklistGroup
        title="Refleksi Rencana Belajar"
        subtitle="Diisi tiap tanggal 30"
        files={REFLEKSI_FILES}
        section="refleksi"
        checklist={checklist}
        saving={saving}
        onToggle={toggle}
      />
    </div>
  );
}

function NameField({ name, onSaved }: { name: string | null; onSaved: (n: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name || "");
  const [saving, setSaving] = useState(false);

  if (name === null) return null; // masih loading

  async function save() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await updateMyName(trimmed);
      onSaved(trimmed);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (!name && !editing) {
    return (
      <div
        className="rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3"
        style={{ background: C.goldSoft, border: `1px solid ${C.gold}` }}
      >
        <span className="text-xs" style={{ color: "#8A6A20" }}>
          Nama Anda belum diisi — supaya muncul di rekap management.
        </span>
        <button
          onClick={() => setEditing(true)}
          className="text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap shrink-0"
          style={{ background: C.green, color: "#FFF" }}
        >
          Isi nama
        </button>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="rounded-xl px-3.5 py-2.5 flex items-center gap-2" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Nama lengkap Anda"
          className="flex-1 text-sm outline-none min-w-0"
        />
        <button
          onClick={save}
          disabled={saving}
          className="text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap"
          style={{ background: C.green, color: "#FFF" }}
        >
          {saving ? "…" : "Simpan"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 px-1">
      <span className="text-sm" style={{ color: C.muted }}>
        Nama: <strong style={{ color: C.ink }}>{name}</strong>
      </span>
      <button onClick={() => { setDraft(name); setEditing(true); }} className="text-xs underline" style={{ color: C.green }}>
        Ubah
      </button>
    </div>
  );
}

function ChecklistGroup({
  title,
  subtitle,
  files,
  section,
  checklist,
  saving,
  onToggle,
}: {
  title: string;
  subtitle: string;
  files: { id: string; name: string }[];
  section: "rpb" | "refleksi";
  checklist: Map<string, boolean>;
  saving: string | null;
  onToggle: (fileId: string, section: "rpb" | "refleksi", current: boolean) => void;
}) {
  return (
    <div>
      <div className="mb-2.5 px-1">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em]" style={{ color: C.green }}>
          {title}
        </h2>
        <span className="text-xs" style={{ color: C.muted }}>{subtitle}</span>
      </div>
      <div className="space-y-2">
        {files.map((f) => {
          const key = `${section}:${f.id}`;
          const checked = checklist.get(key) || false;
          const isSaving = saving === key;
          const open = isMonthOpen(f.name);

          if (!open) {
            return (
              <div
                key={f.id}
                className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl"
                style={{ background: C.leaf, border: `1px solid ${C.line}`, opacity: 0.7 }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <LockIcon />
                  <span className="text-sm truncate" style={{ color: C.muted }}>{f.name}</span>
                </div>
                <span className="text-xs px-3.5 py-1.5 rounded-full whitespace-nowrap" style={{ color: C.muted }}>
                  Belum dibuka
                </span>
              </div>
            );
          }

          return (
            <div
              key={f.id}
              className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl"
              style={{ background: "#FFF", border: `1px solid ${C.line}` }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  onClick={() => onToggle(f.id, section, checked)}
                  disabled={isSaving}
                  className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                  style={{
                    background: checked ? C.green : "#FFF",
                    border: `1.5px solid ${checked ? C.green : C.line}`,
                  }}
                  aria-label={checked ? "Tandai belum selesai" : "Tandai sudah selesai"}
                >
                  {checked && (
                    <svg width="12" height="12" viewBox="0 0 24 24">
                      <path d="M5 12l5 5 9-9" fill="none" stroke="#FFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                <span className="text-sm truncate" style={{ color: C.ink }}>{f.name}</span>
              </div>
              <a
                href={fileUrl(f.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold px-3.5 py-1.5 rounded-full whitespace-nowrap"
                style={{ background: C.green, color: "#FFF" }}
              >
                Buka & isi
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" className="shrink-0">
      <rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="#9AA294" strokeWidth="1.8" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" fill="none" stroke="#9AA294" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/* ————————————————————— Tampilan Management ————————————————————— */

function ManagementView() {
  const [rows, setRows] = useState<GuruChecklistRow[] | null>(null);

  useEffect(() => {
    getAllChecklist().then(setRows);
  }, []);

  if (!rows) return <PageLoadingSkeleton />;

  if (rows.length === 0) {
    return (
      <p className="text-sm text-center" style={{ color: C.muted }}>
        Belum ada akun guru yang terdaftar.
      </p>
    );
  }

  const currentRpb = getCurrentMonthFile(RPB_FILES);
  const currentRefleksi = getCurrentMonthFile(REFLEKSI_FILES);

  return (
    <div className="space-y-4">
      {rows.map((g) => (
        <div key={g.userId} className="rounded-2xl p-4 sm:p-5" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
          <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
            <div className="font-semibold" style={{ color: C.green }}>{g.fullName}</div>
            <div className="flex gap-1.5">
              {currentRpb && (
                <a
                  href={fileUrl(currentRpb.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
                  style={{ background: C.leaf, color: C.green, border: `1px solid ${C.green}` }}
                >
                  Buka RPB
                </a>
              )}
              {currentRefleksi && (
                <a
                  href={fileUrl(currentRefleksi.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
                  style={{ background: C.leaf, color: C.green, border: `1px solid ${C.green}` }}
                >
                  Buka Refleksi
                </a>
              )}
            </div>
          </div>
          <MiniChecklistRow label="RPB" section="rpb" files={RPB_FILES} entries={g.entries} />
          <MiniChecklistRow label="Refleksi" section="refleksi" files={REFLEKSI_FILES} entries={g.entries} />
        </div>
      ))}
      <p className="text-xs px-1" style={{ color: C.muted }}>
        Kotak hijau = sudah ditandai selesai oleh guru. Tap kotak mana pun untuk langsung membuka
        file-nya di Drive.
      </p>
    </div>
  );
}

function MiniChecklistRow({
  label,
  section,
  files,
  entries,
}: {
  label: string;
  section: "rpb" | "refleksi";
  files: { id: string; name: string }[];
  entries: Map<string, boolean>;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap mb-1.5 last:mb-0">
      <span className="text-xs font-semibold w-16 shrink-0" style={{ color: C.muted }}>{label}</span>
      <div className="flex gap-1.5 flex-wrap">
        {files.map((f) => {
          const checked = entries.get(`${section}:${f.id}`) || false;
          return (
            <a
              key={f.id}
              href={fileUrl(f.id)}
              target="_blank"
              rel="noopener noreferrer"
              title={`${f.name} — klik untuk buka${checked ? " (sudah ditandai selesai)" : ""}`}
              className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold transition-opacity hover:opacity-80"
              style={{
                background: checked ? C.green : C.leaf,
                color: checked ? "#FFF" : C.muted,
                border: checked ? "none" : `1px solid ${C.line}`,
              }}
            >
              {f.name.slice(0, 1)}
            </a>
          );
        })}
      </div>
    </div>
  );
}
