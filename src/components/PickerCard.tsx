import { useEffect, useState, type ReactNode } from "react";
import { C } from "../data";

export type PickerItem = { label: string; sub?: string };

/** Kartu pilihan yang bisa dibuka-tutup: header selalu kelihatan, dipencet -> daftar item muncul,
 *  pilih item -> daftar nutup & header berubah jadi item terpilih. Dipakai di form Capaian
 *  (pilih santri / pilih jenis capaian). */
export function PickerCard({
  items,
  value,
  onChange,
  placeholderLabel,
  selectedLabel,
  countText,
  icon,
  numbered = true,
  scrollAfter = 9,
}: {
  items: PickerItem[];
  value: number | null;
  onChange: (i: number | null) => void;
  /** teks kecil di header pas belum ada yang dipilih */
  placeholderLabel: string;
  /** teks kecil di header pas udah ada yang dipilih */
  selectedLabel: string;
  /** teks utama di header pas belum dipilih (mis. "11 santri") */
  countText: string;
  icon?: ReactNode;
  numbered?: boolean;
  scrollAfter?: number;
}) {
  const [open, setOpen] = useState(value == null);
  useEffect(() => {
    if (value == null) setOpen(true);
  }, [value]);

  const sel = value != null ? items[value] : null;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors"
        style={{ background: open ? C.leaf : "#FFF" }}
      >
        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: sel ? C.green : C.leaf, color: sel ? "#FFF" : C.green }}
        >
          {sel && numbered ? (
            <span className="text-sm font-bold">{(value as number) + 1}</span>
          ) : (
            icon ?? <DefaultIcon />
          )}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-wide" style={{ color: C.muted }}>
            {sel ? selectedLabel : placeholderLabel}
          </span>
          <span className="block text-sm font-semibold truncate" style={{ color: sel ? C.ink : C.muted }}>
            {sel ? sel.label : countText}
          </span>
        </span>
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none"
          className="shrink-0 transition-transform"
          style={{ color: C.green, transform: open ? "rotate(180deg)" : "none" }}
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          className={items.length > scrollAfter ? "max-h-[20rem] overflow-y-auto" : ""}
          style={{ borderTop: `1px solid ${C.line}` }}
        >
          {items.map((it, i) => {
            const active = i === value;
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  onChange(i);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-3 pl-3 pr-3.5 py-2.5 text-left transition-colors"
                style={{
                  background: active ? C.leaf : "transparent",
                  borderTop: i === 0 ? "none" : `1px solid ${C.line}`,
                  borderLeft: `3px solid ${active ? C.green : "transparent"}`,
                }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "#F7F6F1"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = active ? C.leaf : "transparent"; }}
              >
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                  style={{ background: active ? C.green : C.leaf, color: active ? "#FFF" : C.green }}
                >
                  {numbered ? i + 1 : "•"}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm truncate" style={{ color: C.ink, fontWeight: active ? 600 : 400 }}>
                    {it.label}
                  </span>
                  {it.sub && (
                    <span className="block text-[11px] truncate" style={{ color: C.muted }}>{it.sub}</span>
                  )}
                </span>
                {active && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0" style={{ color: C.green }}>
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DefaultIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19 8v6M22 11h-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
