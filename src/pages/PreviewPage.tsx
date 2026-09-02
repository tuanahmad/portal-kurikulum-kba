import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { C, previewUrl } from "../data";

/** Halaman "pembaca dokumen" full-screen di dalam app — isinya embed Drive, tapi
 *  header/URL/back tetap punya app kita, bukan pindah ke drive.google.com. Back & judul
 *  jadi 2 bubble melayang terpisah (bukan bar solid) biar PDF-nya dapet tinggi penuh. */
export default function PreviewPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const id = params.get("id");
  const name = params.get("name") || "Dokumen";
  const section = params.get("section");
  const [loaded, setLoaded] = useState(false);

  if (!id) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: C.mist }}>
        <p className="text-sm" style={{ color: C.muted }}>File tidak ditemukan.</p>
      </div>
    );
  }

  return (
    <div className="h-dvh relative" style={{ background: C.mist }}>
      <button
        onClick={() => navigate(-1)}
        aria-label="Kembali"
        className="fixed top-3 left-6 sm:top-4 sm:left-8 z-20 w-10 h-10 rounded-xl flex items-center justify-center backdrop-blur-md transition-shadow hover:shadow-md"
        style={{
          background: "rgba(255,255,255,0.45)",
          border: "1px solid rgba(255,255,255,0.6)",
          color: C.green,
          boxShadow: "0 1px 4px rgba(28,74,51,0.10)",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div
        className="fixed top-3 sm:top-4 left-1/2 -translate-x-1/2 z-20 h-10 flex flex-col items-center justify-center px-5 max-w-[70vw] rounded-xl backdrop-blur-md text-center"
        style={{
          background: "rgba(255,255,255,0.75)",
          border: "1px solid rgba(255,255,255,0.6)",
          boxShadow: "0 4px 14px rgba(28,74,51,0.16)",
        }}
      >
        <span className="text-xs font-semibold truncate leading-tight" style={{ color: C.ink }}>
          {name}
        </span>
        {section && (
          <span className="text-[9px] truncate leading-tight" style={{ color: C.muted }}>
            {section}
          </span>
        )}
      </div>

      {!loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10" style={{ background: C.mist }}>
          <div
            className="w-8 h-8 rounded-full animate-spin"
            style={{ border: `3px solid ${C.line}`, borderTopColor: C.green }}
            aria-hidden="true"
          />
          <p className="text-sm" style={{ color: C.muted }}>
            Memuat dokumen…
          </p>
        </div>
      )}

      <iframe
        src={previewUrl(id)}
        title={name}
        className="w-full h-full border-0"
        allow="autoplay"
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
