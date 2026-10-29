import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { C, isMonthOpen } from "../data";
import { BackButton } from "../components/PortalComponents";
import { MonthGrid } from "../components/MonthGrid";
import { LaporanKbm } from "../components/LaporanKbm";
import { muatPeriode, periodeBulan, periodeTriwulan, bacaKesimpulan, perbaruiIlmu, TRIWULAN, type NilaiBulan } from "../lib/penilaianKbm";

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
              <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.7" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
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

/** Gembok animasi: saat halaman terbuka, gagangnya berayun terbuka ke kanan (sumbu di kaki kiri,
 *  seperti gembok sungguhan); saat ditekan gagangnya berayun balik mengunci dulu, baru halaman ditutup. */
function Gembok({ terkunci }: { terkunci: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g
        style={{
          transformBox: "view-box",
          transformOrigin: "8px 11px",
          transform: terkunci ? "rotate(0deg)" : "rotate(-34deg)",
          transition: "transform 480ms cubic-bezier(0.34, 1.56, 0.64, 1)",
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

/** Isi Sajian Data (management): Laporan KBM per bulan atau per 3 bulan (triwulan) dari data yang diisi guru --
 *  narasi otomatis, tabel, grafik, kesimpulan tim kurikulum, dan lampiran -- tampil di layar dan bisa diunduh PDF.
 *  Hanya membaca data, kecuali kolom Kesimpulan dan Evaluasi. Penilaian: lib/penilaianKbm.ts. */
function SajianDataIsi({ onKunci }: { onKunci: () => void }) {
  const [jenis, setJenis] = useState<"bulan" | "triwulan">("bulan");
  const [bulan, setBulan] = useState<string | null>(null);
  const [tw, setTw] = useState<number | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [mengunci, setMengunci] = useState(false);
  const [terbuka, setTerbuka] = useState(false); // mulai tertutup, lalu "membuka" begitu halaman masuk
  useEffect(() => {
    const t = window.setTimeout(() => setTerbuka(true), 350);
    return () => window.clearTimeout(t);
  }, []);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  function kunciDenganAnimasi() {
    if (mengunci) return;
    setMengunci(true);
    timer.current = window.setTimeout(onKunci, 750); // beri waktu gembok berayun mengunci dulu
  }

  const periode = useMemo(
    () => (jenis === "bulan" ? (bulan ? periodeBulan(bulan) : null) : tw != null ? periodeTriwulan(tw) : null),
    [jenis, bulan, tw]
  );
  const [data, setData] = useState<NilaiBulan[] | null>(null);
  const [kesimpulan, setKesimpulan] = useState("");
  const [prog, setProg] = useState<{ selesai: number; total: number; bulan: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    if (!periode || !periode.bulan.length) return;
    let batal = false;
    setData(null);
    setError(null);
    setProg({ selesai: 0, total: 1, bulan: periode.bulan[0] });
    Promise.all([muatPeriode(periode, (p) => !batal && setProg(p)), bacaKesimpulan(periode.kunci)])
      .then(([d, k]) => {
        if (batal) return;
        setData(d);
        setKesimpulan(k);
      })
      .catch((e) => !batal && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => !batal && setProg(null));
    return () => {
      batal = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periode?.kunci]);

  /** Tim kurikulum menyimpan tanda per target: nilai ilmu bulan itu disusun ulang (tanpa membaca ulang Google Sheet). */
  async function tandaBerubah(bulanIni: string) {
    if (!data) return;
    setData(await Promise.all(data.map((d) => (d.bulan === bulanIni ? perbaruiIlmu(d) : d))));
  }

  async function unduh() {
    if (!data || !periode) return;
    setPdfBusy(true);
    setError(null);
    try {
      const { unduhPdfLaporanKbm } = await import("../lib/laporanKbmPdf");
      await unduhPdfLaporanKbm(periode, data, kesimpulan);
    } catch (e) {
      setError("Gagal membuat PDF: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPdfBusy(false);
    }
  }

  const pilihan = (aktif: boolean) => ({ background: aktif ? C.green : "#FFF", color: aktif ? "#FFF" : C.green, border: `1px solid ${aktif ? C.green : C.line}` });

  return (
    <div className="min-h-dvh" style={{ background: C.mist, color: C.ink }}>
      <div className="max-w-3xl mx-auto px-4 pt-6 sm:pt-9 pb-32 sm:pb-40">
        <BackButton to="/home" label="Home" />
        <header className="mt-4 text-center">
          <div className="flex flex-col items-center gap-3">
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
                <Gembok terkunci={mengunci || !terbuka} />
              </button>
            </div>
          </div>
          <p className="text-sm mt-1" style={{ color: C.muted }}>
            Laporan Kegiatan Belajar dan Mengajar per bulan atau per 3 bulan: narasi, tabel, grafik, kesimpulan, dan lampiran. Pilih periode, lihat, lalu unduh PDF.
          </p>
        </header>

        {pinOpen && <GantiPinPanel onTutup={() => setPinOpen(false)} />}

        <div className="mt-5">
          <span className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: C.green }}>Jenis laporan</span>
          <div className="grid grid-cols-2 gap-2">
            {(["bulan", "triwulan"] as const).map((j) => (
              <button key={j} type="button" onClick={() => setJenis(j)} className="py-2.5 rounded-xl text-sm font-semibold" style={pilihan(jenis === j)}>
                {j === "bulan" ? "Bulanan" : "Triwulan (3 bulan)"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <span className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: C.green }}>{jenis === "bulan" ? "Bulan" : "Triwulan"}</span>
          {jenis === "bulan" ? (
            <MonthGrid months={BULAN_12} value={bulan} onSelect={setBulan} isOpen={isMonthOpen} />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TRIWULAN.map((b, i) => {
                const buka = periodeTriwulan(i).bulan.length > 0;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!buka}
                    onClick={() => setTw(i)}
                    className="py-2.5 px-2 rounded-xl text-xs font-semibold disabled:opacity-40"
                    style={pilihan(tw === i)}
                  >
                    {b[0]} – {b[2]}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-xl px-3.5 py-2.5 text-xs" style={{ background: BAD_BG, border: "1px solid #E8A6A0", color: "#8A2A20" }}>
            {error}
          </div>
        )}

        {prog && (
          <div className="mt-5 p-4" style={card}>
            <div className="text-sm font-semibold" style={{ color: C.ink }}>Mengumpulkan data {prog.bulan}…</div>
            <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: C.leaf }}>
              <div className="h-2 rounded-full transition-all" style={{ width: `${Math.round((prog.selesai / Math.max(prog.total, 1)) * 100)}%`, background: C.green }} />
            </div>
            <div className="text-xs mt-1.5" style={{ color: C.muted }}>
              {Math.round((prog.selesai / Math.max(prog.total, 1)) * 100)}%{jenis === "triwulan" ? " · laporan 3 bulan membaca banyak file, bisa 1–3 menit" : ""}
            </div>
          </div>
        )}

        {data && periode && (
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
            <LaporanKbm key={periode.kunci} periode={periode} data={data} kesimpulan={kesimpulan} setKesimpulan={setKesimpulan} bisaUbah onTandaBerubah={tandaBerubah} />
          </>
        )}
      </div>
    </div>
  );
}
