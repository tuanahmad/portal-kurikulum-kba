import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { C, sheetUrl, fileUrl, folderUrl } from "../data";

/** Tombol back — pola pill sekunder yang sama dipakai di seluruh app (leaf bg + border hijau). */
export function BackButton({ to = "/home", label = "Home" }: { to?: string; label?: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-full transition-colors hover:opacity-80"
      style={{ background: C.leaf, color: C.green, border: `1px solid ${C.green}` }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </Link>
  );
}

/** Kartu gradient — pola yang sama dipakai di kartu menu Home, dipakai ulang di halaman level 2.
 *  `to`/`href` buat navigasi URL, `onClick` buat kartu yang cuma ganti state lokal (mis. langkah
 *  drill-down di Instrumen Ilmu) — tetap 1 komponen visual biar konsisten di seluruh app. */
export function AccentCard({
  title,
  desc,
  icon,
  gradient,
  to,
  href,
  onClick,
}: {
  title: string;
  desc?: string;
  icon: ReactNode;
  gradient: string;
  to?: string;
  href?: string;
  onClick?: () => void;
}) {
  const className =
    "group relative overflow-hidden rounded-2xl p-5 flex flex-col justify-between min-h-[152px] text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2";
  const style = { background: gradient, boxShadow: "0 4px 14px rgba(28,74,51,0.14)", "--tw-ring-color": C.gold } as any;

  const inner = (
    <>
      <span
        className="absolute -right-6 -top-6 w-28 h-28 rounded-full transition-transform duration-500 group-hover:scale-125"
        style={{ background: "rgba(255,255,255,0.08)" }}
        aria-hidden="true"
      />
      <span className="relative w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.16)" }}>
        {icon}
      </span>
      <div className="relative mt-4">
        <span className="font-semibold text-white block">{title}</span>
        {desc && (
          <span className="text-xs block mt-1 leading-relaxed" style={{ color: "rgba(255,255,255,0.82)" }}>
            {desc}
          </span>
        )}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className} style={style}>
        {inner}
      </button>
    );
  }
  if (to) {
    return (
      <Link to={to} className={className} style={style}>
        {inner}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} style={style}>
      {inner}
    </a>
  );
}

// Pembatas emas ber-permata — motif dari logo
export function GoldDivider() {
  return (
    <div className="flex items-center gap-2 my-1" aria-hidden="true">
      <span className="flex-1 h-px" style={{ background: C.gold, opacity: 0.55 }} />
      <svg width="10" height="10" viewBox="0 0 10 10">
        <rect x="2" y="2" width="6" height="6" transform="rotate(45 5 5)" fill={C.gold} />
      </svg>
      <span className="flex-1 h-px" style={{ background: C.gold, opacity: 0.55 }} />
    </div>
  );
}

export function TypeBadge({ type }: { type: "g" | "x" }) {
  const isSheet = type === "g";
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wide shrink-0"
      style={{
        background: isSheet ? C.leaf : C.goldSoft,
        color: isSheet ? C.green : "#8A6A20",
      }}
    >
      {isSheet ? "Sheet" : "Excel"}
    </span>
  );
}

export function FileRow({ file }: { file: { id: string; name: string; type: "g" | "x" } }) {
  const url = file.type === "g" ? sheetUrl(file.id) : fileUrl(file.id);
  return (
    <div
      className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl transition-shadow hover:shadow-sm"
      style={{ background: "#FFFFFF", border: `1px solid ${C.line}` }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <svg width="14" height="14" viewBox="0 0 10 10" className="shrink-0">
          <rect x="2" y="2" width="6" height="6" transform="rotate(45 5 5)" fill="none" stroke={C.gold} strokeWidth="1.2" />
        </svg>
        <span className="truncate text-sm" style={{ color: C.ink }}>{file.name}</span>
        <TypeBadge type={file.type} />
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-semibold px-3.5 py-1.5 rounded-full whitespace-nowrap transition-opacity hover:opacity-90"
        style={{ background: C.green, color: "#FFF" }}
      >
        Buka & isi
      </a>
    </div>
  );
}

export function FileList({
  files,
  filter,
}: {
  files: { id: string; name: string; type: "g" | "x" }[];
  filter: string;
}) {
  const shown = files.filter((f) => f.name.toLowerCase().includes(filter));
  if (!shown.length)
    return (
      <p className="text-sm px-1 py-2" style={{ color: C.muted }}>
        {filter ? "Tidak ada dokumen yang cocok dengan pencarian." : "Belum ada file — buka foldernya untuk menambahkan."}
      </p>
    );
  return <div className="space-y-2">{shown.map((f) => <FileRow key={f.id} file={f} />)}</div>;
}

export function Section({ section, filter }: { section: any; filter: string }) {
  const [open, setOpen] = useState(true);
  const count =
    (section.files?.length || 0) +
    (section.groups?.reduce((n: number, g: any) => n + g.files.length, 0) || 0);

  return (
    <section
      className="rounded-2xl overflow-hidden"
      style={{ background: "#FFFFFF", border: `1px solid ${C.line}`, boxShadow: "0 1px 2px rgba(28,74,51,0.05)" }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 text-left"
        style={{ background: C.green }}
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
            style={{ background: "rgba(255,255,255,0.12)", color: C.gold, fontFamily: "Georgia, serif" }}
          >
            {section.no}
          </span>
          <div className="min-w-0">
            <div className="font-semibold truncate text-white">{section.name}</div>
            <div className="text-xs truncate" style={{ color: "rgba(255,255,255,0.72)" }}>{section.desc}</div>
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-xs" style={{ color: C.gold }}>{count} file</span>
          <svg width="14" height="14" viewBox="0 0 24 24" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>
            <path d="M6 9l6 6 6-6" fill="none" stroke="#FFF" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="p-3.5 sm:p-4 space-y-4" style={{ background: C.mist }}>
          {section.files && <FileList files={section.files} filter={filter} />}
          {section.groups?.map((g: any) => (
            <div key={g.folderId}>
              <div className="flex items-center justify-between px-1 pb-2">
                <span className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: C.green }}>{g.name}</span>
                <a href={folderUrl(g.folderId)} target="_blank" rel="noopener noreferrer" className="text-xs underline" style={{ color: C.muted }}>
                  Buka folder
                </a>
              </div>
              <FileList files={g.files} filter={filter} />
            </div>
          ))}
          <a
            href={folderUrl(section.folderId)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs underline px-1"
            style={{ color: C.muted }}
          >
            Buka folder «{section.name}» di Drive →
          </a>
        </div>
      )}
    </section>
  );
}
