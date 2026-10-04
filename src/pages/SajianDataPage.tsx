import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { C, isMonthOpen } from "../data";
import { BackButton } from "../components/PortalComponents";
import { MonthGrid } from "../components/MonthGrid";
import { muatLaporan, quranTerisi, ilmuTerisi, rpbTerisi, refleksiTerisi, type Laporan, type KelasLaporan, type Progress } from "../lib/laporanBulanan";
import { ilmuPerAnak, rpbTampil, persen } from "../lib/laporanTampil";
import { KELOMPOK_LABEL } from "../lib/olahraga";

const BULAN_12 = ["Juli", "Agustus", "September", "Oktober", "November", "Desember", "Januari", "Februari", "Maret", "April", "Mei", "Juni"];
const OK = "#1D9E75";
const WARN = "#BA7517";
const BAD = "#B3261E";
const BAD_BG = "#FDEBEA";

const card = { background: "#FFF", border: `1px solid ${C.line}`, borderRadius: 16 } as const;
const warna = (p: number | null) => (p == null ? C.muted : p >= 85 ? OK : p >= 60 ? WARN : BAD);

/** Sajian Data masih dalam pengembangan, jadi dikunci PIN (6 angka, disimpan sebagai hash di database,
 *  dicek lewat fungsi server `sajian_pin_verify`; salah 5x terkunci 15 menit). Terbuka selama tab
 *  itu aktif (sessionStorage), tombol "Kunci" menguncinya lagi. Ini mengunci HALAMANNYA saja -- data
 *  sumbernya tetap sama seperti yang bisa dibaca akun management di halaman lain. */
export default function SajianDataPage() {
  const { session } = useAuth();
  const uid = session?.user?.id ?? "anon";
  const key = `sajian-unlocked:${uid}`;
  const [unlocked, setUnlocked] = useState(() => {
    try {
      return sessionStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  });
  const buka = () => {
    try {
      sessionStorage.setItem(key, "1");
    } catch {
      /* abaikan: tetap terbuka selama komponen ini hidup */
    }
    setUnlocked(true);
  };
  const navigate = useNavigate();
  const kunci = () => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    setUnlocked(false);
    navigate("/home");
  };
  return unlocked ? <SajianDataIsi onKunci={kunci} /> : <PinGate onBuka={buka} />;
}

function PinGate({ onBuka }: { onBuka: () => void }) {
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function cek(v: string) {
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabase.rpc("sajian_pin_verify", { pin: v });
    setBusy(false);
    if (error) return setMsg("Gagal memeriksa PIN: " + error.message);
    if (data === "ok") return onBuka();
    setPin("");
    setMsg(
      data === "locked"
        ? "Terlalu banyak percobaan. Coba lagi 15 menit lagi."
        : data === "forbidden"
          ? "Halaman ini hanya untuk akun management."
          : data === "unset"
            ? "PIN belum diatur."
            : "PIN salah."
    );
  }

  return (
    <div className="min-h-dvh" style={{ background: C.mist, color: C.ink }}>
      <div className="max-w-sm mx-auto px-4 pt-10 pb-28">
        <BackButton to="/home" label="Home" />
        <div className="mt-8 p-6 text-center" style={card}>
          <div className="mx-auto w-11 h-11 rounded-full flex items-center justify-center" style={{ background: C.leaf, color: C.green }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="mt-3 text-lg font-semibold" style={{ color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}>Sajian Data</h1>
          <p className="text-sm mt-1" style={{ color: C.muted }}>Masukkan PIN 6 angka untuk membuka.</p>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={pin}
            disabled={busy}
            autoFocus
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 6);
              setPin(v);
              setMsg(null);
              if (v.length === 6) void cek(v);
            }}
            aria-label="PIN"
            className="mt-4 w-full text-center text-2xl tracking-[0.5em] outline-none rounded-xl py-2.5"
            style={{ border: `1px solid ${msg ? "#E8A6A0" : C.line}`, background: "#FFF" }}
          />
          <div className="mt-3 text-xs min-h-4" style={{ color: msg ? "#8A2A20" : C.muted }}>{busy ? "Memeriksa…" : msg}</div>
        </div>
      </div>
    </div>
  );
}

function GantiPinPanel({ onTutup }: { onTutup: () => void }) {
  const [lama, setLama] = useState("");
  const [baru, setBaru] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const angka = (v: string) => v.replace(/\D/g, "").slice(0, 6);
  const siap = lama.length === 6 && baru.length === 6 && !busy;

  async function simpan() {
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabase.rpc("sajian_pin_set", { old_pin: lama, new_pin: baru });
    setBusy(false);
    if (error) return setMsg({ ok: false, t: "Gagal: " + error.message });
    if (data === "ok") {
      setLama("");
      setBaru("");
      return setMsg({ ok: true, t: "PIN berhasil diganti." });
    }
    setMsg({
      ok: false,
      t: data === "wrong" ? "PIN lama salah." : data === "locked" ? "Terlalu banyak percobaan. Coba lagi 15 menit lagi." : data === "invalid" ? "PIN baru harus 6 angka." : "Tidak bisa mengganti PIN.",
    });
  }

  const kotak = "w-full text-center text-lg tracking-[0.4em] rounded-xl py-2 outline-none";
  return (
    <div className="mt-4 p-4 sm:p-5" style={card}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: C.leaf, color: C.green }}>
            <IkonKunci />
          </span>
          <div className="text-sm font-semibold" style={{ color: C.ink }}>Ganti PIN</div>
        </div>
        <button type="button" onClick={onTutup} aria-label="Tutup" className="w-7 h-7 rounded-full flex items-center justify-center" style={{ color: C.muted, background: C.mist, border: `1px solid ${C.line}` }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
        </button>
      </div>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-[11px] font-semibold mb-1" style={{ color: C.muted }}>PIN lama</span>
          <input type="password" inputMode="numeric" autoComplete="off" placeholder="••••••" value={lama} onChange={(e) => setLama(angka(e.target.value))} className={kotak} style={{ border: `1px solid ${C.line}`, background: C.mist }} />
        </label>
        <label className="block">
          <span className="block text-[11px] font-semibold mb-1" style={{ color: C.muted }}>PIN baru (6 angka)</span>
          <input type="password" inputMode="numeric" autoComplete="off" placeholder="••••••" value={baru} onChange={(e) => setBaru(angka(e.target.value))} className={kotak} style={{ border: `1px solid ${C.line}`, background: C.mist }} />
        </label>
      </div>
      {msg && <div className="mt-3 text-xs font-medium" style={{ color: msg.ok ? OK : "#8A2A20" }}>{msg.t}</div>}
      <button type="button" onClick={simpan} disabled={!siap} className="mt-4 w-full py-2.5 rounded-xl text-sm font-bold transition-opacity" style={{ background: C.green, color: "#FFF", opacity: siap ? 1 : 0.45 }}>
        {busy ? "Menyimpan…" : "Simpan PIN baru"}
      </button>
    </div>
  );
}

/** Gembok animasi: terbuka (gagang terangkat) selama halaman dibuka; saat ditekan gagangnya turun
 *  mengunci dulu, baru halaman ditutup. */
function Gembok({ terkunci }: { terkunci: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g
        style={{
          transform: terkunci ? "translateY(0)" : "translateY(-3.5px)",
          transition: "transform 380ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </g>
      <g
        style={{
          transformOrigin: "12px 15.5px",
          transform: terkunci ? "scale(1.08)" : "scale(1)",
          transition: "transform 200ms ease 330ms",
        }}
      >
        <rect x="5" y="11" width="14" height="9.5" rx="2" fill="currentColor" fillOpacity={terkunci ? 0.18 : 0.08} stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="15.7" r="1.15" fill="currentColor" />
      </g>
    </svg>
  );
}

function IkonKunci() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Isi Sajian Data (management): laporan bulanan seluruh sekolah dari semua data yang diisi guru, tampil
 *  rapi di layar dan bisa diunduh PDF buat dikirim ke coach. Cuma membaca data, tidak menulis apa pun. */
function SajianDataIsi({ onKunci }: { onKunci: () => void }) {
  const [bulan, setBulan] = useState<string | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [mengunci, setMengunci] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  function kunciDenganAnimasi() {
    if (mengunci) return;
    setMengunci(true);
    timer.current = window.setTimeout(onKunci, 650); // beri waktu gembok mengunci dulu
  }
  const [lap, setLap] = useState<Laporan | null>(null);
  const [prog, setProg] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    if (!bulan) return;
    let cancelled = false;
    setLap(null);
    setError(null);
    setProg({ selesai: 0, total: 1 });
    muatLaporan(bulan, (p) => !cancelled && setProg(p))
      .then((l) => !cancelled && setLap(l))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => !cancelled && setProg(null));
    return () => {
      cancelled = true;
    };
  }, [bulan]);

  async function unduh() {
    if (!lap) return;
    setPdfBusy(true);
    setError(null);
    try {
      const { unduhPdfLaporan } = await import("../lib/laporanPdf");
      await unduhPdfLaporan(lap);
    } catch (e) {
      setError("Gagal membuat PDF: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className="min-h-dvh" style={{ background: C.mist, color: C.ink }}>
      <div className="max-w-3xl mx-auto px-4 pt-6 sm:pt-9 pb-32 sm:pb-40">
        <BackButton to="/home" label="Home" />
        <header className="mt-4">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl sm:text-2xl font-semibold" style={{ color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}>
              Sajian Data
            </h1>
            <div className="shrink-0 flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPinOpen((o) => !o)}
                aria-expanded={pinOpen}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors hover:opacity-80"
                style={{ background: pinOpen ? C.green : "#FFF", color: pinOpen ? "#FFF" : C.green, border: "1px solid " + C.line }}
              >
                <IkonKunci />
                Ganti PIN
              </button>
              <button
                type="button"
                onClick={kunciDenganAnimasi}
                aria-label="Kunci Sajian Data dan keluar"
                title="Kunci dan keluar"
                className="w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:opacity-80"
                style={{ background: mengunci ? C.green : C.leaf, color: mengunci ? "#FFF" : C.green, border: "1px solid " + C.green }}
              >
                <Gembok terkunci={mengunci} />
              </button>
            </div>
          </div>
          <p className="text-sm mt-1" style={{ color: C.muted }}>
            Laporan bulanan seluruh sekolah dari data yang diisi guru. Pilih bulan, lihat, lalu unduh PDF untuk coach.
          </p>
        </header>

        {pinOpen && <GantiPinPanel onTutup={() => setPinOpen(false)} />}

        <div className="mt-5">
          <span className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: C.green }}>Bulan</span>
          <MonthGrid months={BULAN_12} value={bulan} onSelect={setBulan} isOpen={isMonthOpen} />
        </div>

        {error && (
          <div className="mt-4 rounded-xl px-3.5 py-2.5 text-xs" style={{ background: BAD_BG, border: "1px solid #E8A6A0", color: "#8A2A20" }}>
            {error}
          </div>
        )}

        {prog && (
          <div className="mt-5 p-4" style={card}>
            <div className="text-sm font-semibold" style={{ color: C.ink }}>Mengumpulkan data {bulan}…</div>
            <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: C.leaf }}>
              <div className="h-2 rounded-full transition-all" style={{ width: `${Math.round((prog.selesai / Math.max(prog.total, 1)) * 100)}%`, background: C.green }} />
            </div>
            <div className="text-xs mt-1.5" style={{ color: C.muted }}>{prog.selesai} dari {prog.total} sumber</div>
          </div>
        )}

        {lap && (
          <>
            <button
              type="button"
              onClick={unduh}
              disabled={pdfBusy}
              className="mt-5 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: C.green, color: "#FFF", opacity: pdfBusy ? 0.5 : 1 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {pdfBusy ? "Menyiapkan PDF…" : "Download PDF"}
            </button>
            <Laporan_ lap={lap} />
          </>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── isi laporan ───────────────────────── */

function Seksi({ judul, sub, children }: { judul: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="text-base font-semibold" style={{ color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}>{judul}</h2>
      {sub && <p className="text-xs mt-0.5" style={{ color: C.muted }}>{sub}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Kpi({ nilai, label, warnaNilai }: { nilai: string; label: string; warnaNilai?: string }) {
  return (
    <div className="p-3.5" style={card}>
      <div className="text-2xl font-semibold" style={{ color: warnaNilai ?? C.ink }}>{nilai}</div>
      <div className="text-xs mt-0.5" style={{ color: C.muted }}>{label}</div>
    </div>
  );
}

function Laporan_({ lap }: { lap: Laporan }) {
  const rataHadir = useMemo(() => {
    const v = lap.guruSummary.map((g) => g.persenHadir).filter((x): x is number => x != null);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  }, [lap]);
  const lengkap = lap.kelas.filter((k) => quranTerisi(k.quran) && ilmuTerisi(k.ilmu) && rpbTerisi(k.rpb) && refleksiTerisi(k.refleksi)).length;
  const totalTasmi = lap.kelas.reduce((a, k) => a + k.tasmi.length, 0);
  const jurnalTerisi = lap.kelas.reduce((a, k) => a + k.jurnal.terisi, 0);
  const jurnalTotal = lap.kelas.reduce((a, k) => a + k.jurnal.total, 0);
  const pJurnal = persen(jurnalTerisi, jurnalTotal);

  return (
    <>
      <Seksi judul={`Laporan ${lap.bulan} ${lap.year}`} sub={`Kuttab Budi Ashari · ${lap.kelas.length} kelas · data per ${lap.dimuat.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kpi nilai={rataHadir == null ? "—" : `${rataHadir}%`} label="Rata-rata kehadiran guru" warnaNilai={warna(rataHadir)} />
          <Kpi nilai={`${lengkap}/${lap.kelas.length}`} label="Kelas lengkap (Qur'an, Ilmu, RPB, Refleksi)" warnaNilai={warna(persen(lengkap, lap.kelas.length))} />
          <Kpi nilai={pJurnal == null ? "—" : `${pJurnal}%`} label="Hari jurnal terisi" warnaNilai={warna(pJurnal)} />
          <Kpi nilai={String(totalTasmi)} label="Tasmi' bulan ini" />
        </div>

        {lap.perhatian.length > 0 && (
          <div className="mt-4 rounded-2xl p-4" style={{ background: "#FAEEDA", border: "1px solid #EFD9AE", color: "#633806" }}>
            <div className="text-sm font-semibold">Catatan perhatian</div>
            <ul className="mt-1.5 text-xs leading-relaxed list-disc pl-4 space-y-0.5">
              {lap.perhatian.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </div>
        )}
      </Seksi>

      <Seksi judul="Kelengkapan pengisian per kelas" sub="Centang = sudah ada isi di bulan ini. Jurnal dan absen santri dalam angka.">
        <div className="overflow-x-auto" style={card}>
          <table className="w-full text-xs" style={{ minWidth: 560 }}>
            <thead>
              <tr style={{ background: C.leaf, color: C.muted }}>
                {["Kelas", "Qur'an", "Ilmu", "RPB", "Refleksi", "Jurnal", "Absen santri", "Tasmi'"].map((h, i) => (
                  <th key={h} className={`font-semibold px-2.5 py-2 ${i === 0 ? "text-left" : "text-center"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lap.kelas.map((k) => {
                const as = k.absenSantri ? persen(k.absenSantri.hadir, k.absenSantri.total) : null;
                return (
                  <tr key={k.kelas} style={{ borderTop: `1px solid ${C.line}` }}>
                    <td className="px-2.5 py-2 font-medium">{k.kelas}</td>
                    <Tanda ok={quranTerisi(k.quran)} />
                    <Tanda ok={ilmuTerisi(k.ilmu)} />
                    <Tanda ok={rpbTerisi(k.rpb)} />
                    <Tanda ok={refleksiTerisi(k.refleksi)} />
                    <td className="text-center px-2 py-2" style={{ color: warna(persen(k.jurnal.terisi, k.jurnal.total)) }}>{k.jurnal.terisi}/{k.jurnal.total}</td>
                    <td className="text-center px-2 py-2" style={{ color: warna(as) }}>{as == null ? "—" : `${as}%`}</td>
                    <td className="text-center px-2 py-2">{k.tasmi.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Seksi>

      <Seksi judul="Kehadiran dan kedisiplinan guru" sub="Hitungan per sesi (pagi dan siang). Telat = datang melewati jam ideal; pulang awal = lebih dari 30 menit sebelum jam pulang.">
        <div className="overflow-x-auto" style={card}>
          <table className="w-full text-xs" style={{ minWidth: 520 }}>
            <thead>
              <tr style={{ background: C.leaf, color: C.muted }}>
                {["Guru", "Hadir", "Izin", "Sakit", "Cuti", "Telat", "Pulang awal", "% hadir"].map((h, i) => (
                  <th key={h} className={`font-semibold px-2.5 py-2 ${i === 0 ? "text-left" : "text-center"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lap.guruSummary.map((g) => (
                <tr key={g.guru.kelas} style={{ borderTop: `1px solid ${C.line}` }}>
                  <td className="px-2.5 py-2">
                    <div className="font-medium">{g.guru.nama}</div>
                    <div className="text-[10px]" style={{ color: C.muted }}>{g.guru.kelas}</div>
                  </td>
                  <td className="text-center">{g.hadir}</td>
                  <td className="text-center">{g.izin}</td>
                  <td className="text-center">{g.sakit}</td>
                  <td className="text-center">{g.cuti}</td>
                  <td className="text-center font-semibold" style={{ color: g.telat > 0 ? BAD : C.muted, background: g.telat > 0 ? BAD_BG : undefined }}>{g.telat}</td>
                  <td className="text-center font-semibold" style={{ color: g.awal > 0 ? BAD : C.muted, background: g.awal > 0 ? BAD_BG : undefined }}>{g.awal}</td>
                  <td className="text-center font-semibold" style={{ color: warna(g.persenHadir) }}>{g.persenHadir == null ? "—" : `${g.persenHadir}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seksi>

      <Seksi judul="Detail per kelas" sub="Ketuk kelas untuk membuka isi lengkap dari guru. Isi yang sama ikut tercetak di PDF.">
        <div className="space-y-3">
          {lap.kelas.map((k) => <KelasCard key={k.kelas} k={k} />)}
        </div>
      </Seksi>

      <Seksi judul="Olahraga">
        <div className="p-4" style={card}>
          <div className="text-xs font-semibold" style={{ color: C.green }}>Evaluasi anak terisi</div>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {lap.olahraga.evaluasi.map((e) => (
              <div key={e.tingkat} className="flex items-center justify-between text-xs">
                <span>Kuttab Awwal {e.tingkat.replace("KA ", "")} (ikhwan + akhwat)</span>
                <span style={{ color: warna(persen(e.terisi, e.total)), fontWeight: 600 }}>{e.terisi}/{e.total}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 text-xs font-semibold" style={{ color: C.green }}>Rencana kegiatan</div>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {lap.olahraga.rencana.map((r) => (
              <div key={r.kelompok + r.tingkat} className="flex items-center justify-between text-xs">
                <span>{KELOMPOK_LABEL[r.kelompok]} · {r.tingkat}</span>
                <span style={{ color: r.entry ? OK : C.muted, fontWeight: 600 }}>{r.entry ? "Terisi" : "Belum"}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 text-xs font-semibold" style={{ color: C.green }}>Kehadiran guru olahraga (sesi)</div>
          <div className="mt-2 space-y-1">
            {lap.olahraga.absen.map((a) => (
              <div key={a.kelompok} className="text-xs">
                {KELOMPOK_LABEL[a.kelompok]}: hadir {a.hadir}, izin {a.izin}, sakit {a.sakit}, cuti {a.cuti}
              </div>
            ))}
          </div>
        </div>
      </Seksi>
    </>
  );
}

function Tanda({ ok }: { ok: boolean }) {
  return (
    <td className="text-center px-2 py-2 font-bold" style={{ color: ok ? OK : BAD }}>
      {ok ? "✓" : "—"}
    </td>
  );
}

/* ───────────────────────── detail per kelas ───────────────────────── */

function KelasCard({ k }: { k: KelasLaporan }) {
  const [open, setOpen] = useState(false);
  const status = [quranTerisi(k.quran), ilmuTerisi(k.ilmu), rpbTerisi(k.rpb), refleksiTerisi(k.refleksi)];
  return (
    <div style={card} className="overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 px-4 py-3 text-left" style={{ background: open ? C.leaf : "#FFF" }}>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">{k.kelas}</div>
          <div className="text-xs truncate" style={{ color: C.muted }}>{k.guru || "Guru belum terdaftar"}</div>
        </div>
        <div className="flex gap-1" aria-label="Status pengisian">
          {status.map((s, i) => (
            <span key={i} className="w-2 h-2 rounded-full" style={{ background: s ? OK : "#D8D5CA" }} />
          ))}
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: C.muted, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-5 pt-1 space-y-6" style={{ borderTop: `1px solid ${C.line}` }}>
          <BlokQuran k={k} />
          <BlokIlmu k={k} />
          <BlokRpb k={k} />
          <BlokRefleksi k={k} />
          <BlokTasmi k={k} />
        </div>
      )}
    </div>
  );
}

function Judul({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-bold mt-4" style={{ color: C.green }}>{children}</h3>;
}
function Kosong({ teks }: { teks: string }) {
  return <p className="text-xs mt-1.5" style={{ color: C.muted }}>{teks}</p>;
}
function Teks({ label, value }: { label: string; value: string }) {
  const v = (value ?? "").trim();
  return (
    <div className="mt-2">
      <div className="text-[11px] font-semibold" style={{ color: C.green }}>{label}</div>
      <div className="text-sm whitespace-pre-wrap" style={{ color: v ? C.ink : C.muted }}>{v || "—"}</div>
    </div>
  );
}

function BlokQuran({ k }: { k: KelasLaporan }) {
  if (!k.quran) return (<><Judul>Capaian Al-Qur'an</Judul><Kosong teks={k.err.quran ? `Belum bisa dibaca: ${k.err.quran}` : "Belum ada data."} /></>);
  return (
    <>
      <Judul>Capaian Al-Qur'an</Judul>
      <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>
        Batang = total baris yang dibaca dalam sebulan. PT = persiapan tasmi', TS = tasmi' (dihitung dari kode yang ditulis guru). Surat/juz belum ada isiannya dan dikosongkan.
      </p>
      {k.quran.map((sec) => {
        const maks = Math.max(1, ...sec.santri.map((s) => (sec.type === "pertemuan" ? s.total : s.terisi)));
        return (
          <div key={sec.name} className="mt-3">
            <div className="text-xs font-semibold">{sec.name}</div>
            <div className="mt-1.5 space-y-1.5">
              {sec.santri.map((s) => {
                const nilai = sec.type === "pertemuan" ? s.total : s.terisi;
                return (
                  <div key={s.nama} className="grid items-center gap-2 text-xs" style={{ gridTemplateColumns: "minmax(0,150px) minmax(0,1fr) auto" }}>
                    <span className="truncate" title={s.nama}>{s.nama}</span>
                    <div className="h-2.5 rounded" style={{ background: "#EDEBE2" }}>
                      <div className="h-2.5 rounded" style={{ width: `${Math.round((nilai / maks) * 100)}%`, background: C.green }} />
                    </div>
                    <span className="tabular-nums text-right" style={{ minWidth: 150 }}>
                      {s.terisi === 0 ? (
                        <span style={{ color: C.muted }}>belum diisi</span>
                      ) : (
                        <>
                          <b>{sec.type === "pertemuan" ? s.total : `${s.terisi}/${sec.slotCount} pekan`}</b>
                          {sec.type === "pertemuan" && <span style={{ color: C.muted }}> · {s.terisi} hari</span>}
                        </>
                      )}
                      {(s.pt > 0 || s.ts > 0) && <span style={{ color: WARN }}> · PT {s.pt} · TS {s.ts}</span>}
                      <span style={{ color: C.muted }}> · surat: —</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}

function BlokIlmu({ k }: { k: KelasLaporan }) {
  if (!k.ilmu) return (<><Judul>Capaian Ilmu</Judul><Kosong teks={k.err.ilmu ? `Belum bisa dibaca: ${k.err.ilmu}` : "Belum ada data."} /></>);
  const anak = ilmuPerAnak(k.kelas, k.ilmu);
  return (
    <>
      <Judul>Capaian Ilmu</Judul>
      {anak.length === 0 && <Kosong teks="Belum ada isi." />}
      {anak.map((a) => (
        <div key={a.nama} className="mt-3 rounded-xl p-3" style={{ background: C.mist, border: `1px solid ${C.line}` }}>
          <div className="text-sm font-semibold">{a.nama}</div>
          {a.items.length === 0 ? (
            <Kosong teks="Belum diisi." />
          ) : (
            <div className="mt-1.5 space-y-1.5">
              {a.items.map((it) => (
                <div key={(it.grup ?? "") + it.label} className="text-sm">
                  <span className="text-[11px] font-semibold" style={{ color: C.green }}>{it.grup ? `${it.grup} · ` : ""}{it.label}: </span>
                  <span className="whitespace-pre-wrap">{it.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

function BlokRpb({ k }: { k: KelasLaporan }) {
  if (!k.rpb) return (<><Judul>Rencana Pembelajaran Bulanan (RPB)</Judul><Kosong teks={k.err.rpb ? `Belum bisa dibaca: ${k.err.rpb}` : "Belum ada data."} /></>);
  const { target, pekan } = rpbTampil(k.rpb);
  return (
    <>
      <Judul>Rencana Pembelajaran Bulanan (RPB)</Judul>
      {k.rpb.jumlahPertemuan && <p className="text-xs mt-0.5" style={{ color: C.muted }}>Jumlah pertemuan: {k.rpb.jumlahPertemuan}</p>}
      {target.length > 0 && (
        <>
          <div className="text-xs font-semibold mt-3">Target per bidang</div>
          {target.map((g) => (
            <div key={g.bidang} className="mt-2">
              <div className="text-xs font-semibold" style={{ color: C.green }}>{g.bidang}</div>
              <ul className="mt-0.5 space-y-0.5 text-sm">
                {g.rows.map((r, i) => (
                  <li key={i} className="whitespace-pre-wrap">
                    {r.subItem && <b>{r.subItem}: </b>}{r.target}{r.indikator ? ` — indikator: ${r.indikator}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
      {pekan.length > 0 && (
        <>
          <div className="text-xs font-semibold mt-4">Rencana per pekan</div>
          <div className="overflow-x-auto mt-1.5 rounded-xl" style={{ border: `1px solid ${C.line}` }}>
            <table className="w-full text-xs" style={{ minWidth: 480 }}>
              <thead><tr style={{ background: C.leaf, color: C.muted }}>{["Pekan", "Bidang", "Sub ilmu", "Metode / kegiatan"].map((h) => <th key={h} className="text-left font-semibold px-2.5 py-1.5">{h}</th>)}</tr></thead>
              <tbody>
                {pekan.map((r, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${C.line}` }} className="align-top">
                    <td className="px-2.5 py-1.5">{r.pekan}</td><td className="px-2.5 py-1.5">{r.bidang}</td>
                    <td className="px-2.5 py-1.5">{r.subIlmu}</td><td className="px-2.5 py-1.5 whitespace-pre-wrap">{r.metode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {target.length === 0 && pekan.length === 0 && <Kosong teks="Belum ada isi." />}
    </>
  );
}

function BlokRefleksi({ k }: { k: KelasLaporan }) {
  if (!k.refleksi) return (<><Judul>Refleksi guru</Judul><Kosong teks={k.err.refleksi ? `Belum bisa dibaca: ${k.err.refleksi}` : "Belum ada data."} /></>);
  const r = k.refleksi;
  if (!refleksiTerisi(r)) return (<><Judul>Refleksi guru</Judul><Kosong teks="Belum diisi." /></>);
  const kendalaLabel = ["Kendala", "Dampak", "Penyebab"];
  const rencanaLabel = ["Permasalahan", "Solusi", "Target waktu"];
  const muridLabel = ["Perkembangan", "Tantangan", "Rencana pendampingan"];
  return (
    <>
      <Judul>Refleksi guru</Judul>
      {r.capaianTarget.some((c) => c.some((x) => (x ?? "").trim())) && (
        <div className="mt-2">
          <div className="text-xs font-semibold">Capaian target</div>
          {r.capaianTarget.map((c, i) => {
            const st = c[0] === "TRUE" ? "Ya" : c[1] === "TRUE" ? "Sebagian" : c[2] === "TRUE" ? "Belum" : "";
            const ket = (c[3] ?? "").trim();
            if (!st && !ket) return null;
            return <div key={i} className="text-sm">Target {i + 1}: {st}{ket ? ` — ${ket}` : ""}</div>;
          })}
        </div>
      )}
      {r.keberhasilan.map((t, i) => (t ?? "").trim() ? <Teks key={"b" + i} label={`Keberhasilan ${i + 1}`} value={t} /> : null)}
      {r.kendala.map((row, i) => row.some((x) => (x ?? "").trim()) ? (
        <div key={"k" + i} className="mt-2">
          <div className="text-[11px] font-semibold" style={{ color: C.green }}>Kendala {i + 1}</div>
          {row.map((x, j) => (x ?? "").trim() ? <div key={j} className="text-sm whitespace-pre-wrap"><b>{kendalaLabel[j]}:</b> {x}</div> : null)}
        </div>
      ) : null)}
      {r.evaluasiDiri.some((x) => (x ?? "").trim()) && (
        <Teks label="Evaluasi diri (skor butir 1–8)" value={r.evaluasiDiri.map((x, i) => `${i + 1}: ${x || "—"}`).join("   ")} />
      )}
      {r.refleksiGuru.map((t, i) => (t ?? "").trim() ? <Teks key={"r" + i} label={`Refleksi ${i + 1}`} value={t} /> : null)}
      {r.rencanaPerbaikan.map((row, i) => row.some((x) => (x ?? "").trim()) ? (
        <div key={"p" + i} className="mt-2">
          <div className="text-[11px] font-semibold" style={{ color: C.green }}>Rencana perbaikan {i + 1}</div>
          {row.map((x, j) => (x ?? "").trim() ? <div key={j} className="text-sm whitespace-pre-wrap"><b>{rencanaLabel[j]}:</b> {x}</div> : null)}
        </div>
      ) : null)}
      {r.perkembanganMurid.filter((row) => (row[0] ?? "").trim()).map((row, i) => (
        <div key={"m" + i} className="mt-3 rounded-xl p-3" style={{ background: C.mist, border: `1px solid ${C.line}` }}>
          <div className="text-sm font-semibold">{row[0]}</div>
          {muridLabel.map((l, j) => (row[j + 1] ?? "").trim() ? <div key={j} className="text-sm whitespace-pre-wrap mt-1"><b>{l}:</b> {row[j + 1]}</div> : null)}
          {![1, 2, 3].some((j) => (row[j] ?? "").trim()) && <Kosong teks="Belum diisi." />}
        </div>
      ))}
    </>
  );
}

function BlokTasmi({ k }: { k: KelasLaporan }) {
  return (
    <>
      <Judul>Tasmi' bulan ini</Judul>
      {k.tasmi.length === 0 ? (
        <Kosong teks="Belum ada tasmi' di bulan ini." />
      ) : (
        <div className="overflow-x-auto mt-1.5 rounded-xl" style={{ border: `1px solid ${C.line}` }}>
          <table className="w-full text-xs" style={{ minWidth: 420 }}>
            <thead><tr style={{ background: C.leaf, color: C.muted }}>{["Tanggal", "Santri", "Juz", "Penyimak", "Salah"].map((h) => <th key={h} className="text-left font-semibold px-2.5 py-1.5">{h}</th>)}</tr></thead>
            <tbody>
              {k.tasmi.map((t, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}>
                  <td className="px-2.5 py-1.5">{t.tanggal}</td><td className="px-2.5 py-1.5">{t.nama_santri}</td>
                  <td className="px-2.5 py-1.5">{t.juz || "—"}</td><td className="px-2.5 py-1.5">{t.nama_guru || "—"}</td>
                  <td className="px-2.5 py-1.5">{t.jumlah_kesalahan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
