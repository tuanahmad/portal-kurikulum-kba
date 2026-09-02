import { useState } from "react";
import { Link } from "react-router-dom";
import { C } from "../data";
import type { DriveNode } from "../lib/drive";

/** Render daftar file & folder Drive — folder tetap baris expand/collapse, file jadi kartu
 *  gradient (senada dengan kartu di halaman level 2 lain), tanpa tombol terpisah — seluruh
 *  kartu jadi area klik. `section` dilewatkan ke halaman preview biar keliatan asalnya. */
export function DriveTree({ nodes, section, gradient }: { nodes: DriveNode[]; section?: string; gradient: string }) {
  if (!nodes.length) {
    return (
      <p className="text-sm px-1 py-2" style={{ color: C.muted }}>
        Belum ada file di folder ini.
      </p>
    );
  }
  const folders = nodes.filter((n): n is DriveNode & { type: "folder" } => n.type === "folder");
  const files = nodes.filter((n): n is DriveNode & { type: "file" } => n.type === "file");

  return (
    <div className="space-y-3">
      {folders.map((n) => (
        <DriveFolder key={n.id} node={n} section={section} gradient={gradient} />
      ))}
      {files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {files.map((n) => (
            <DriveFile key={n.id} node={n} section={section} gradient={gradient} />
          ))}
        </div>
      )}
    </div>
  );
}

function DriveFolder({
  node,
  section,
  gradient,
}: {
  node: DriveNode & { type: "folder" };
  section?: string;
  gradient: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-black/[0.02]"
        style={{ background: "#FFF" }}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <FolderIcon />
          <span className="text-sm font-medium truncate" style={{ color: C.ink }}>{node.name}</span>
          <span className="text-xs shrink-0" style={{ color: C.muted }}>
            ({node.children.length})
          </span>
        </div>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          className="shrink-0"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}
        >
          <path d="M6 9l6 6 6-6" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="p-2.5" style={{ background: C.mist }}>
          <DriveTree nodes={node.children} section={section} gradient={gradient} />
        </div>
      )}
    </div>
  );
}

function DriveFile({
  node,
  section,
  gradient,
}: {
  node: DriveNode & { type: "file" };
  section?: string;
  gradient: string;
}) {
  const params = new URLSearchParams({ id: node.id, name: node.name });
  if (section) params.set("section", section);

  return (
    <Link
      to={`/preview?${params.toString()}`}
      className="group relative overflow-hidden rounded-2xl p-4 flex flex-col justify-between min-h-[128px] transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2"
      style={{ background: gradient, boxShadow: "0 4px 14px rgba(28,74,51,0.14)", "--tw-ring-color": C.gold } as any}
    >
      <span
        className="absolute -right-5 -top-5 w-20 h-20 rounded-full transition-transform duration-500 group-hover:scale-125"
        style={{ background: "rgba(255,255,255,0.08)" }}
        aria-hidden="true"
      />
      <span
        className="relative w-9 h-9 rounded-lg flex items-center justify-center text-[9px] font-bold shrink-0"
        style={{ background: "rgba(255,255,255,0.18)", color: "#FFF" }}
      >
        <FileTypeLabel mimeType={node.mimeType} />
      </span>
      <span className="relative text-sm font-semibold text-white mt-3 line-clamp-2 leading-snug">{node.name}</span>
    </Link>
  );
}

function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <path
        d="M3.5 6.5a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-11.5Z"
        stroke={C.gold}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FileTypeLabel({ mimeType }: { mimeType: string }) {
  const isPdf = mimeType === "application/pdf";
  const label = isPdf ? "PDF" : mimeType.includes("word") || mimeType.includes("document") ? "DOC" : "FILE";
  return <>{label}</>;
}
