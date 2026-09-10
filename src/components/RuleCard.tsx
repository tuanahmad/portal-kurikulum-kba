import { useState, type ReactNode } from "react";
import { C } from "../data";

/**
 * Kartu "peraturan / panduan" — dipakai di Jurnal & Absen.
 * Header bergradasi + ikon bulat (senada kartu menu), isi berupa langkah bernomor
 * dalam pill lembut. Bisa dilipat.
 */
export function RuleCard({
  title,
  rules,
  icon,
  defaultOpen = true,
}: {
  title: string;
  rules: string[];
  icon: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className="mt-4 rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${C.line}`, background: "#FFF", boxShadow: "0 4px 14px rgba(28,74,51,0.06)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        style={{ background: `linear-gradient(135deg, ${C.green} 0%, ${C.greenDeep} 100%)` }}
      >
        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(255,255,255,0.16)", color: "#FFF" }}
        >
          {icon}
        </span>
        <span className="flex-1 text-sm font-semibold text-white">{title}</span>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          className="shrink-0 transition-transform"
          style={{ color: "rgba(255,255,255,0.9)", transform: open ? "rotate(180deg)" : "none" }}
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ol className="p-3 space-y-2">
          {rules.map((r, i) => (
            <li
              key={i}
              className="flex gap-3 items-start rounded-xl px-3 py-2.5"
              style={{ background: C.mist }}
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold mt-0.5"
                style={{ background: C.green, color: "#FFF" }}
              >
                {i + 1}
              </span>
              <span className="text-xs leading-relaxed" style={{ color: C.ink }}>{r}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
