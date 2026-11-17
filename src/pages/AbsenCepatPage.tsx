import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { C } from "../data";
import { useAuth } from "../contexts/AuthContext";
import { rayakan } from "../components/Perayaan";
import { readAbsenRange, saveAbsenDay, emptyAbsen, nowHM, ymd, hm, STATUS_LABEL, type AbsenEntry, type SesiKey } from "../lib/absen";

/** Absen satu ketukan: dibuka dari ketukan pada notifikasi pengingat absen (iPhone tidak punya tombol di notifikasi;
 *  di Android halaman ini cadangan). Mencatat jam datang/pulang = jam sekarang. Izin/sakit/cuti tetap lewat halaman Absen. */
export default function AbsenCepatPage() {
  const [sp] = useSearchParams();
  const sesi: SesiKey = sp.get("s") === "siang" ? "siang" : "pagi";
  const jenis: "datang" | "pulang" = sp.get("j") === "pulang" ? "pulang" : "datang";
  const { session, kelas, role } = useAuth();
  const uid = session?.user?.id;
  const hariIni = ymd(new Date());
  // Hanya saat pengembangan: ?uji=1 menampilkan tampilan untuk akun selain guru (tombol tidak menyimpan apa pun).
  const modeUji = import.meta.env.DEV && sp.get("uji") === "1";

  const [entri, setEntri] = useState<AbsenEntry | null | undefined>(undefined); // undefined = memuat
  const [jam, setJam] = useState(nowHM());
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [tercatat, setTercatat] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setJam(nowHM()), 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!uid || role !== "guru") {
      if (modeUji) setEntri(null);
      return;
    }
    let batal = false;
    readAbsenRange(hariIni, hariIni, { userId: uid })
      .then((m) => !batal && setEntri(m[hariIni] ?? null))
      .catch((e) => !batal && setGalat(e instanceof Error ? e.message : "Gagal memuat absen."));
    return () => {
      batal = true;
    };
  }, [uid, role, hariIni, modeUji]);

  const judul = `Absen ${jenis} · kelas ${sesi}`;
  const lembar = (isi: React.ReactNode) => (
    <div className="min-h-dvh" style={{ background: C.mist, color: C.ink }}>
      <div className="max-w-md mx-auto px-4 pt-10 pb-32 text-center">{isi}</div>
    </div>
  );

  if (role !== "guru" && !modeUji) {
    return lembar(
      <>
        <h1 className="text-xl font-semibold" style={{ color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}>Absen cepat</h1>
        <p className="mt-3 text-sm" style={{ color: C.muted }}>Halaman ini untuk guru kelas.</p>
        <Link to="/home" className="inline-block mt-5 px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ background: C.green, color: "#FFF" }}>Ke Beranda</Link>
      </>
    );
  }

  const sesiIni = entri?.[sesi];
  const jamAda = sesiIni ? hm(jenis === "datang" ? sesiIni.jam_datang : sesiIni.jam_pulang) : null;
  const statusLain = sesiIni && sesiIni.status !== "hadir" ? STATUS_LABEL[sesiIni.status] : null;

  async function isi() {
    if (modeUji) {
      setTercatat(nowHM());
      return;
    }
    if (!kelas) {
      setGalat("Akunmu belum terhubung ke kelas. Hubungi koordinator kurikulum.");
      return;
    }
    setSibuk(true);
    setGalat(null);
    try {
      const baru: AbsenEntry = JSON.parse(JSON.stringify(entri ?? emptyAbsen(hariIni)));
      const sekarang = nowHM();
      baru[sesi].status = "hadir";
      if (jenis === "datang") baru[sesi].jam_datang = sekarang;
      else baru[sesi].jam_pulang = sekarang;
      await saveAbsenDay({ kelas, tanggal: hariIni, pagi: baru.pagi, siang: baru.siang });
      setEntri(baru);
      setTercatat(sekarang);
      rayakan("JOSJIS BOLO");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal menyimpan. Coba lagi.");
    } finally {
      setSibuk(false);
    }
  }

  const ikon = (
    <span className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${C.green} 0%, ${C.greenDeep} 100%)` }}>
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" stroke="#FFF" strokeWidth="1.8" />
        <path d="M12 7.5V12l3 2" stroke="#FFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
  const judulEl = (
    <h1 className="mt-4 text-xl font-semibold" style={{ color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}>{judul}</h1>
  );

  if (tercatat || (jamAda && !modeUji)) {
    const j = tercatat ?? jamAda;
    return lembar(
      <>
        {ikon}
        {judulEl}
        <p className="mt-5 text-4xl font-bold" style={{ color: C.green }}>{j}</p>
        <p className="mt-2 text-sm" style={{ color: C.muted }}>{tercatat ? "Tercatat. Terima kasih." : "Sudah tercatat sebelumnya."}</p>
        <div className="mt-6 flex flex-col gap-2">
          <Link to="/absen" className="py-2.5 rounded-xl text-sm font-semibold" style={{ background: C.card, border: `1px solid ${C.line}`, color: C.green }}>Lihat absen lengkap</Link>
          <Link to="/home" className="py-2.5 rounded-xl text-sm font-semibold" style={{ color: C.muted }}>Ke Beranda</Link>
        </div>
      </>
    );
  }

  if (statusLain) {
    return lembar(
      <>
        {ikon}
        {judulEl}
        <p className="mt-4 text-sm" style={{ color: C.muted }}>Kelas {sesi} hari ini sudah diisi sebagai <b>{statusLain}</b>. Tidak diubah.</p>
        <Link to="/absen" className="inline-block mt-6 px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ background: C.green, color: "#FFF" }}>Buka halaman Absen</Link>
      </>
    );
  }

  return lembar(
    <>
      {ikon}
      {judulEl}
      <p className="mt-1 text-sm" style={{ color: C.muted }}>{kelas ?? "Mode uji"}</p>
      {entri === undefined && !galat ? (
        <p className="mt-8 text-sm" style={{ color: C.muted }}>Memuat…</p>
      ) : (
        <>
          <p className="mt-6 text-5xl font-bold tabular-nums" style={{ color: C.green }}>{jam}</p>
          <p className="mt-1 text-xs" style={{ color: C.muted }}>Jam yang akan dicatat</p>
          <button
            type="button"
            onClick={isi}
            disabled={sibuk}
            className="mt-6 w-full py-4 rounded-2xl text-base font-bold transition-transform active:scale-[0.98]"
            style={{ background: C.green, color: "#FFF", opacity: sibuk ? 0.6 : 1 }}
          >
            {sibuk ? "Menyimpan…" : `Hadir sekarang · ${jenis}`}
          </button>
          {galat && <p className="mt-3 text-xs" style={{ color: "var(--c-bahayaTeks)" }}>{galat}</p>}
          <Link to="/absen" className="inline-block mt-5 text-sm font-semibold" style={{ color: C.green }}>Izin, sakit, atau cuti? Buka halaman Absen</Link>
        </>
      )}
    </>
  );
}
