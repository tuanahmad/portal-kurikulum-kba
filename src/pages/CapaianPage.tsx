import { useState } from "react";

import { Link, useSearchParams } from "react-router-dom";
import { C, KELAS_LIST, jenjangOf } from "../data";
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

type Jenjang = "Kuttab Awwal" | "Qonuni";
const JENJANG_LIST: Jenjang[] = ["Kuttab Awwal", "Qonuni"];
const KELOMPOK_URUT = ["Campur", "Ikhwan", "Akhwat"] as const;
const WARNA_KELOMPOK: Record<(typeof KELOMPOK_URUT)[number], string> = { Campur: "#3B6EA5", Ikhwan: C.green, Akhwat: "#C28E2B" };

/** Kelas satu jenjang, dikelompokkan Campur / Ikhwan / Akhwat. Teks pil = nomor/tingkat saja ("1A", "3", "1-2"), karena jenjang
 *  sudah jelas dari tab dan kelompok dari barisnya; nama lengkap tampil di bawah setelah kelas dipilih. */
function kelasPerKelompok(jenjang: Jenjang) {
  const baris = KELOMPOK_URUT.map((kel) => ({ kel, chips: [] as { nama: string; label: string }[] }));
  for (const k of KELAS_LIST) {
    if (jenjangOf(k.name) !== jenjang) continue;
    const kel = /akhwat/i.test(k.name) ? "Akhwat" : /ikhwan/i.test(k.name) ? "Ikhwan" : "Campur";
    const label = k.name.replace(/^Kuttab Awwal\s*/i, "").replace(/^Qonuni\s*/i, "").replace(/\b(Ikhwan|Akhwat)\b/gi, "").replace(/\s+/g, " ").trim() || "Semua";
    baris.find((x) => x.kel === kel)!.chips.push({ nama: k.name, label });
  }
  return baris.filter((x) => x.chips.length > 0);
}

function KelasIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="16.5" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M15.5 14.2c2.6-.3 4.5 1.3 5 4.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ManagementCapaian() {
  const [sp, setSp] = useSearchParams();
  const kelasFromUrl = sp.get("kelas");
  const kelas = KELAS_LIST.find((k) => k.name === kelasFromUrl) ?? null;
  const [jenjang, setJenjang] = useState<Jenjang>((jenjangOf(kelas?.name) as Jenjang | null) ?? "Kuttab Awwal");
  const kelompok = kelasPerKelompok(jenjang);
  const judul = { color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" } as const;

  const pilih = (nama: string) => setSp({ kelas: nama }, { replace: true });
  const menu = kelas
    ? [
        { label: "Capaian Ilmu", icon: <BookIcon />, grad: `linear-gradient(135deg, ${C.green} 0%, ${C.greenDeep} 100%)`, to: `/capaian/ilmu?kelas=${encodeURIComponent(kelas.name)}` },
        { label: "Capaian Al-Qur'an", icon: <ChartIcon />, grad: "linear-gradient(135deg, #C79A3B 0%, #8A6A20 100%)", to: `/capaian/quran?kelas=${encodeURIComponent(kelas.name)}` },
        { label: "Diagram Perkembangan", icon: <TrendIcon />, grad: "linear-gradient(135deg, #3B6EA5 0%, #274C74 100%)", to: `/capaian/quran/diagram?kelas=${encodeURIComponent(kelas.name)}` },
        { label: "Tasmi'", icon: <TasmiIcon />, grad: "linear-gradient(135deg, #2F8F83 0%, #1C5A52 100%)", to: `/capaian/tasmi?kelas=${encodeURIComponent(kelas.name)}` },
      ]
    : [];

  return (
    <div className="min-h-dvh" style={{ background: C.mist, color: C.ink }}>
      <div className="max-w-xl mx-auto px-4 pt-7 sm:pt-10 pb-28">
        <header className="text-center">
          <h1 className="text-xl sm:text-2xl font-semibold" style={judul}>Capaian Santri</h1>
          <p className="text-sm mt-1.5" style={{ color: C.muted }}>Pilih kelas, lalu pilih capaian yang ingin dibuka.</p>
        </header>

        {/* Pilih kelas */}
        <section className="mt-5 rounded-3xl p-4" style={{ background: "#FFF", border: `1px solid ${C.line}`, boxShadow: "0 6px 20px rgba(28,74,51,0.07)" }}>
          <div className="grid grid-cols-2 gap-1 p-1.5 rounded-full" style={{ background: C.mist, border: `1px solid ${C.line}` }} role="tablist" aria-label="Jenjang">
            {JENJANG_LIST.map((j) => (
              <button
                key={j}
                type="button"
                role="tab"
                aria-selected={jenjang === j}
                onClick={() => setJenjang(j)}
                className="py-2 rounded-full text-sm font-semibold transition-colors"
                style={{ background: jenjang === j ? C.green : "transparent", color: jenjang === j ? "#FFF" : C.muted }}
              >
                {j}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            {kelompok.map((g) => (
              <div key={g.kel} className="flex items-start gap-3">
                <div className="w-[68px] shrink-0 pt-2.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: WARNA_KELOMPOK[g.kel] }} aria-hidden="true" />
                  {g.kel}
                </div>
                <div className="flex flex-wrap gap-2">
                  {g.chips.map((c) => {
                    const aktif = kelas?.name === c.nama;
                    return (
                      <button
                        key={c.nama}
                        type="button"
                        onClick={() => pilih(c.nama)}
                        aria-pressed={aktif}
                        aria-label={c.nama}
                        title={c.nama}
                        className="min-w-[44px] h-10 px-3.5 rounded-full text-sm font-bold transition-colors active:scale-95"
                        style={{
                          background: aktif ? WARNA_KELOMPOK[g.kel] : "transparent",
                          color: aktif ? "#FFF" : C.ink,
                          border: `1.5px solid ${aktif ? WARNA_KELOMPOK[g.kel] : C.line}`,
                        }}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Capaian untuk kelas yang dipilih */}
        {kelas ? (
          <section className="mt-5">
            <div className="flex items-center gap-2 px-1 mb-2.5">
              <span className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: C.muted }}>Capaian</span>
              <span className="text-base font-semibold" style={judul}>{kelas.name}</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {menu.map((m) => (
                <Link key={m.label} to={m.to} className="flex items-center gap-2.5 rounded-2xl p-2.5 transition-transform active:scale-[0.98]" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: m.grad }}>{m.icon}</span>
                  <span className="text-[13px] font-semibold leading-snug" style={{ color: C.ink }}>{m.label}</span>
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <p className="mt-5 text-center text-xs inline-flex w-full items-center justify-center gap-1.5" style={{ color: C.muted }}>
            <span style={{ color: C.green }}><KelasIcon /></span> Belum ada kelas dipilih
          </p>
        )}
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
  const tasmiTo = guru ? "/capaian/tasmi" : `/capaian/tasmi?kelas=${encodeURIComponent(kelasName)}`;
  return (
    <main className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1">
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
      <AccentCard
        title="Tasmi'"
        desc={guru ? "Data Tasmi' Santri" : "Riwayat tasmi' santri di kelas ini"}
        icon={<TasmiIcon />}
        gradient="linear-gradient(135deg, #2F8F83 0%, #1C5A52 100%)"
        to={tasmiTo}
      />
    </main>
  );
}

function TrendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M4 17l5-6 4 3 6-8" stroke="#FFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 6h5v5" stroke="#FFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
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

function TasmiIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M9 12.5l2 2 4.5-5" stroke="#FFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 3a9 9 0 1 0 9 9" stroke="#FFF" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M17.5 3.5v4h-4" stroke="#FFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
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
