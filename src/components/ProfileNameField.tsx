import { useState } from "react";
import { C } from "../data";
import { useAuth } from "../contexts/AuthContext";
import { updateMyName } from "../lib/checklist";

/** Nama guru yang bisa diedit inline lewat ikon pensil — dipakai di ProfileMenu (mobile)
 *  & panel hamburger Sidebar (desktop), jadi satu sumber biar gak dobel logic. */
export function ProfileNameField({ variant = "light" }: { variant?: "light" | "dark" }) {
  const { role, kelas, fullName, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(fullName || "");
  const [saving, setSaving] = useState(false);

  const isDark = variant === "dark";
  const label = fullName || kelas || (role === "management" ? "Management" : "Akun");
  const textColor = isDark ? "#FFFFFF" : C.ink;
  const mutedColor = isDark ? "rgba(255,255,255,0.65)" : C.muted;

  async function save() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await updateMyName(trimmed);
      await refreshProfile();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="px-3.5 py-2 flex items-center gap-2">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="Nama lengkap"
          className="flex-1 text-sm outline-none min-w-0 bg-transparent border-b py-0.5"
          style={{ color: textColor, borderColor: isDark ? "rgba(255,255,255,0.4)" : C.line }}
        />
        <button
          onClick={save}
          disabled={saving}
          className="text-xs font-semibold shrink-0"
          style={{ color: isDark ? C.gold : C.green }}
        >
          {saving ? "…" : "Simpan"}
        </button>
      </div>
    );
  }

  return (
    <div className="px-3.5 py-2 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="text-sm font-semibold truncate" style={{ color: textColor }}>
          {label}
        </div>
        <div className="text-xs mt-0.5" style={{ color: mutedColor }}>
          {role === "management" ? "Management" : "Guru"}
        </div>
      </div>
      {role === "guru" && (
        <button
          onClick={() => {
            setDraft(fullName || "");
            setEditing(true);
          }}
          aria-label="Ubah nama"
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors hover:opacity-70"
          style={{ color: mutedColor }}
        >
          <PencilIcon />
        </button>
      )}
    </div>
  );
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 20h4L18.5 9.5a2 2 0 0 0 0-2.83l-1.17-1.17a2 2 0 0 0-2.83 0L4 15.5V20Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M13 6l4.5 4.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
