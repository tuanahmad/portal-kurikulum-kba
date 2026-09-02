import { C } from "../data";

export default function AbsenPage() {
  return (
    <div className="min-h-dvh" style={{ background: C.mist, color: C.ink }}>
      <div className="max-w-3xl mx-auto px-4 py-7 sm:py-10 pb-28">
        <header className="text-center">
          <h1
            className="text-xl sm:text-2xl font-semibold"
            style={{ color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Absen Guru
          </h1>
        </header>

        <main className="mt-8 flex flex-col items-center text-center gap-3 px-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${C.greenDeep} 0%, ${C.gold} 100%)`, boxShadow: "0 4px 14px rgba(28,74,51,0.18)" }}
          >
            <CalendarCheckIcon />
          </div>
          <p className="text-sm max-w-xs" style={{ color: C.muted }}>
            Fitur absen guru sedang disiapkan. Nanti guru bisa mengisi kehadiran langsung dari sini.
          </p>
        </main>
      </div>
    </div>
  );
}

function CalendarCheckIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="#FFF" strokeWidth="1.7" />
      <path d="M3.5 9.5h17" stroke="#FFF" strokeWidth="1.7" />
      <path d="M8 3v3.5M16 3v3.5" stroke="#FFF" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8.5 14.5l2 2 4.5-4.5" stroke="#FFF" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
