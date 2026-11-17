import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { C } from "../data";
import { useAuth } from "../contexts/AuthContext";
import { BackButton } from "../components/PortalComponents";
import { PageLoadingSkeleton } from "../components/Skeleton";
import { toast } from "../components/Toast";
import { ymd, NAMA_BULAN } from "../lib/jurnal";
import { PENGINGAT, bacaKekuranganPekanIni, pengingatRutin, type Pengingat } from "../lib/pengingat";
import { JENIS, JENIS_URUT, acaraPadaTanggal, bacaAcara, hapusAcara, labelRentangAcara, simpanAcara, type Acara, type JenisAcara } from "../lib/kalender";

const HARI_SINGKAT = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Ahd"];
type Form = { id?: string; judul: string; jenis: JenisAcara; tanggal_mulai: string; tanggal_selesai: string; catatan: string };

export default function KalenderPage() {
  const { role, session } = useAuth();
  const boleh = role === "management";
  const userId = session?.user?.id;
  const tampilPengingat = role === "guru" || role === "management";
  const [kurang, setKurang] = useState<{ jumat: string; hari: string[] } | null>(null);
  const hariIni = ymd(new Date());
  const [bulan, setBulan] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [acara, setAcara] = useState<Acara[]>([]);
  const [loading, setLoading] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [dipilih, setDipilih] = useState<string | null>(hariIni);
  const [form, setForm] = useState<Form | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const awal = ymd(new Date(bulan.getFullYear(), bulan.getMonth(), 1));
  const akhir = ymd(new Date(bulan.getFullYear(), bulan.getMonth() + 1, 0));

  async function muat() {
    setLoading(true);
    setGalat(null);
    try {
      setAcara(await bacaAcara(awal, akhir));
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal memuat kalender.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    muat();
  }, [awal]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (role !== "guru" || !userId) return;
    bacaKekuranganPekanIni(userId).then(setKurang).catch(() => {});
  }, [role, userId]);

  /** Pengingat rutin di satu tanggal (+ "lengkapi jurnal dan absen" di Jumat pekan ini bagi guru yang masih kurang). */
  function pengingatHari(tgl: string): Pengingat[] {
    if (!tampilPengingat) return [];
    const r = pengingatRutin(new Date(tgl + "T00:00:00"));
    if (role === "guru" && kurang && kurang.jumat === tgl && kurang.hari.length > 0) r.push(PENGINGAT.lengkapi);
    return r;
  }

  // Sel kalender: Senin di kolom pertama.
  const sel = useMemo(() => {
    const hariPertama = new Date(bulan.getFullYear(), bulan.getMonth(), 1);
    const geser = (hariPertama.getDay() + 6) % 7;
    const jumlah = new Date(bulan.getFullYear(), bulan.getMonth() + 1, 0).getDate();
    const out: (string | null)[] = Array(geser).fill(null);
    for (let d = 1; d <= jumlah; d++) out.push(ymd(new Date(bulan.getFullYear(), bulan.getMonth(), d)));
    while (out.length % 7) out.push(null);
    return out;
  }, [bulan]);

  const pindah = (n: number) => {
    setBulan((b) => new Date(b.getFullYear(), b.getMonth() + n, 1));
    setDipilih(null);
  };
  const daftar = dipilih ? acara.filter((a) => acaraPadaTanggal(a, dipilih)) : acara;

  function tambah(tgl: string) {
    setForm({ judul: "", jenis: "kegiatan", tanggal_mulai: tgl, tanggal_selesai: tgl, catatan: "" });
  }

  async function simpan() {
    if (!form) return;
    if (!form.judul.trim()) return toast.galat("Judul belum diisi.");
    if (form.tanggal_selesai < form.tanggal_mulai) return toast.galat("Tanggal selesai tidak boleh sebelum tanggal mulai.");
    setSibuk(true);
    try {
      await simpanAcara(form);
      setForm(null);
      toast.sukses("Tersimpan.");
      await muat();
    } catch (e) {
      toast.galat(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSibuk(false);
    }
  }

  async function hapus() {
    if (!form?.id || !window.confirm(`Hapus "${form.judul}"?`)) return;
    setSibuk(true);
    try {
      await hapusAcara(form.id);
      setForm(null);
      toast.sukses("Dihapus.");
      await muat();
    } catch (e) {
      toast.galat(e instanceof Error ? e.message : "Gagal menghapus.");
    } finally {
      setSibuk(false);
    }
  }

  const input = "w-full rounded-xl px-3 py-2 text-sm outline-none";
  const inputStyle = { background: C.card, border: `1px solid ${C.line}`, color: C.ink } as const;

  return (
    <div className="min-h-dvh" style={{ background: C.mist, color: C.ink }}>
      <div className="max-w-xl mx-auto px-4 pt-6 sm:pt-9 pb-32">
        <header className="relative flex flex-col items-center justify-center text-center px-12 min-h-[44px]">
          <BackButton to="/home" label="Beranda" className="absolute left-0 inset-y-0 my-auto" />
          <h1 className="text-xl sm:text-2xl font-semibold" style={{ color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}>Kalender</h1>
        </header>

        {/* Pindah bulan */}
        <div className="mt-5 flex items-center gap-2">
          <button type="button" onClick={() => pindah(-1)} aria-label="Bulan sebelumnya" className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: C.card, border: `1px solid ${C.line}`, color: C.green }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div className="flex-1 text-center text-base font-semibold" style={{ color: C.ink }}>{NAMA_BULAN[bulan.getMonth()]} {bulan.getFullYear()}</div>
          <button type="button" onClick={() => pindah(1)} aria-label="Bulan berikutnya" className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: C.card, border: `1px solid ${C.line}`, color: C.green }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>

        {/* Grid bulan */}
        <div className="mt-3 rounded-2xl p-2.5" style={{ background: C.card, border: `1px solid ${C.line}` }}>
          <div className="grid grid-cols-7 text-center text-[10px] font-bold uppercase tracking-wider pb-1.5" style={{ color: C.muted }}>
            {HARI_SINGKAT.map((h) => <div key={h}>{h}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {sel.map((tgl, i) => {
              if (!tgl) return <div key={i} />;
              const hariKe = Number(tgl.slice(8));
              const jenisHari = JENIS_URUT.filter((j) => acara.some((a) => a.jenis === j && acaraPadaTanggal(a, tgl)));
              const pHari = pengingatHari(tgl);
              const libur = jenisHari.includes("libur");
              const akhirPekan = i % 7 >= 5;
              const aktif = dipilih === tgl;
              const hari = tgl === hariIni;
              return (
                <button
                  key={tgl}
                  type="button"
                  onClick={() => setDipilih(aktif ? null : tgl)}
                  aria-label={`${hariKe} ${NAMA_BULAN[bulan.getMonth()]}${jenisHari.length ? ", ada " + jenisHari.map((j) => JENIS[j].label).join(", ") : ""}${pHari.length ? ", pengingat: " + pHari.map((p) => p.judul).join(", ") : ""}`}
                  aria-pressed={aktif}
                  className="mx-auto w-10 h-11 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors"
                  style={{
                    background: aktif ? C.green : libur ? JENIS.libur.latar : "transparent",
                    color: aktif ? "#FFF" : libur ? JENIS.libur.warna : akhirPekan ? C.muted : C.ink,
                    border: hari && !aktif ? `1.5px solid ${C.green}` : "1.5px solid transparent",
                  }}
                >
                  <span className="text-sm font-semibold leading-none">{hariKe}</span>
                  <span className="flex gap-0.5 h-1.5">
                    {jenisHari.map((j) => <span key={j} className="w-1.5 h-1.5 rounded-full" style={{ background: aktif ? "#FFF" : JENIS[j].warna }} />)}
                    {pHari.map((p) => <span key={p.key} className="w-1.5 h-1.5 rounded-full" style={{ background: aktif ? "#FFF" : p.warna }} />)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Daftar acara */}
        <div className="mt-5 flex items-center justify-between gap-2 px-1">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: C.green }}>
            {dipilih ? `Tanggal ${Number(dipilih.slice(8))} ${NAMA_BULAN[bulan.getMonth()]}` : `Acara ${NAMA_BULAN[bulan.getMonth()]}`}
          </h2>
          {boleh && (
            <button type="button" onClick={() => tambah(dipilih ?? awal)} className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: C.green, color: "#FFF" }}>
              + Tambah
            </button>
          )}
        </div>

        {galat && <div className="mt-3 rounded-xl px-3.5 py-2.5 text-xs" style={{ background: "var(--c-bahayaBg)", border: "1px solid var(--c-bahayaGaris)", color: "var(--c-bahayaTeks)" }}>{galat}</div>}
        {dipilih && pengingatHari(dipilih).length > 0 && (
          <ul className="mt-2.5 space-y-2">
            {pengingatHari(dipilih).map((p) => (
              <li key={p.key} className="flex gap-3 rounded-2xl p-3" style={{ background: p.latar, border: `1px solid color-mix(in srgb, ${p.warna} 28%, transparent)` }}>
                <span className="shrink-0 w-1.5 self-stretch rounded-full" style={{ background: p.warna }} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold" style={{ color: p.warna }}>{p.judul}</div>
                  {p.key === "lengkapi" && kurang && <div className="text-xs mt-0.5" style={{ color: C.ink }}>{kurang.hari.length} hari pekan ini belum lengkap.</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
        {loading ? (
          <div className="mt-3"><PageLoadingSkeleton /></div>
        ) : daftar.length === 0 ? (
          dipilih && pengingatHari(dipilih).length > 0 ? null : <p className="mt-3 text-center text-sm" style={{ color: C.muted }}>{dipilih ? "Tidak ada acara di tanggal ini." : "Belum ada acara bulan ini."}</p>
        ) : (
          <ul className="mt-2.5 space-y-2">
            {daftar.map((a) => {
              const j = JENIS[a.jenis];
              const isi = (
                <>
                  <span className="shrink-0 w-1.5 self-stretch rounded-full" style={{ background: j.warna }} />
                  <div className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: C.ink }}>{a.judul}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: j.latar, color: j.warna }}>{j.label}</span>
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: C.muted }}>{labelRentangAcara(a)}</div>
                    {a.catatan && <p className="text-xs mt-1 whitespace-pre-wrap" style={{ color: C.ink }}>{a.catatan}</p>}
                  </div>
                </>
              );
              const gaya = { background: C.card, border: `1px solid ${C.line}` };
              return (
                <li key={a.id}>
                  {boleh ? (
                    <button type="button" onClick={() => setForm({ id: a.id, judul: a.judul, jenis: a.jenis, tanggal_mulai: a.tanggal_mulai, tanggal_selesai: a.tanggal_selesai, catatan: a.catatan ?? "" })} className="w-full flex gap-3 rounded-2xl p-3" style={gaya}>{isi}</button>
                  ) : (
                    <div className="flex gap-3 rounded-2xl p-3" style={gaya}>{isi}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {tampilPengingat && (
          <div className="mt-6 rounded-2xl p-3.5" style={{ background: C.card, border: `1px solid ${C.line}` }}>
            <div className="text-xs font-bold uppercase tracking-wider" style={{ color: C.green }}>Pengingat rutin</div>
            <ul className="mt-2 space-y-1.5 text-sm" style={{ color: C.ink }}>
              {[
                [PENGINGAT.quran, "Setiap Jumat"],
                [PENGINGAT.akhirBulan, "Akhir bulan (tanggal 30 atau 31)"],
                [PENGINGAT.rpb, "Tanggal 1-5 setiap bulan"],
                ...(role === "guru" ? [[PENGINGAT.lengkapi, "Setiap Jumat, bila jurnal atau absen belum lengkap"]] : []),
              ].map(([p, kapan]) => (
                <li key={(p as Pengingat).key} className="flex items-start gap-2">
                  <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: (p as Pengingat).warna }} />
                  <span><span className="font-semibold">{(p as Pengingat).judul}</span> <span style={{ color: C.muted }}>· {kapan as string}</span></span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Form tambah / ubah (management) */}
      {form && createPortal(
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center" style={{ background: "rgba(20,40,30,0.45)" }} onClick={() => !sibuk && setForm(null)}>
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl p-4 pb-6 max-h-[90dvh] overflow-y-auto" style={{ background: C.mist }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={form.id ? "Ubah acara" : "Tambah acara"}>
            <h3 className="text-base font-semibold text-center" style={{ color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}>{form.id ? "Ubah acara" : "Tambah acara"}</h3>
            <div className="mt-3 space-y-3">
              <label className="block text-xs font-semibold" style={{ color: C.muted }}>
                Judul
                <input className={input + " mt-1"} style={inputStyle} value={form.judul} maxLength={120} onChange={(e) => setForm({ ...form, judul: e.target.value })} placeholder="mis. Libur Maulid Nabi" />
              </label>
              <div>
                <div className="text-xs font-semibold" style={{ color: C.muted }}>Jenis</div>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {JENIS_URUT.map((j) => (
                    <button key={j} type="button" onClick={() => setForm({ ...form, jenis: j })} aria-pressed={form.jenis === j} className="py-2 rounded-xl text-sm font-semibold" style={{ background: form.jenis === j ? JENIS[j].warna : C.card, color: form.jenis === j ? "#FFF" : JENIS[j].warna, border: `1.5px solid ${JENIS[j].warna}` }}>
                      {JENIS[j].label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-semibold" style={{ color: C.muted }}>
                  Mulai
                  <input type="date" className={input + " mt-1"} style={inputStyle} value={form.tanggal_mulai} onChange={(e) => setForm({ ...form, tanggal_mulai: e.target.value, tanggal_selesai: form.tanggal_selesai < e.target.value ? e.target.value : form.tanggal_selesai })} />
                </label>
                <label className="block text-xs font-semibold" style={{ color: C.muted }}>
                  Selesai
                  <input type="date" className={input + " mt-1"} style={inputStyle} value={form.tanggal_selesai} min={form.tanggal_mulai} onChange={(e) => setForm({ ...form, tanggal_selesai: e.target.value })} />
                </label>
              </div>
              <label className="block text-xs font-semibold" style={{ color: C.muted }}>
                Catatan (boleh kosong)
                <textarea className={input + " mt-1"} style={inputStyle} rows={2} value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} />
              </label>
              {form.jenis === "libur" && <p className="text-[11px]" style={{ color: C.muted }}>Tanggal libur tidak dihitung sebagai hari efektif di PDF kehadiran.</p>}
            </div>
            <div className="mt-4 flex gap-2">
              {form.id && <button type="button" onClick={hapus} disabled={sibuk} className="px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "var(--c-bahayaBg)", color: "var(--c-bahaya)" }}>Hapus</button>}
              <button type="button" onClick={() => setForm(null)} disabled={sibuk} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: C.card, border: `1px solid ${C.line}`, color: C.ink }}>Batal</button>
              <button type="button" onClick={simpan} disabled={sibuk} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: C.green, color: "#FFF", opacity: sibuk ? 0.6 : 1 }}>{sibuk ? "Menyimpan…" : "Simpan"}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
