import { Link } from "react-router-dom";
import { C } from "../data";
import type { DriveNode } from "../lib/drive";

/** Render daftar file & folder Drive — folder cuma jadi label bagian (isinya langsung kebuka,
 *  gak ada tombol expand/collapse lagi), file jadi kartu gradient (senada dengan kartu di
 *  halaman level 2 lain) yang langsung buka filenya. `section` dilewatkan ke halaman preview
 *  biar keliatan asalnya. */
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
    <div className="space-y-4">
      {files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {files.map((n) => (
            <DriveFile key={n.id} node={n} section={section} gradient={gradient} />
          ))}
        </div>
      )}
      {folders.map((n) => (
        <DriveFolderSection key={n.id} node={n} section={section} gradient={gradient} />
      ))}
    </div>
  );
}

/** Sub-folder = label bagian doang, isinya (file & sub-sub-folder) langsung dirender di
 *  bawahnya — gak perlu diklik buat dibuka. */
function DriveFolderSection({
  node,
  section,
  gradient,
}: {
  node: DriveNode & { type: "folder" };
  section?: string;
  gradient: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5 px-1">
        <FolderIcon />
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: C.muted }}>{node.name}</span>
      </div>
      <DriveTree nodes={node.children} section={section} gradient={gradient} />
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
