import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { C, KELAS_LIST, capaianRoster } from "../data";
import { BackButton } from "../components/PortalComponents";
import { PageLoadingSkeleton } from "../components/Skeleton";
import { kelompokSantri } from "../lib/roster";
import { BULAN_NAMA, kehadiranKelasBulan, labelPeriode, persenHadir, belumDiabsen, type BarisKehadiran } from "../lib/kehadiranSantri";

/** Profil ringkas satu santri (management): kelas, kehadiran bulan ini, dan pintasan ke capaiannya. Dibuka dari kotak "Cari santri". */
export default function ProfilSantriPage() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const kelas = sp.get("kelas") ?? "";
  const nama = sp.get("nama") ?? "";
  const ada = KELAS_LIST.some((k) => k.name === kelas) && capaianRoster(kelas).includes(nama);

  const [bulan, setBulan] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [data, setData] = useState<{ baris: BarisKehadiran | null; seharusnya: number } | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const sekarang = new Date();
  const bulanIni = bulan.getFullYear() === sekarang.getFullYear() && bulan.getMonth() === sekarang.getMonth();

  useEffect(() => {
    if (!ada) return;
    let batal = false;
    setData(null);
    setGalat(null);
    kehadiranKelasBulan(bulan.getFullYear(), bulan.getMonth())
      .then((grup) => {
        if (batal) return;
        const g = grup.find((x) => x.judul === kelas);
        setData({ baris: g?.baris.find((b) => b.nama === nama) ?? null, seharusnya: g?.seharusnya ?? 0 });
      })
      .catch((e) => !batal && setGalat(e instanceof Error ? e.message : "Gagal memuat kehadiran."));
    return () => {
      batal = true;
    };
  }, [ada, kelas, nama, bulan]);

  const judul = { color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" } as const;
  const kelompok = ada ? kelompokSantri(kelas, nama) : null;
  const q = `?kelas=${encodeURIComponent(kelas)}`;
  const menu = [
    { label: "Capaian Al-Qur'an", to: `/capaian/quran${q}`, grad: "linear-gradient(135deg, #C79A3B 0%, var(--c-emasTeks) 100%)" },
    { label: "Capaian Ilmu", to: `/capaian/ilmu${q}`, grad: `linear-gradient(135deg, ${C.green} 0%, ${C.greenDeep} 100%)` },
    { label: "Diagram Perkembangan", to: `/capaian/quran/diagram${q}`, grad: "linear-gradient(135deg, #3B6EA5 0%, var(--c-biruTeks) 100%)" },
    { label: "Tasmi'", to: `/capaian/tasmi${q}`, grad: "linear-gradient(135deg, #2F8F83 0%, var(--c-toscaTeks) 100%)" },
  ];

  if (!ada) {
    return (
      <div className="min-h-dvh" style={{ background: C.mist, color: C.ink }}>
        <div className="max-w-xl mx-auto px-4 pt-7 pb-32 text-center">
          <h1 className="text-xl font-semibold" style={judul}>Santri tidak ditemukan</h1>
          <p className="mt-2 text-sm" style={{ color: C.muted }}>Nama atau kelasnya tidak ada di daftar. Coba cari lagi dari Beranda.</p>
          <Link to="/home" className="inline-block mt-5 px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ background: C.green, color: "#FFF" }}>Ke Beranda</Link>
        </div>
      </div>
    );
  }

  const b = data?.baris;
  const seharusnya = data?.seharusnya ?? 0;
  const geser = (n: number) => setBulan((d) => new Date(d.getFullYear(), d.getMonth() + n, 1));

  return (
    <div className="min-h-dvh" style={{ background: C.mist, color: C.ink }}>
      <div className="max-w-xl mx-auto px-4 pt-6 sm:pt-9 pb-32">
        <header className="relative flex flex-col items-center justify-center text-center px-12 min-h-[44px]">
          <BackButton onClick={() => nav(-1)} label="Kembali" className="absolute left-0 inset-y-0 my-auto" />
          <h1 className="text-xl sm:text-2xl font-semibold" style={judul}>{nama}</h1>
          <div className="mt-1.5 flex items-center justify-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold" style={{ background: C.leaf, color: C.green }}>{kelas}</span>
            {kelompok && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold" style={{ background: kelompok === "akhwat" ? "var(--c-emasBg)" : "var(--c-biruBg)", color: kelompok === "akhwat" ? "var(--c-emasTeks)" : "var(--c-biruTeks)" }}>
                {kelompok === "akhwat" ? "Akhwat" : "Ikhwan"}
              </span>
            )}
          </div>
        </header>

        {/* Kehadiran */}
        <section className="mt-5 rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.line}` }}>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => geser(-1)} aria-label="Bulan sebelumnya" className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.mist, border: `1px solid ${C.line}`, color: C.green }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <div className="flex-1 text-center">
              <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: C.green }}>Kehadiran di kelas</div>
              <div className="text-sm font-semibold">{labelPeriode(bulan.getFullYear(), bulan.getMonth())}</div>
            </div>
            <button type="button" onClick={() => geser(1)} disabled={bulanIni} aria-label="Bulan berikutnya" className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.mist, border: `1px solid ${C.line}`, color: C.green, opacity: bulanIni ? 0.35 : 1 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>

          {galat ? (
            <p className="mt-3 text-xs" style={{ color: "var(--c-bahayaTeks)" }}>{galat}</p>
          ) : !data ? (
            <div className="mt-3"><PageLoadingSkeleton /></div>
          ) : seharusnya === 0 ? (
            <p className="mt-4 text-sm text-center" style={{ color: C.muted }}>Belum ada sesi tercatat bulan {BULAN_NAMA[bulan.getMonth()]}.</p>
          ) : (
            <>
              <div className="mt-4 text-center">
                <div className="text-4xl font-bold" style={{ color: C.green }}>{b ? persenHadir(b, seharusnya) : "-"}</div>
                <div className="text-xs mt-0.5" style={{ color: C.muted }}>dari total {seharusnya} sesi (pagi dan siang)</div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[
                  ["Hadir", b?.hadir ?? 0, C.green],
                  ["Tidak hadir", b?.tidak ?? 0, "var(--c-bahaya)"],
                  ["Belum diabsen", b ? belumDiabsen(b, seharusnya) : seharusnya, C.muted],
                ].map(([label, n, warna]) => (
                  <div key={label as string} className="rounded-xl py-2" style={{ background: C.mist, border: `1px solid ${C.line}` }}>
                    <div className="text-lg font-bold" style={{ color: warna as string }}>{n as number}</div>
                    <div className="text-[11px]" style={{ color: C.muted }}>{label as string}</div>
                  </div>
                ))}
              </div>
              {b && (b.catatan.length > 0 || (b.catatanSiang?.length ?? 0) > 0) && (
                <div className="mt-3 space-y-2 text-xs">
                  {b.catatan.length > 0 && (
                    <div><span className="font-bold" style={{ color: C.green }}>Tidak hadir pagi:</span> {b.catatan.join("; ")}</div>
                  )}
                  {(b.catatanSiang?.length ?? 0) > 0 && (
                    <div><span className="font-bold" style={{ color: C.green }}>Tidak hadir siang:</span> {b.catatanSiang!.join("; ")}</div>
                  )}
                </div>
              )}
            </>
          )}
        </section>

        {/* Pintasan capaian */}
        <h2 className="mt-6 mb-2.5 px-1 text-xs font-bold uppercase tracking-[0.14em]" style={{ color: C.green }}>Capaian kelas {kelas}</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {menu.map((m) => (
            <Link key={m.label} to={m.to} className="flex items-center gap-2.5 rounded-2xl p-2.5 transition-transform active:scale-[0.98]" style={{ background: C.card, border: `1px solid ${C.line}` }}>
              <span className="w-10 h-10 rounded-xl shrink-0" style={{ background: m.grad }} aria-hidden="true" />
              <span className="text-[13px] font-semibold leading-snug" style={{ color: C.ink }}>{m.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
