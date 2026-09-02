import { C } from "../data";

export default function JurnalPage() {
  return (
    <div className="min-h-dvh" style={{ background: C.mist, color: C.ink }}>
      <div className="max-w-3xl mx-auto px-4 py-7 sm:py-10 pb-28">
        <header className="text-center">
          <h1
            className="text-xl sm:text-2xl font-semibold"
            style={{ color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Daily Jurnal
          </h1>
        </header>

        <main className="mt-8 flex flex-col items-center text-center gap-3 px-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #8A6A20 0%, " + C.green + " 100%)", boxShadow: "0 4px 14px rgba(28,74,51,0.18)" }}
          >
            <NotebookIcon />
          </div>
          <p className="text-sm max-w-xs" style={{ color: C.muted }}>
            Fitur jurnal harian sedang disiapkan. Nanti guru bisa mencatat catatan harian kelas langsung dari sini.
          </p>
        </main>
      </div>
    </div>
  );
}

function NotebookIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <rect x="4.5" y="3.5" width="15" height="17" rx="2" stroke="#FFF" strokeWidth="1.7" />
      <path d="M8 3.5v17" stroke="#FFF" strokeWidth="1.7" />
      <path d="M11.5 9h5M11.5 12.5h5M11.5 16h3.5" stroke="#FFF" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
