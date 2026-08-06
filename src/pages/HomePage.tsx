import { Link } from "react-router-dom";
import { C, LOGO } from "../data";
import { BottomNav } from "../components/BottomNav";
import { useAuth } from "../contexts/AuthContext";

export default function HomePage() {
  const { session } = useAuth();
  const displayName = session?.user?.email?.split("@")[0] || "";

  return (
    <div className="min-h-screen" style={{ background: C.mist, color: C.ink }}>
      <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${C.green}, ${C.gold}, ${C.green})` }} />

      {/* Hero foto — full width, parallax di layar besar (md ke atas), scroll biasa di mobile */}
      <div className="relative h-[26rem] sm:h-[30rem] md:h-[34rem] overflow-hidden">
        <div
          className="absolute inset-0 bg-center bg-cover bg-scroll md:bg-fixed"
          style={{ backgroundImage: "url(/images/hero-banner.jpg)" }}
          aria-hidden="true"
        />
        <div className="absolute inset-0" style={{ background: "rgba(20, 40, 30, 0.58)" }} aria-hidden="true" />

        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-5 sm:px-8">
          <div className="w-16 sm:w-20 h-16 sm:h-20 rounded-full flex items-center justify-center mb-4" style={{ background: "rgba(255,255,255,0.95)" }}>
            <img src={LOGO} alt="Logo Kuttab Budi Ashari" className="w-11 sm:w-14 h-auto" style={{ mixBlendMode: "multiply" }} />
          </div>
          <h1
            className="text-2xl sm:text-3xl md:text-4xl font-semibold text-white max-w-xl"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Portal Kurikulum
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

      <div className="max-w-3xl mx-auto px-4 py-7 sm:py-10 pb-24">
        <p className="text-sm text-center max-w-md mx-auto" style={{ color: C.muted }}>
          Selamat datang{displayName ? `, ${displayName}` : ""}. Pilih menu di bawah untuk melanjutkan.
        </p>

        {/* 3 Card */}
        <main className="mt-8 grid sm:grid-cols-3 gap-4">
          <HomeCard
            to="/instrumen"
            title="Instrumen Ilmu"
            desc="Modul, target, dan panduan pengajaran sebagai acuan guru."
          />
          <HomeCard
            to="/rpb"
            title="Rencana Pembelajaran Guru"
            desc="Isi RPB bulanan & refleksi, lalu centang kalau sudah selesai."
          />
          <HomeCard
            to="/capaian"
            title="Capaian Santri"
            desc="Pilih kelas untuk lihat capaian ilmu & Al-Qur'an."
          />
        </main>

        <footer className="mt-10 text-center text-xs" style={{ color: C.muted }}>
          <p className="font-semibold" style={{ color: C.green }}>Kuttab Budi Ashari</p>
        </footer>
      </div>

      <BottomNav />
    </div>
  );
}

function HomeCard({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <Link
      to={to}
      className="group rounded-2xl p-5 flex flex-col gap-2 transition-shadow hover:shadow-md"
      style={{ background: "#FFF", border: `1px solid ${C.line}` }}
    >
      <CardIcon />
      <span className="font-semibold" style={{ color: C.green }}>{title}</span>
      <span className="text-sm" style={{ color: C.muted }}>{desc}</span>
      <span className="text-xs font-semibold mt-1" style={{ color: C.gold }}>Buka →</span>
    </Link>
  );
}

function CardIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1.5" fill="none" stroke={C.gold} strokeWidth="1.6" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" fill="none" stroke={C.gold} strokeWidth="1.6" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" fill="none" stroke={C.gold} strokeWidth="1.6" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" fill="none" stroke={C.gold} strokeWidth="1.6" />
    </svg>
  );
}
