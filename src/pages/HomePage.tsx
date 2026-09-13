import { Link } from "react-router-dom";
import { C, getGreeting } from "../data";
import { useAuth } from "../contexts/AuthContext";

export default function HomePage() {
  const { role, kelas, fullName } = useAuth();
  const displayName = fullName || kelas || (role === "management" ? "Management" : "");

  return (
    <div className="min-h-dvh" style={{ background: C.mist, color: C.ink }}>

      {/* Hero foto — full width, parallax di layar besar (md ke atas), scroll biasa di mobile */}
      <div className="relative h-[26rem] sm:h-[30rem] md:h-[34rem] overflow-hidden">
        <div
          className="absolute inset-0 bg-center bg-cover bg-scroll md:bg-fixed"
          style={{ backgroundImage: "url(/images/hero-banner.jpg)" }}
          aria-hidden="true"
        />
        <div className="absolute inset-0" style={{ background: "rgba(20, 40, 30, 0.58)" }} aria-hidden="true" />

        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-5 sm:px-8">
          <h1
            className="text-2xl sm:text-3xl md:text-4xl font-semibold text-white max-w-xl"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Portal Guru
            <span className="block text-lg sm:text-xl md:text-2xl mt-1" style={{ color: C.gold }}>
              Kuttab Budi Ashari
            </span>
          </h1>

          <div className="flex items-center justify-center gap-2 my-4 sm:my-5" aria-hidden="true">
            <span className="w-10 h-px" style={{ background: C.gold, opacity: 0.7 }} />
            <svg width="8" height="8" viewBox="0 0 10 10">
              <rect x="2" y="2" width="6" height="6" transform="rotate(45 5 5)" fill={C.gold} />
            </svg>
            <span className="w-10 h-px" style={{ background: C.gold, opacity: 0.7 }} />
          </div>

          <p className="text-sm sm:text-base italic max-w-md text-white/90 leading-relaxed">
            "Perjalanan panjang peradaban tidak pernah terlepas dari peran penting pendidikan.
            Dan Islam telah mencontohkan tentang arah yang senantiasa harus dipetakan."
          </p>

          <p className="text-xs sm:text-sm mt-5 max-w-sm leading-relaxed" style={{ color: C.gold }}>
            Selamat berkarya wahai Guru, semoga jejak yang abadi di sini senantiasa Allah ridhai.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-7 sm:pt-10 pb-28">
        <p className="text-sm text-center max-w-md mx-auto" style={{ color: C.muted }}>
          {getGreeting()}{displayName ? `, ${displayName}` : ""}. Pilih menu di bawah untuk melanjutkan.
        </p>

        <div className="mt-8 mb-3 px-1">
          <h2 className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: C.green }}>
            Menu Utama
          </h2>
        </div>

        {role === "guru" ? <GuruMenu /> : role === "olahraga" ? <OlahragaMenu /> : <ManagementMenu />}

        <footer className="mt-10 text-center text-xs" style={{ color: C.muted }}>
          <p className="font-semibold" style={{ color: C.green }}>Kuttab Budi Ashari</p>
        </footer>
      </div>
    </div>
  );
}

/** Menu guru — 5 fitur untuk kelasnya sendiri (Rencana & Refleksi digabung jadi satu). */
function GuruMenu() {
  return (
    <main className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
      <HomeCard
        to="/instrumen"
        title="Instrumen Ilmu"
        desc="Modul, target, dan panduan pengajaran sebagai acuan guru."
        gradient={`linear-gradient(135deg, ${C.green} 0%, ${C.greenDeep} 100%)`}
        icon={<BookIcon />}
      />
      <HomeCard
        to="/rpb"
        title="Rencana & Refleksi"
        desc="Isi RPB bulanan dan refleksi, lalu centang kalau sudah selesai."
        gradient="linear-gradient(135deg, #C79A3B 0%, #8A6A20 100%)"
        icon={<DocIcon />}
      />
      <HomeCard
        to="/capaian"
        title="Capaian Santri"
        desc="Capaian ilmu & Al-Qur'an santri di kelasmu."
        gradient={`linear-gradient(135deg, ${C.green} 0%, ${C.gold} 100%)`}
        icon={<ChartIcon />}
      />
      <HomeCard
        to="/absen"
        title="Absen Guru"
        desc="Isi kehadiran harian."
        gradient={`linear-gradient(135deg, ${C.greenDeep} 0%, ${C.gold} 100%)`}
        icon={<CalendarCheckIcon />}
      />
      <HomeCard
        to="/jurnal"
        title="Daily Jurnal"
        desc="Catatan harian kelas."
        gradient={`linear-gradient(135deg, #8A6A20 0%, ${C.green} 100%)`}
        icon={<NotebookIcon />}
      />
    </main>
  );
}

/** Menu management — gambaran umum, belum spesifik ke satu kelas. */
function ManagementMenu() {
  return (
    <main className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
      <HomeCard
        to="/instrumen"
        title="Instrumen Ilmu"
        desc="Modul, target, dan panduan pengajaran sebagai acuan guru."
        gradient={`linear-gradient(135deg, ${C.green} 0%, ${C.greenDeep} 100%)`}
        icon={<BookIcon />}
      />
      <HomeCard
        to="/rpb"
        title="Rekap Rencana & Refleksi"
        desc="Lihat progres pengisian RPB & refleksi seluruh guru."
        gradient="linear-gradient(135deg, #C79A3B 0%, #8A6A20 100%)"
        icon={<DocIcon />}
      />
      <HomeCard
        to="/capaian"
        title="Capaian Santri"
        desc="Pilih kelas untuk lihat capaian ilmu & Al-Qur'an."
        gradient={`linear-gradient(135deg, ${C.green} 0%, ${C.gold} 100%)`}
        icon={<ChartIcon />}
      />
      <HomeCard
        to="/absen"
        title="Rekap Absen Guru"
        desc="Pilih kelas untuk lihat kehadiran guru per pekan."
        gradient={`linear-gradient(135deg, ${C.greenDeep} 0%, ${C.gold} 100%)`}
        icon={<CalendarCheckIcon />}
      />
      <HomeCard
        to="/jurnal"
        title="Rekap Daily Jurnal"
        desc="Pilih kelas untuk lihat jurnal harian guru per pekan."
        gradient={`linear-gradient(135deg, #8A6A20 0%, ${C.green} 100%)`}
        icon={<NotebookIcon />}
      />
      <HomeCard
        to="/olahraga/rencana"
        title="Rekap Olahraga"
        desc="Rencana, evaluasi & absen olahraga Kuttab Awwal 1–3 (ikhwan & akhwat)."
        gradient={`linear-gradient(135deg, ${C.green} 0%, ${C.gold} 100%)`}
        icon={<ChartIcon />}
      />
    </main>
  );
}

/** Menu guru olahraga — 3 kartu terpisah (rencana, evaluasi, absen). */
function OlahragaMenu() {
  return (
    <main className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
      <HomeCard
        to="/olahraga/rencana"
        title="Rencana Kegiatan Olahraga"
        desc="Isi rencana kegiatan olahraga Kuttab Awwal 1–3, per pekan tiap bulan."
        gradient={`linear-gradient(135deg, ${C.greenDeep} 0%, ${C.gold} 100%)`}
        icon={<CalendarCheckIcon />}
      />
      <HomeCard
        to="/olahraga/evaluasi"
        title="Evaluasi Kegiatan Olahraga"
        desc="Isi evaluasi kegiatan olahraga tiap bulan."
        gradient={`linear-gradient(135deg, ${C.green} 0%, ${C.greenDeep} 100%)`}
        icon={<ChartIcon />}
      />
      <HomeCard
        to="/olahraga/absen"
        title="Absen"
        desc="Absen kedatangan Senin, Selasa & Rabu."
        gradient="linear-gradient(135deg, #C79A3B 0%, #8A6A20 100%)"
        icon={<NotebookIcon />}
      />
    </main>
  );
}

function HomeCard({
  to,
  title,
  desc,
  gradient,
  icon,
}: {
  to: string;
  title: string;
  desc: string;
  gradient: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-2xl p-5 flex flex-col justify-between min-h-[172px] transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2"
      style={{ background: gradient, boxShadow: "0 4px 14px rgba(28,74,51,0.14)", "--tw-ring-color": C.gold } as any}
    >
      {/* dekorasi lingkaran samar, membesar pas di-hover */}
      <span
        className="absolute -right-6 -top-6 w-28 h-28 rounded-full transition-transform duration-500 group-hover:scale-125"
        style={{ background: "rgba(255,255,255,0.08)" }}
        aria-hidden="true"
      />
      <span
        className="relative w-11 h-11 rounded-xl flex items-center justify-center"
        style={{ background: "rgba(255,255,255,0.16)" }}
      >
        {icon}
      </span>
      <div className="relative mt-4">
        <span className="font-semibold text-white block">{title}</span>
        <span className="text-xs block mt-1 leading-relaxed" style={{ color: "rgba(255,255,255,0.82)" }}>
          {desc}
        </span>
      </div>
    </Link>
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

function DocIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" stroke="#FFF" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M14 3.5V8h4" stroke="#FFF" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8 12.5h8M8 16h5.5" stroke="#FFF" strokeWidth="1.7" strokeLinecap="round" />
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

function CalendarCheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="#FFF" strokeWidth="1.7" />
      <path d="M3.5 9.5h17" stroke="#FFF" strokeWidth="1.7" />
      <path d="M8 3v3.5M16 3v3.5" stroke="#FFF" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8.5 14.5l2 2 4.5-4.5" stroke="#FFF" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NotebookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="4.5" y="3.5" width="15" height="17" rx="2" stroke="#FFF" strokeWidth="1.7" />
      <path d="M8 3.5v17" stroke="#FFF" strokeWidth="1.7" />
      <path d="M11.5 9h5M11.5 12.5h5M11.5 16h3.5" stroke="#FFF" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
