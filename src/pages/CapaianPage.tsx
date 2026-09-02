import { useState } from "react";
import { C, KELAS_LIST, sheetUrl } from "../data";
import { AccentCard } from "../components/PortalComponents";
import { useAuth } from "../contexts/AuthContext";

export default function CapaianPage() {
  const { role, kelas: myKelas } = useAuth();

  if (role === "guru") {
    return <GuruCapaian kelasName={myKelas} />;
  }
  return <ManagementCapaian />;
}

/* ————————————————————— Guru: langsung kelasnya sendiri ————————————————————— */

function GuruCapaian({ kelasName }: { kelasName: string | null }) {
  const kelas = KELAS_LIST.find((k) => k.name === kelasName) || null;

  return (
    <div className="min-h-dvh" style={{ background: C.mist, color: C.ink }}>
      <div className="max-w-3xl mx-auto px-4 py-7 sm:py-10 pb-28">
        <header className="text-center">
          <h1
            className="text-xl sm:text-2xl font-semibold"
            style={{ color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Capaian Santri
          </h1>
          <p className="text-sm mt-2 max-w-md mx-auto" style={{ color: C.muted }}>
            {kelasName || "Kelasmu"}
          </p>
        </header>

        {kelas ? (
          <CapaianLinks kelas={kelas} />
        ) : (
          <p className="text-sm text-center mt-8" style={{ color: C.muted }}>
            Kelas belum diset untuk akun ini — hubungi koordinator kurikulum.
          </p>
        )}
      </div>
    </div>
  );
}

/* ————————————————————— Management: pilih dari 12 kelas ————————————————————— */

function ManagementCapaian() {
  const [selected, setSelected] = useState<string | null>(null);
  const kelas = KELAS_LIST.find((k) => k.name === selected) || null;

  return (
    <div className="min-h-dvh" style={{ background: C.mist, color: C.ink }}>
      <div className="max-w-3xl mx-auto px-4 py-7 sm:py-10 pb-28">
        <header className="text-center">
          <h1
            className="text-xl sm:text-2xl font-semibold"
            style={{ color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Capaian Santri
          </h1>
          <p className="text-sm mt-2 max-w-md mx-auto" style={{ color: C.muted }}>
            Pilih kelas untuk melihat Capaian Ilmu dan Capaian Al-Qur'an.
          </p>
        </header>

        {/* Grid 12 kelas */}
        <main className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {KELAS_LIST.map((k) => {
            const active = k.name === selected;
            return (
              <button
                key={k.name}
                onClick={() => setSelected(active ? null : k.name)}
                className="text-sm font-medium px-3 py-3 rounded-xl text-center transition-colors"
                style={{
                  background: active ? C.green : "#FFF",
                  color: active ? "#FFF" : C.ink,
                  border: `1px solid ${active ? C.green : C.line}`,
                }}
              >
                {k.name}
              </button>
            );
          })}
        </main>

        {kelas && <CapaianLinks kelas={kelas} />}
      </div>
    </div>
  );
}

/* ————————————————————— Dipakai bareng ————————————————————— */

function CapaianLinks({ kelas }: { kelas: { ilmuId: string; quranId: string } }) {
  return (
    <main className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
      <AccentCard
        title="Capaian Ilmu"
        desc="Sifatnya deskriptif · Diisi tiap tanggal 30"
        icon={<BookIcon />}
        gradient={`linear-gradient(135deg, ${C.green} 0%, ${C.greenDeep} 100%)`}
        href={sheetUrl(kelas.ilmuId)}
      />
      <AccentCard
        title="Capaian Al-Qur'an"
        desc="Sifatnya angka · Diisi tiap Jum'at"
        icon={<ChartIcon />}
        gradient="linear-gradient(135deg, #C79A3B 0%, #8A6A20 100%)"
        href={sheetUrl(kelas.quranId)}
      />
    </main>
  );
}

function BookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M4 5.5c2-1 5-1 8 .5 3-1.5 6-1.5 8-.5v13c-2-1-5-1-8 .5-3-1.5-6-1.5-8-.5v-13Z" stroke="#FFF" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M12 6v13" stroke="#FFF" strokeWidth="1.7" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M4 20V10M11 20V4M18 20v-7" stroke="#FFF" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M3 20h18" stroke="#FFF" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
