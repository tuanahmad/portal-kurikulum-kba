import { lembut } from "../lib/warna";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { C, getGreeting, KELAS_LIST } from "../data";
import { useAuth } from "../contexts/AuthContext";
import { readTodayStatus, readStatusGuru, readStatusOlahraga, type TodayStatus, type StatusGuruHariIni, type StatusOlahraga } from "../lib/dashboardStatus";
import { labelHari, labelTanggal } from "../lib/jurnal";
import {
  NotebookIcon as NotebookIconOutline,
  CalendarCheckIcon as CalendarCheckIconOutline,
  BookIcon as BookIconOutline,
  DocIcon as DocIconOutline,
} from "../components/navIcons";
import { KartuGeser, type SlideKartu, type Nada } from "../components/KartuGeser";

export default function HomePage() {
  const { role, kelas, fullName } = useAuth();
  const displayName = fullName || kelas || (role === "management" ? "Management" : "");

  return (
    <div className="min-h-dvh" style={{ background: C.mist, color: C.ink }}>

      {/* Hero foto — full width, parallax di layar besar (md ke atas), scroll biasa di mobile */}
      <div className="relative h-[26rem] sm:h-[30rem] md:h-[34rem] overflow-hidden" style={{ background: "#1B3327 url(/images/hero-banner.jpg) center / cover no-repeat" }}>
        {/* Parallax (HP & layar besar): lapisan foto menempel ke layar (fixed) lalu dipotong seukuran hero (clip-path).
            Sedikit melebar ke kiri-kanan supaya tidak ada garis celah di tepi (yang muncul pada background-attachment: fixed). */}
        <div className="absolute inset-0" style={{ clipPath: "inset(0)" }} aria-hidden="true">
          <div
            className="fixed top-0 -left-8 -right-8 h-[26rem] sm:h-[30rem] md:h-[34rem]"
            style={{ backgroundImage: "url(/images/hero-banner.jpg)", backgroundSize: "cover", backgroundPosition: "center" }}
          />
        </div>
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
    <main>
    <GuruHariIni />
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
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
        gradient={`linear-gradient(135deg, #2F8A63 0%, #1F6244 100%)`}
        icon={<ChartIcon />}
      />
      <HomeCard
        to="/absen"
        title="Absen Guru"
        desc="Isi kehadiran harian."
        gradient={`linear-gradient(135deg, #E3A744 0%, #C98A25 100%)`}
        icon={<DocIcon />}
      />
      <HomeCard
        to="/jurnal"
        title="Daily Jurnal"
        desc="Catatan harian kelas."
        gradient={`linear-gradient(135deg, #2F8F83 0%, #1C5A52 100%)`}
        icon={<NotebookIcon />}
      />
    </div>
    </main>
  );
}

type HariIniState = "selesai" | "belum" | "sebagian" | "libur";

const CHIP: Record<HariIniState, { bg: string; fg: string; teks: string }> = {
  selesai: { bg: C.leaf, fg: C.green, teks: "Sudah" },
  sebagian: { bg: "#FFF1D6", fg: "#8A6A20", teks: "Sebagian" },
  belum: { bg: "#FFDCD5", fg: "#9F240B", teks: "Belum" },
  libur: { bg: "#F4F1EC", fg: C.muted, teks: "Libur" },
};

function SantriIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="16.5" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M15.5 14.2c2.6-.3 4.5 1.3 5 4.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/** Kartu "Hari Ini" untuk GURU: apa yang sudah/belum diisi hari ini, tiap baris bisa diketuk ke halamannya.
 *  Sabtu/Ahad: Jurnal & Absen ditandai libur (tidak dihitung). */
function GuruHariIni() {
  const { session, kelas } = useAuth();
  const uid = session?.user?.id;
  const [s, setS] = useState<StatusGuruHariIni | null>(null);

  useEffect(() => {
    if (!uid || !kelas) return;
    let cancelled = false;
    readStatusGuru(uid, kelas)
      .then((r) => !cancelled && setS(r))
      .catch(() => !cancelled && setS({ jurnal: null, absen: null, absenSantri: null, quran: null, rencana: null, targetQuran: null }));
    return () => {
      cancelled = true;
    };
  }, [uid, kelas]);

  const now = new Date();
  const libur = now.getDay() === 0 || now.getDay() === 6;

  if (!s) {
    return <div className="mb-5 rounded-2xl animate-pulse" style={{ background: "#FFF", border: `1px solid ${C.line}`, height: 196 }} />;
  }

  const rows: { key: string; label: string; sub: string; to: string; state: HariIniState | null; icon: React.ReactNode }[] = [
    {
      key: "jurnal",
      label: "Jurnal harian",
      sub: libur ? "Libur akhir pekan" : s.jurnal ? "Sudah diisi hari ini" : "Belum diisi hari ini",
      to: "/jurnal",
      state: libur ? "libur" : s.jurnal == null ? null : s.jurnal ? "selesai" : "belum",
      icon: <NotebookIconOutline />,
    },
    {
      key: "absen",
      label: "Absen guru",
      sub: libur ? "Libur akhir pekan" : s.absen === "lengkap" ? "Pagi dan siang sudah" : s.absen === "sebagian" ? "Baru satu sesi" : "Belum diisi hari ini",
      to: "/absen",
      state: libur ? "libur" : s.absen == null ? null : s.absen === "lengkap" ? "selesai" : s.absen === "sebagian" ? "sebagian" : "belum",
      icon: <CalendarCheckIconOutline />,
    },
    {
      key: "absenSantri",
      label: "Absen santri",
      sub: libur
        ? "Libur akhir pekan"
        : s.absenSantri === "lengkap"
          ? "Semua santri sudah diabsen"
          : s.absenSantri === "sebagian"
            ? "Sebagian santri belum diabsen"
            : "Belum diisi hari ini",
      to: "/absen?tab=santri",
      state: libur ? "libur" : s.absenSantri == null ? null : s.absenSantri === "lengkap" ? "selesai" : s.absenSantri === "sebagian" ? "sebagian" : "belum",
      icon: <SantriIcon />,
    },
    {
      key: "quran",
      label: "Capaian Al-Qur'an",
      sub: s.quran ? "Pekan ini sudah ada isian" : "Pekan ini belum ada isian",
      to: "/capaian/quran",
      state: s.quran == null ? null : s.quran ? "selesai" : "belum",
      icon: <BookIconOutline />,
    },
    {
      key: "targetQuran",
      label: "Target Al-Qur'an (RPB)",
      sub: !s.targetQuran
        ? ""
        : s.targetQuran.terisi >= s.targetQuran.total
          ? `Angka target ${s.targetQuran.bulan} sudah lengkap`
          : `Angka target ${s.targetQuran.bulan}: ${s.targetQuran.terisi} dari ${s.targetQuran.total} santri`,
      to: "/rpb",
      state: !s.targetQuran ? null : s.targetQuran.terisi >= s.targetQuran.total ? "selesai" : s.targetQuran.terisi > 0 ? "sebagian" : "belum",
      icon: <BookIconOutline />,
    },
    // RPB & Refleksi bulanan: hanya muncul tanggal 1-5 (s.rencana null di tanggal lain)
    {
      key: "rencana",
      label: "Rencana & Refleksi",
      sub: !s.rencana
        ? ""
        : [
            s.rencana.rpb === null ? null : `RPB ${s.rencana.bulanRpb} ${s.rencana.rpb ? "sudah" : "belum"}`,
            s.rencana.ref === null ? null : `Refleksi ${s.rencana.bulanRef} ${s.rencana.ref ? "sudah" : "belum"}`,
          ]
            .filter(Boolean)
            .join(", "),
      to: "/rpb",
      state: !s.rencana
        ? null
        : (() => {
            const v = [s.rencana.rpb, s.rencana.ref].filter((x): x is boolean => x !== null);
            return v.length === 0 ? null : v.every(Boolean) ? "selesai" : v.some(Boolean) ? "sebagian" : "belum";
          })(),
      icon: <DocIconOutline />,
    },
  ];
  // Satu kartu per kelompok: Hari ini / Al-Qur'an (pekan ini) / Bulan ini (RPB & Refleksi, hanya tanggal 1-5).
  const kelompok = (keys: string[]) => rows.filter((r) => keys.includes(r.key) && r.state !== null);
  const nadaDari = (it: { state: HariIniState | null }[]): "selesai" | "sebagian" | "belum" => {
    const dihitung = it.filter((x) => x.state && x.state !== "libur");
    const selesai = dihitung.filter((x) => x.state === "selesai").length;
    return selesai === dihitung.length ? "selesai" : selesai > 0 || dihitung.some((x) => x.state === "sebagian") ? "sebagian" : "belum";
  };
  const buatSlide = (key: string, judul: string, sub: string | undefined, keys: string[], teks: { selesai: string; sebagian: string; belum: string }): SlideKartu | null => {
    const it = kelompok(keys);
    if (it.length === 0) return null;
    const dihitung = it.filter((x) => x.state !== "libur");
    const selesai = dihitung.filter((x) => x.state === "selesai").length;
    const nada = nadaDari(it);
    const belumPertama = it.find((x) => x.state !== "selesai" && x.state !== "libur");
    return {
      key,
      judul,
      sub,
      utama: teks[nada],
      angka: `${selesai}/${dihitung.length}`,
      nada,
      items: it.map((x) => ({ label: x.label, state: x.state as HariIniState, to: x.to })),
      to: belumPertama?.to ?? it[0].to,
    };
  };
  const slides: SlideKartu[] = [];
  if (libur) {
    slides.push({ key: "hari", judul: "Hari ini", sub: `${labelHari(now)}, ${labelTanggal(now)}`, utama: "Libur. Jurnal dan absen tidak perlu diisi.", nada: "libur" });
  } else {
    const h = buatSlide("hari", "Hari ini", `${labelHari(now)}, ${labelTanggal(now)}`, ["jurnal", "absen", "absenSantri"], {
      selesai: "Semua sudah terisi",
      sebagian: "Masih ada yang belum diisi",
      belum: "Belum ada yang diisi",
    });
    if (h) slides.push(h);
  }
  const q = buatSlide("quran", "Al-Qur'an", "Pekan ini", ["quran", "targetQuran"], {
    selesai: "Capaian dan target sudah lengkap",
    sebagian: "Sebagian belum lengkap",
    belum: "Belum diisi",
  });
  if (q) slides.push(q);
  const b2 = buatSlide("bulan", "Bulan ini", "Rencana & Refleksi", ["rencana"], {
    selesai: "RPB dan Refleksi sudah diisi",
    sebagian: "Salah satunya belum diisi",
    belum: "RPB dan Refleksi belum diisi",
  });
  if (b2) slides.push(b2);

  return <KartuGeser slides={slides} />;
}

/** Menu management — gambaran umum, belum spesifik ke satu kelas. */
function ManagementMenu() {
  return (
    <main>
      <RingkasanHariIni />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
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
        gradient={`linear-gradient(135deg, #2F8A63 0%, #1F6244 100%)`}
        icon={<ChartIcon />}
      />
      <HomeCard
        to="/absen"
        title="Rekap Absen Guru"
        desc="Pilih kelas untuk lihat kehadiran guru per pekan."
        gradient={`linear-gradient(135deg, #E3A744 0%, #C98A25 100%)`}
        icon={<CalendarCheckIcon />}
      />
      <HomeCard
        to="/jurnal"
        title="Rekap Daily Jurnal"
        desc="Pilih kelas untuk lihat jurnal harian guru per pekan."
        gradient={`linear-gradient(135deg, #2F8F83 0%, #1C5A52 100%)`}
        icon={<NotebookIcon />}
      />
      <HomeCard
        to="/olahraga"
        title="Rekap Olahraga"
        desc="Rencana, evaluasi & absen olahraga Kuttab Awwal 1–3 (ikhwan & akhwat)."
        gradient={`linear-gradient(135deg, #2F8A63 0%, #1F6244 100%)`}
        icon={<ChartIcon />}
      />
      </div>
    </main>
  );
}

const ALL_KELAS_NAMES = KELAS_LIST.map((k) => k.name);

/** "Kuttab Awwal 1A" -> "KA 1A", "Qonuni 2 Akhwat" -> "KQ 2 Akhwat" (Kuttab Qonuni) — singkatan
 *  biar list "belum isi" gak makan tempat pas nama kelasnya panjang. */
function abbrevKelas(name: string): string {
  return name.replace(/^Kuttab Awwal/, "KA").replace(/^Qonuni/, "KQ");
}

/** Ringkasan "siapa yang belum isi" — Jurnal & Absen (hari ini) + Capaian Al-Qur'an (minggu ini)
 *  lintas 13 kelas, biar management gak perlu buka Rekap satu-satu cuma buat tau siapa yang bolong.
 *  Desain baris + progress bar (bukan 3 kotak kecil dijejer) — user bilang versi lama "kaku, kayak
 *  tabel dipadetin" dibanding card lain di app yang gede & ada ikonnya. */
function RingkasanHariIni() {
  const [status, setStatus] = useState<TodayStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    readTodayStatus(ALL_KELAS_NAMES)
      .then((s) => !cancelled && setStatus(s))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return null; // gagal muat ringkasan bukan hal fatal, cukup disembunyikan
  if (!status) {
    return (
      <div className="mb-5 rounded-2xl p-4 sm:p-5 animate-pulse" style={{ background: "#FFF", border: `1px solid ${C.line}`, height: 168 }} />
    );
  }

  const jurnalMissing = ALL_KELAS_NAMES.filter((k) => !status.jurnalFilled.includes(k));
  const absenMissing = ALL_KELAS_NAMES.filter((k) => !status.absenFilled.includes(k));
  const quranKnown = ALL_KELAS_NAMES.filter((k) => !status.quranUnknown.includes(k));
  const quranMissing = quranKnown.filter((k) => !status.quranFilled.includes(k));

  // Management: tiga kartu geser (Jurnal hari ini / Absen guru hari ini / Al-Qur'an pekan ini). Nama kelas yang belum
  // mengisi dibuka lewat tombol "Lihat yang belum" (singkatan, tanpa kalimat panjang).
  const buat = (key: string, judul: string, sub: string, filled: number, total: number, missing: string[], to: string): SlideKartu => {
    const nada: Nada = total > 0 && filled >= total ? "selesai" : filled > 0 ? "sebagian" : "belum";
    return {
      key,
      judul,
      sub,
      utama: nada === "selesai" ? "Semua kelas sudah mengisi" : nada === "sebagian" ? `${missing.length} kelas belum mengisi` : "Belum ada kelas yang mengisi",
      angka: `${filled}/${total}`,
      nada,
      belum: missing.map(abbrevKelas),
      to,
    };
  };
  const slides: SlideKartu[] = [
    buat("jurnal", "Jurnal", "Hari ini", status.jurnalFilled.length, status.totalKelas, jurnalMissing, "/jurnal"),
    buat("absen", "Absen guru", "Hari ini", status.absenFilled.length, status.totalKelas, absenMissing, "/absen"),
    buat("quran", "Al-Qur'an", "Pekan ini", quranKnown.length - quranMissing.length, quranKnown.length, quranMissing, "/capaian"),
  ];
  return <KartuGeser slides={slides} />;
}

/** Menu guru olahraga — 3 kartu terpisah (rencana, evaluasi, absen). */
function OlahragaMenu() {
  return (
    <main>
    <OlahragaHariIni />
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
      <HomeCard
        to="/instrumen"
        title="Panduan Olahraga"
        desc="Panduan pengajaran olahraga sebagai acuan guru."
        gradient={`linear-gradient(135deg, ${C.green} 0%, ${C.greenDeep} 100%)`}
        icon={<BookIcon />}
      />
      <HomeCard
        to="/olahraga/rencana"
        title="Rencana Kegiatan Olahraga"
        desc="Isi rencana kegiatan olahraga Kuttab Awwal 1–3, per pekan tiap bulan."
        gradient={`linear-gradient(135deg, #E3A744 0%, #C98A25 100%)`}
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
        icon={<CalendarCheckIcon />}
      />
      <HomeCard
        to="/jurnal"
        title="Daily Jurnal"
        desc="Catatan harian guru olahraga."
        gradient="linear-gradient(135deg, #2F8F83 0%, #1C5A52 100%)"
        icon={<NotebookIcon />}
      />
    </div>
    </main>
  );
}

/** Kartu geser guru OLAHRAGA: Hari ini (jurnal & absen, Senin-Rabu) + Bulan ini (rencana & evaluasi per tingkat). */
function OlahragaHariIni() {
  const { session, kelompok } = useAuth();
  const uid = session?.user?.id;
  const [s, setS] = useState<StatusOlahraga | null>(null);
  const kel = kelompok === "ikhwan" || kelompok === "akhwat" ? kelompok : null;

  useEffect(() => {
    if (!uid || !kel) return;
    let batal = false;
    readStatusOlahraga(uid, kel)
      .then((r) => !batal && setS(r))
      .catch(() => !batal && setS({ jurnal: null, absen: null, rencana: null, evaluasi: null, bulan: "" }));
    return () => {
      batal = true;
    };
  }, [uid, kel]);

  if (!s) return <div className="mb-5 rounded-2xl animate-pulse" style={{ background: "#FFF", border: `1px solid ${C.line}`, height: 176 }} />;

  const now = new Date();
  const hariAktif = [1, 2, 3].includes(now.getDay()); // Senin-Rabu
  const nadaDari = (v: number, t: number): "selesai" | "sebagian" | "belum" => (v >= t ? "selesai" : v > 0 ? "sebagian" : "belum");
  const slides: SlideKartu[] = [];

  const sub = `${labelHari(now)}, ${labelTanggal(now)}`;
  if (!hariAktif) {
    slides.push({ key: "hari", judul: "Hari ini", sub, utama: "Tidak ada jadwal. Jurnal dan absen olahraga Senin–Rabu.", nada: "libur" });
  } else {
    const it = [
      s.jurnal == null ? null : { label: "Jurnal", state: (s.jurnal ? "selesai" : "belum") as Nada, to: "/jurnal" },
      s.absen == null ? null : { label: "Absen", state: (s.absen ? "selesai" : "belum") as Nada, to: "/olahraga/absen" },
    ].filter((x): x is { label: string; state: Nada; to: string } => !!x);
    if (it.length) {
      const sudah = it.filter((x) => x.state === "selesai").length;
      const nada = nadaDari(sudah, it.length);
      slides.push({
        key: "hari",
        judul: "Hari ini",
        sub,
        utama: nada === "selesai" ? "Semua sudah terisi" : nada === "sebagian" ? "Masih ada yang belum diisi" : "Belum ada yang diisi",
        angka: `${sudah}/${it.length}`,
        nada,
        items: it,
        to: it.find((x) => x.state !== "selesai")?.to ?? it[0].to,
      });
    }
  }

  const bulanIt = [
    s.rencana ? { label: `Rencana ${s.rencana.terisi}/${s.rencana.total}`, v: s.rencana.terisi, t: s.rencana.total, to: "/olahraga/rencana" } : null,
    s.evaluasi ? { label: `Evaluasi ${s.evaluasi.terisi}/${s.evaluasi.total}`, v: s.evaluasi.terisi, t: s.evaluasi.total, to: "/olahraga/evaluasi" } : null,
  ].filter((x): x is { label: string; v: number; t: number; to: string } => !!x);
  if (bulanIt.length) {
    const total = bulanIt.reduce((a, x) => a + x.t, 0);
    const sudah = bulanIt.reduce((a, x) => a + x.v, 0);
    const nada = nadaDari(sudah, total);
    slides.push({
      key: "bulan",
      judul: "Bulan ini",
      sub: `${s.bulan} · per tingkat KA 1–3`,
      utama: nada === "selesai" ? "Rencana dan evaluasi lengkap" : nada === "sebagian" ? "Sebagian tingkat belum diisi" : "Belum diisi",
      angka: `${sudah}/${total}`,
      nada,
      items: bulanIt.map((x) => ({ label: x.label, state: nadaDari(x.v, x.t), to: x.to })),
      to: bulanIt.find((x) => x.v < x.t)?.to ?? bulanIt[0].to,
    });
  }
  return <KartuGeser slides={slides} />;
}

function HomeCard({
  to,
  title,
  gradient,
  icon,
}: {
  to: string;
  title: string;
  /** Keterangan sengaja tidak ditampilkan (kartu dibuat bersih); prop dibiarkan supaya pemanggil lama tetap valid. */
  desc?: string;
  gradient: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="kartu-muncul group relative overflow-hidden rounded-2xl p-5 flex flex-col justify-between min-h-[172px] transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2"
      style={{ background: lembut(gradient), boxShadow: "0 4px 14px rgba(28,74,51,0.14), inset 0 0 0 1px rgba(255,255,255,0.28)", "--tw-ring-color": C.gold } as any}
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
      <path d="M8.5 14.5l2 2 4.5-4.5" stroke="#FFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
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
