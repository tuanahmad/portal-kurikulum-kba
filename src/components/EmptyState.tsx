import type { ReactNode } from "react";
import { C } from "../data";

const IKON: Record<string, ReactNode> = {
  buku: <path d="M4 5.5c2-1 5-1 8 .5 3-1.5 6-1.5 8-.5v13c-2-1-5-1-8 .5-3-1.5-6-1.5-8-.5v-13ZM12 6v13" />,
  jurnal: <path d="M7 3.5h10a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1ZM9.5 8h5M9.5 12h5M9.5 16h3" />,
  folder: <path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4l2 2.5h8a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18V7Z" />,
  grafik: <path d="M5 20V10M12 20V4M19 20v-7" />,
  santri: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0" />,
};

/** Tampilan kosong yang ramah: ikon kecil, judul pendek, dan petunjuk langkah berikutnya. */
export function EmptyState({
  ikon = "buku",
  judul,
  petunjuk,
  padat = false,
}: {
  ikon?: keyof typeof IKON;
  judul: string;
  petunjuk?: string;
  padat?: boolean;
}) {
  return (
    <div className={`rounded-2xl text-center ${padat ? "px-4 py-5" : "px-5 py-8"}`} style={{ background: "#FFF", border: `1px dashed ${C.line}` }}>
      <span className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: C.leaf, color: C.green }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {IKON[ikon]}
        </svg>
      </span>
      <div className="mt-3 text-sm font-semibold" style={{ color: C.ink }}>{judul}</div>
      {petunjuk && <p className="mt-1 text-xs leading-relaxed" style={{ color: C.muted }}>{petunjuk}</p>}
    </div>
  );
}
