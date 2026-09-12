import { C } from "../data";

/**
 * Kartu pilih bulan — grid 3 kolom, tiap bulan jadi kartu kecil dgn ikon, bukan pil teks polos.
 * Dipakai di Olahraga & Capaian (Ilmu/Al-Qur'an) biar seragam & gak monoton.
 */
export function MonthGrid({
  months,
  value,
  onSelect,
  isOpen,
}: {
  months: string[];
  value: string | null;
  onSelect: (bulan: string) => void;
  /** Kalau di-skip, semua bulan dianggap terbuka (mis. Olahraga — boleh rencana jauh hari). */
  isOpen?: (bulan: string) => boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {months.map((b) => {
        const open = isOpen ? isOpen(b) : true;
        const active = b === value;
        return (
          <button
            key={b}
            type="button"
            disabled={!open}
            onClick={() => onSelect(b)}
            className="relative flex flex-col items-center gap-1.5 rounded-2xl py-3.5 transition-all duration-200"
            style={{
              background: active
                ? `linear-gradient(135deg, ${C.green} 0%, ${C.greenDeep} 100%)`
                : open
                  ? "#FFF"
                  : C.leaf,
              border: `1px solid ${active ? C.green : C.line}`,
              boxShadow: active ? "0 4px 14px rgba(28,74,51,0.22)" : "none",
              opacity: open ? 1 : 0.55,
              cursor: open ? "pointer" : "not-allowed",
            }}
          >
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: active ? "rgba(255,255,255,0.18)" : C.leaf, color: active ? "#FFF" : C.green }}
            >
              {open ? <CalendarDotIcon /> : <LockIcon />}
            </span>
            <span className="text-xs font-semibold" style={{ color: active ? "#FFF" : open ? C.ink : C.muted }}>
              {b}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CalendarDotIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.5 9.5h17" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 3v3.5M16 3v3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="14.5" r="1.6" fill="currentColor" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
