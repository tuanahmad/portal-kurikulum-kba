import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { C } from "../data";
import { readTasmiById, type TasmiRecord } from "../lib/tasmi";
import { FullPageSkeleton } from "../components/Skeleton";
import { kelompokSantri } from "../lib/roster";
import { SyahadahBingkai } from "../components/SyahadahBingkai";

/** Nama mudir (kepala) kuttab, tercetak otomatis di kolom tanda tangan sertifikat. Kosong = ditulis tangan. */
const NAMA_MUDIR = "Anindra Muhammad Azmi";

/** Laki-laki/perempuan: utamakan penanda kelompok santri di roster database (santri_roster.kelompok) -- penting untuk
 *  kelas Kuttab Awwal yang campur. Kalau penandanya belum ada, baru tebak dari nama kelas (kelas "... Ikhwan"). */
function isMale(kelas: string | null, nama: string): boolean {
  const k = kelas ? kelompokSantri(kelas, nama) : null;
  if (k) return k === "ikhwan";
  return !!kelas?.includes("Ikhwan");
}

function binOrBinti(male: boolean): "bin" | "binti" {
  return male ? "bin" : "binti";
}

/** Tanggal dalam angka & nama bulan Arab (Intl bawaan browser) -- "٢٨ سبتمبر ٢٠٢٦". */
function labelTanggalArab(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00`);
  return d.toLocaleDateString("ar", { day: "numeric", month: "long", year: "numeric" });
}

export default function TasmiSertifikatPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [sp] = useSearchParams();
  const kelas = sp.get("kelas");
  const [record, setRecord] = useState<TasmiRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Sertifikat selalu dirender 297mm penuh (ukuran A4); di layar sempit (HP) cuma DITAMPILKAN diperkecil agar muat selebar
  // layar. Ukuran huruf memakai satuan cqw (mengikuti lebar sertifikat sendiri), jadi isinya ikut mengecil dengan rapi.
  const LEBAR_SERTIFIKAT_PX = 1122.52;
  const [skala, setSkala] = useState(1);
  useEffect(() => {
    const hitung = () => setSkala(Math.min(1, (window.innerWidth - 32) / LEBAR_SERTIFIKAT_PX));
    hitung();
    window.addEventListener("resize", hitung);
    return () => window.removeEventListener("resize", hitung);
  }, []);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfGalat, setPdfGalat] = useState<string | null>(null);

  /** Simpan sertifikat sebagai PDF berisi GAMBAR (satu halaman A4 lanskap): hasilnya persis seperti di layar, tanpa dialog cetak. */
  async function simpanPdf() {
    const node = document.querySelector<HTMLElement>(".cert-page");
    if (!node || !record) return;
    setPdfBusy(true);
    setPdfGalat(null);
    try {
      await document.fonts.ready;
      const [{ toPng }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
      const gambar = await toPng(node, { pixelRatio: 2, cacheBust: true, backgroundColor: "#FFFFFF", style: { boxShadow: "none", margin: "0" } });
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
      pdf.addImage(gambar, "PNG", 0, 0, 297, 210, undefined, "FAST");
      const nama = record.nama_santri.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
      pdf.save(`Syahadah-${nama || "santri"}.pdf`);
    } catch (e) {
      setPdfGalat("Gagal membuat PDF: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPdfBusy(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    readTasmiById(id)
      .then((r) => {
        if (cancelled) return;
        if (!r) {
          setError("Catatan tasmi' gak ketemu.");
          return;
        }
        setRecord(r);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: C.mist }}>
        <FullPageSkeleton />
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-3" style={{ background: C.mist }}>
        <p className="text-sm" style={{ color: C.muted }}>{error || "Catatan gak ketemu."}</p>
        <button
          onClick={() => navigate(-1)}
          className="text-sm font-semibold px-4 py-2 rounded-xl"
          style={{ background: C.leaf, color: C.green }}
        >
          Kembali
        </button>
      </div>
    );
  }

  const male = isMale(kelas, record.nama_santri);
  const sapaan = binOrBinti(male);
  const namaLengkap = record.nama_ayah
    ? `${record.nama_santri} ${sapaan} ${record.nama_ayah}`
    : record.nama_santri;

  return (
    <div className="min-h-dvh" style={{ background: "#EFEAD9" }}>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Aref+Ruqaa:wght@400;700&family=Playfair+Display:wght@600;700&display=swap"
      />
      <style>{`
        /* Cetak / Simpan PDF: tepat SATU halaman A4 lanskap, hanya sertifikatnya. Elemen lain (menu bawah, tombol profil,
           latar pola, jarak halaman) disembunyikan dan tidak memakan tempat, jadi tidak ada halaman kosong kedua. */
        @media print {
          @page { size: A4 landscape; margin: 0; }
          html, body { width: 297mm !important; height: 210mm !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; background: #fff !important; }
          body * { visibility: hidden !important; }
          .min-h-dvh::before { display: none !important; }
          .cert-page, .cert-page * { visibility: visible !important; }
          .cert-page {
            position: fixed !important; left: 0 !important; top: 0 !important;
            width: 297mm !important; height: 210mm !important; aspect-ratio: auto !important;
            margin: 0 !important; box-shadow: none !important;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }
        }

        .syh { position: relative; width: 297mm; aspect-ratio: 297 / 210; background: linear-gradient(180deg, #FFFFFF 0%, #FBFAF6 100%); box-shadow: 0 12px 40px rgba(31,45,77,.2); overflow: hidden; font-family: 'Amiri', serif; color: #262A33; container-type: inline-size; flex-shrink: 0; }
        .syh-isi { position: absolute; inset: 8% 10% 13% 10%; display: flex; flex-direction: column; align-items: center; text-align: center; }
        .syh-basmalah { font-family: 'Aref Ruqaa', serif; font-size: 2.1cqw; margin-top: 1.2%; color: #1F2D4D; }
        .syh-judul { font-family: 'Aref Ruqaa', serif; font-weight: 700; font-size: 5.2cqw; line-height: 1.15; color: #1F2D4D; margin-top: 3.9%; }
        .syh-garis { display: flex; align-items: center; gap: 1.2%; width: 15%; margin: .4% 0 0; color: #B4553A; }
        .syh-garis i { flex: 1; height: 1px; background: currentColor; }
        .syh-garis b { width: .9cqw; height: .9cqw; transform: rotate(45deg); background: currentColor; }
        .syh-menyaksikan { font-size: 2.15cqw; margin-top: 7%; }
        .syh-nama { font-family: 'Playfair Display', serif; font-weight: 700; font-size: 3.1cqw; color: #1F2D4D; margin-top: .8%; direction: ltr; padding: 0 3% .5%; border-bottom: 2px solid #7F8AA3; }
        .syh-kelas { font-size: 1.75cqw; margin-top: 1%; color: #59607A; }
        .syh-kelas span { direction: ltr; unicode-bidi: isolate; display: inline-block; font-family: 'Playfair Display', serif; color: #1F2D4D; font-weight: 600; }
        .syh-uraian { font-size: 2.1cqw; line-height: 1.85; margin-top: 1.2%; max-width: 94%; }
        .syh-uraian strong { color: #1F2D4D; }
        .syh-uraian .ltr { direction: ltr; unicode-bidi: isolate; display: inline-block; font-family: 'Playfair Display', serif; color: #7F8AA3; font-weight: 700; }
        .syh-rinci { font-size: 1.5cqw; color: #59607A; margin-top: .6%; }
        .syh-rinci .ltr { direction: ltr; unicode-bidi: isolate; display: inline-block; font-family: 'Playfair Display', serif; font-weight: 600; color: #1F2D4D; }
        .syh-doa { font-size: 1.6cqw; font-style: italic; color: #6B7288; margin-top: .8%; max-width: 86%; line-height: 1.8; }
        .syh-ttd { margin-top: auto; width: 100%; display: grid; grid-template-columns: 1fr 1fr 1fr; align-items: end; }
        .syh-blok { display: flex; flex-direction: column; align-items: center; }
        .syh-peran { font-size: 1.55cqw; color: #6B7288; }
        .syh-garisttd { width: 70%; border-bottom: 1px solid #8A91A5; height: 4.6cqw; }
        .syh-nama-ttd { font-family: 'Playfair Display', serif; font-size: 1.45cqw; font-weight: 600; margin-top: .5%; direction: ltr; min-height: 1.8cqw; }
        .syh-cap { width: 7.2cqw; height: 7.2cqw; border: 1.5px dashed rgba(127,138,163,.8); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: rgba(127,138,163,.8); font-size: 1.3cqw; }
      `}</style>

      {/* Toolbar — hilang pas print */}
      <div className="no-print flex items-center justify-between max-w-4xl mx-auto px-4 py-4">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "#FFF", border: `1px solid ${C.line}`, color: C.green }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          onClick={simpanPdf}
          disabled={pdfBusy}
          className="text-sm font-semibold px-4 py-2.5 rounded-xl"
          style={{ background: C.green, color: "#FFF", opacity: pdfBusy ? 0.6 : 1 }}
        >
          {pdfBusy ? "Menyiapkan PDF…" : "Simpan PDF"}
        </button>
      </div>

      {/* Layar sempit (HP): sertifikatnya SELALU dirender di ukuran penuh (297mm), gak disusutkan
          sama sekali -- kalau disusutkan (maxWidth:100%), font clamp()-nya yang berbasis vw (lebar
          viewport HP, bukan lebar kotak sertifikat) jadi kegedean dibanding kotaknya sendiri, jadi
          overflow dan kepotong overflow:hidden. Solusinya: biarin penuh, scroll aja kayak liat PDF
          di HP (horizontal manual, vertical ngikut scroll halaman). */}
      {pdfGalat && (
        <p className="no-print text-center text-xs mb-2" style={{ color: "#8A2A20" }}>
          {pdfGalat}
        </p>
      )}
      <div className="flex justify-center px-4 pb-10">
        <div style={{ width: LEBAR_SERTIFIKAT_PX * skala, height: (LEBAR_SERTIFIKAT_PX * 210 / 297) * skala }}>
          <div style={{ transform: `scale(${skala})`, transformOrigin: "top left", width: "297mm" }}>
            <Certificate record={record} namaLengkap={namaLengkap} male={male} kelas={kelas} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Certificate({
  record,
  namaLengkap,
  male,
  kelas,
}: {
  record: TasmiRecord;
  namaLengkap: string;
  male: boolean;
  kelas: string | null;
}) {
  // Gelar pembimbing mengikuti GURU-nya (dari nama: "Ustadzah ..." / "Ustadz ..."), bukan santrinya -- kelas campur
  // bisa diajar guru berbeda jenis kelamin. Kalau nama tidak menyebut gelar, ikut jenis kelamin santri.
  const guruPerempuan = /^\s*(ustadzah|ustazah|ustadzat|ummi|bu)\b/i.test(record.nama_guru ?? "");
  const guruLaki = /^\s*(ustadz|ustaz|abi|pak)\b/i.test(record.nama_guru ?? "");
  const guruPutra = guruPerempuan ? false : guruLaki ? true : male;
  const ustadz = guruPutra ? "الْأُسْتَاذِ" : "الْأُسْتَاذَةِ";
  const talib = male ? "الطَّالِبَ" : "الطَّالِبَةَ";
  const atamma = male ? "أَتَمَّ" : "أَتَمَّتْ";
  const lahu = male ? "لَهُ" : "لَهَا";
  const yarzuqahu = male ? "يَرْزُقَهُ" : "يَرْزُقَهَا";
  const yajaalahu = male ? "يَجْعَلَهُ" : "يَجْعَلَهَا";
  const juz = (record.juz || "").match(/\d+/)?.[0];
  const guru = record.nama_guru || "";

  return (
    <div className="cert-page syh" dir="rtl">
      <SyahadahBingkai />

      <div className="syh-isi">
        <div className="syh-basmalah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
        <div className="syh-judul">الشَّهَادَة</div>

        <div className="syh-menyaksikan">يَشْهَدُ كُتَّابُ بُودِي أَزْهَرِي بِأَنَّ {talib}</div>
        <div className="syh-nama">{namaLengkap}</div>
        {kelas && (
          <div className="syh-kelas">
            مِنْ فَصْلِ: <span>{kelas}</span>
          </div>
        )}

        <div className="syh-uraian">
          قَدْ {atamma} تَسْمِيعَ {juz ? (<><strong>الْجُزْءِ</strong> <span className="ltr">{juz}</span> مِنَ </>) : null}الْقُرْآنِ الْكَرِيمِ بِإِشْرَافِ <strong>{ustadz}</strong>
          {guru && <> <span className="ltr">{guru}</span></>}
          <br />
          بِتَارِيخِ <strong>{labelTanggalArab(record.tanggal)}</strong>
        </div>
        {(record.durasi || record.jumlah_kesalahan != null) && (
          <div className="syh-rinci">
            {record.durasi ? <>الْمُدَّةُ: <span className="ltr">{record.durasi}</span></> : null}
            {record.durasi && record.jumlah_kesalahan != null ? "  ·  " : null}
            {record.jumlah_kesalahan != null ? <>عَدَدُ الْأَخْطَاءِ: <span className="ltr">{record.jumlah_kesalahan}</span></> : null}
          </div>
        )}
        <div className="syh-doa">
          بَارَكَ اللَّهُ {lahu}، وَنَسْأَلُ اللَّهَ أَنْ {yarzuqahu} حُبَّ الْقُرْآنِ دَائِمًا، وَ{yajaalahu} مِنْ أَهْلِ الْقُرْآنِ وَخَاصَّتِهِ.
        </div>

        <div className="syh-ttd">
          <div className="syh-blok">
            <div className="syh-peran">مُرَبِّي الْحِفْظِ</div>
            <div className="syh-garisttd" />
            <div className="syh-nama-ttd">{guru}</div>
          </div>
          <div className="syh-blok">
            <div className="syh-cap">ختم</div>
            <div className="syh-peran" style={{ marginTop: ".6cqw" }}>خَتْمُ الْمُؤَسَّسَةِ</div>
          </div>
          <div className="syh-blok">
            <div className="syh-peran">مُدِيرُ الْكُتَّابِ</div>
            <div className="syh-garisttd" />
            <div className="syh-nama-ttd">{NAMA_MUDIR}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
