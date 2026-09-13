import { useState } from "react";
import { C, KELAS_LIST } from "../data";
import { AccentCard } from "../components/PortalComponents";
import { PickerCard } from "../components/PickerCard";
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
      <div className="max-w-3xl mx-auto px-4 pt-7 sm:pt-10 pb-28">
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
          <CapaianLinks kelas={kelas} kelasName={kelas.name} guru />
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
  const [selectedI, setSelectedI] = useState<number | null>(null);
  const kelas = selectedI != null ? KELAS_LIST[selectedI] : null;

  return (
    <div className="min-h-dvh" style={{ background: C.mist, color: C.ink }}>
      <div className="max-w-3xl mx-auto px-4 pt-7 sm:pt-10 pb-28">
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

        <div className="mt-6">
          <PickerCard
            items={KELAS_LIST.map((k) => ({ label: k.name }))}
            value={selectedI}
            onChange={setSelectedI}
            placeholderLabel="Pilih kelas"
            selectedLabel="Kelas"
            countText={`${KELAS_LIST.length} kelas`}
            numbered={false}
          />
        </div>

        {kelas && <CapaianLinks kelas={kelas} kelasName={kelas.name} />}
      </div>
    </div>
  );
}

/* ————————————————————— Dipakai bareng ————————————————————— */

function CapaianLinks({
  kelas,
  kelasName,
  guru,
}: {
  kelas: { ilmuId: string; quranId: string };
  kelasName: string;
  guru?: boolean;
}) {
  const diagramTo = guru
    ? "/capaian/quran/diagram"
    : `/capaian/quran/diagram?kelas=${encodeURIComponent(kelasName)}`;
  const ilmuTo = guru ? "/capaian/ilmu" : `/capaian/ilmu?kelas=${encodeURIComponent(kelasName)}`;
  const quranTo = guru ? "/capaian/quran" : `/capaian/quran?kelas=${encodeURIComponent(kelasName)}`;
  return (
    <main className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
      <AccentCard
        title="Capaian Ilmu"
        desc={guru ? "Isi langsung di app · per santri tiap bulan" : "Sifatnya deskriptif · Diisi tiap tanggal 30"}
        icon={<BookIcon />}
        gradient={`linear-gradient(135deg, ${C.green} 0%, ${C.greenDeep} 100%)`}
        to={ilmuTo}
      />
      <AccentCard
        title="Capaian Al-Qur'an"
        desc={guru ? "Isi langsung di app · per pertemuan" : "Sifatnya angka · Diisi tiap Jum'at"}
        icon={<ChartIcon />}
        gradient="linear-gradient(135deg, #C79A3B 0%, #8A6A20 100%)"
        to={quranTo}
      />
      <AccentCard
        title="Diagram Perkembangan"
        desc="Grafik capaian Al-Qur'an tiap anak per pekan"
        icon={<TrendIcon />}
        gradient={`linear-gradient(135deg, #3B6EA5 0%, #274C74 100%)`}
        to={diagramTo}
      />
    </main>
  );
}

function TrendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M4 17l5-6 4 3 6-8" stroke="#FFF" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 6h5v5" stroke="#FFF" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
