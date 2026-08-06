import { Link } from "react-router-dom";
import { C, LOGO, INSTRUMEN_FOLDERS, folderUrl } from "../data";
import { GoldDivider } from "../components/PortalComponents";
import { BottomNav } from "../components/BottomNav";

export default function InstrumenPage() {
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
            Instrumen Ilmu
          </h1>
          <p className="text-sm mt-2 max-w-md mx-auto" style={{ color: C.muted }}>
            Acuan guru dalam proses pembelajaran — modul, target, dan panduan pengajaran.
            Bisa dibaca & didownload; pembaruan file dilakukan tim management lewat Google Drive.
          </p>
        </header>

        <main className="mt-6 space-y-3">
          {INSTRUMEN_FOLDERS.map((f) =>
            f.folderId ? (
              <a
                key={f.key}
                href={folderUrl(f.folderId)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 rounded-2xl p-4 sm:p-5 transition-shadow hover:shadow-md"
                style={{ background: "#FFF", border: `1px solid ${C.line}` }}
              >
                <div>
                  <div className="font-semibold" style={{ color: C.green }}>{f.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: C.muted }}>Folder PDF di Google Drive</div>
                </div>
                <span
                  className="text-xs font-semibold px-3.5 py-1.5 rounded-full whitespace-nowrap shrink-0"
                  style={{ background: C.green, color: "#FFF" }}
                >
                  Buka folder →
                </span>
              </a>
            ) : (
              <div
                key={f.key}
                className="flex items-center justify-between gap-3 rounded-2xl p-4 sm:p-5"
                style={{ background: "#FFF", border: `1px solid ${C.line}` }}
              >
                <div>
                  <div className="font-semibold" style={{ color: C.green }}>{f.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: C.muted }}>Folder belum tersedia</div>
                </div>
                <span
                  className="text-xs font-semibold px-3.5 py-1.5 rounded-full whitespace-nowrap shrink-0"
                  style={{ background: C.leaf, color: C.muted }}
                >
                  Segera hadir
                </span>
              </div>
            )
          )}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
