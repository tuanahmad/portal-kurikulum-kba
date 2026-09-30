import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { C, LOGO } from "../data";
import { readTasmiById, type TasmiRecord } from "../lib/tasmi";
import { PageLoadingSkeleton } from "../components/Skeleton";

/** Kelas Qonuni dipisah Ikhwan/Akhwat -- dipakai buat nebak gender santri (Kuttab Awwal belum
 *  dipisah di nama kelasnya, default cewek). Gak ada field gender santri tersimpan di sistem,
 *  jadi ini tebakan dari nama kelas doang. */
function isMale(kelas: string | null): boolean {
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
        <PageLoadingSkeleton />
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

  const male = isMale(kelas);
  const sapaan = binOrBinti(male);
  const namaLengkap = record.nama_ayah
    ? `${record.nama_santri} ${sapaan} ${record.nama_ayah}`
    : record.nama_santri;

  return (
    <div className="min-h-dvh" style={{ background: "#EFEAD9" }}>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Lalezar&family=Tajawal:wght@500;700;800&family=Quicksand:wght@500;600;700&display=swap"
      />
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          .no-print { display: none !important; }
          .cert-page { box-shadow: none !important; margin: 0 !important; }
          body { background: #fff !important; }
        }
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
          onClick={() => window.print()}
          className="text-sm font-semibold px-4 py-2.5 rounded-xl"
          style={{ background: C.green, color: "#FFF" }}
        >
          Cetak / Simpan PDF
        </button>
      </div>

      {/* Layar sempit (HP): sertifikatnya SELALU dirender di ukuran penuh (297mm), gak disusutkan
          sama sekali -- kalau disusutkan (maxWidth:100%), font clamp()-nya yang berbasis vw (lebar
          viewport HP, bukan lebar kotak sertifikat) jadi kegedean dibanding kotaknya sendiri, jadi
          overflow dan kepotong overflow:hidden. Solusinya: biarin penuh, scroll aja kayak liat PDF
          di HP (horizontal manual, vertical ngikut scroll halaman). */}
      <p className="no-print text-center text-xs sm:hidden mb-2" style={{ color: C.muted }}>
        Geser ke samping &amp; scroll ke bawah buat lihat semua ↔
      </p>
      <div className="flex justify-center px-4 pb-10 overflow-x-auto">
        <Certificate record={record} namaLengkap={namaLengkap} male={male} kelas={kelas} />
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
  const talib = male ? "الطالب" : "الطالبة";
  const ustadz = male ? "الأستاذ" : "الأستاذة";
  const atamma = male ? "أتمّ" : "أتمّت";
  const lahu = male ? "له" : "لها";
  const yarzuqahu = male ? "يرزقه" : "يرزقها";
  const yajaalahu = male ? "يجعله" : "يجعلها";

  return (
    <div
      className="cert-page relative overflow-hidden shrink-0"
      style={{
        width: "210mm",
        aspectRatio: "210 / 297",
        background: "linear-gradient(180deg, #FFFDF7 0%, #FFF8EA 100%)",
        boxShadow: "0 12px 40px rgba(28,74,51,0.18)",
        fontFamily: "'Tajawal', 'Quicksand', sans-serif",
      }}
      dir="rtl"
    >
      <Decorations />

      {/* Bingkai dalam */}
      <div
        className="absolute rounded-2xl"
        style={{ inset: "3.5%", border: "2px solid #D9B968", borderRadius: 24 }}
      />
      <div
        className="absolute rounded-2xl"
        style={{ inset: "4.3%", border: "1px solid #E7CE96", borderRadius: 18 }}
      />

      {/* Konten -- vertikal (portrait): lambang di atas, logo+nama di bawahnya, baru judul dst.
          turun ke bawah, beda dari versi landscape yang logo & lambang sejajar 2 kolom. */}
      <div className="absolute inset-0 flex flex-col items-center text-center px-[9%]" style={{ paddingTop: "6%", paddingBottom: "5%" }}>
        {/* Lambang bulat Al-Qur'an */}
        <div
          className="rounded-full flex items-center justify-center shrink-0"
          style={{ width: "17%", aspectRatio: "1/1", border: "2px solid #E7CE96", background: "rgba(217,185,104,0.12)" }}
        >
          <QuranIcon />
        </div>

        {/* Logo + nama muassasah */}
        <div className="flex flex-col items-center" style={{ marginTop: "3%" }}>
          <img
            src={LOGO}
            alt="Logo Kuttab Budi Ashari"
            style={{ width: "68px", mixBlendMode: "multiply", filter: "brightness(1.04)" }}
          />
          <div style={{ fontFamily: "'Tajawal', sans-serif", fontWeight: 700, fontSize: "clamp(11px, 2vw, 15px)", color: C.green, marginTop: "2%" }}>
            كُتّاب بودي أزهري
          </div>
          <div style={{ fontSize: "clamp(9px, 1.5vw, 11px)", color: C.muted, fontWeight: 600 }} dir="ltr">
            Kuttab Budi Ashari
          </div>
        </div>

        {/* Judul kaligrafi */}
        <div
          style={{
            fontFamily: "'Lalezar', cursive",
            fontWeight: 400,
            fontSize: "clamp(40px, 9vw, 64px)",
            color: "#B3801E",
            marginTop: "3%",
            textShadow: "0 3px 0 #FFF2CE",
            lineHeight: 1,
          }}
        >
          بُشرى تسميع
        </div>

        {/* Pita keterangan */}
        <div
          className="rounded-full"
          style={{
            background: "#EDF3EE",
            padding: "1.3% 5%",
            marginTop: "4%",
            fontSize: "clamp(13px, 2.6vw, 17px)",
            fontWeight: 700,
            color: C.green,
          }}
        >
          تشهد كُتّاب بودي أزهري بأنّ {talib}
        </div>

        {/* Nama santri */}
        <div
          style={{
            fontSize: "clamp(20px, 4.4vw, 30px)",
            color: C.green,
            fontWeight: 700,
            marginTop: "3.5%",
            borderBottom: `2px solid #D9B968`,
            paddingBottom: "1.2%",
          }}
          dir="ltr"
        >
          {namaLengkap}
        </div>

        {/* Badge kelas */}
        {kelas && (
          <div className="flex items-center" style={{ gap: "2%", marginTop: "3%" }}>
            <span style={{ fontSize: "clamp(12px, 2.2vw, 15px)", color: C.muted, fontWeight: 600 }}>من فصل:</span>
            <span
              className="rounded-full"
              style={{
                background: "#E6F1FB",
                border: "1px solid #B9D6F2",
                color: "#1F5E93",
                fontWeight: 700,
                fontSize: "clamp(12px, 2.2vw, 15px)",
                padding: "0.6% 3.5%",
              }}
              dir="ltr"
            >
              {kelas}
            </span>
          </div>
        )}

        {/* Intro singkat -- maxWidth sengaja dikecilin (bukan cuma "batas biar gak lebar-lebar
            amat") biar teksnya KEPAKSA wrap 2 baris. Kalau dibiarin muat 1 baris penuh, lebar
            barisnya (~396px) dikit lebih lebar dari layar HP (375px) walau di dalam kotaknya
            sendiri gak overflow -- baru kepotong pas discroll gak pas ke tengah persis. Wrap 2
            baris lebih aman di semua ukuran layar drpd ngandelin scroll presisi. */}
        <p
          style={{
            fontSize: "clamp(13px, 2.6vw, 17px)",
            color: "#3A3226",
            marginTop: "4%",
            maxWidth: "48%",
            minWidth: 0,
            fontWeight: 600,
            lineHeight: 1.6,
          }}
        >
          قد {atamma} تسميع القرآن الكريم بإشراف {ustadz} بتاريخ {labelTanggalArab(record.tanggal)}
        </p>

        {/* Juz / Ustadz / Waktu / Kesalahan -- baris sendiri-sendiri */}
        <div className="grid grid-cols-2" style={{ gap: "2.5% 8%", marginTop: "4%", width: "88%" }}>
          <StatRow label="الجزء" value={record.juz || "—"} />
          <StatRow label="الأستاذ" value={record.nama_guru || "—"} ltr />
          <StatRow label="المدة" value={record.durasi || "—"} ltr />
          <StatRow label="عدد الأخطاء" value={String(record.jumlah_kesalahan)} />
        </div>

        {/* Doa -- maxWidth dikecilin juga, alasan sama kayak intro di atas (paksa wrap). */}
        <p
          style={{
            fontSize: "clamp(13px, 2.6vw, 17px)",
            color: C.muted,
            marginTop: "4%",
            maxWidth: "50%",
            minWidth: 0,
            lineHeight: 1.8,
            fontStyle: "italic",
          }}
        >
          بارك الله {lahu}، ونسأل الله أن {yarzuqahu} حبّ القرآن دائمًا، و{yajaalahu} من أهل القرآن وخاصته.
        </p>

        {/* dorong footer ke bawah biar nempel dasar kartu, sisa ruang portrait dipakai di sini */}
        <div className="flex-1" />

        {/* Footer */}
        <div className="w-full flex items-end justify-between" style={{ maxWidth: "94%" }}>
          <FooterBlock label="التاريخ">
            <div dir="ltr" style={{ fontWeight: 700, fontSize: "clamp(14px, 2.6vw, 18px)", color: C.ink }}>
              {labelTanggalArab(record.tanggal)}
            </div>
          </FooterBlock>
          <FooterBlock label={ustadz}>
            <div dir="ltr" style={{ fontWeight: 700, fontSize: "clamp(14px, 2.6vw, 18px)", color: C.ink }}>
              {record.nama_guru || "—"}
            </div>
          </FooterBlock>
          <FooterBlock label="ختم المؤسسة">
            <div
              className="rounded-2xl flex items-center justify-center mx-auto"
              style={{ padding: "4% 7%", border: `2px dashed #B3801E` }}
            >
              <div style={{ fontWeight: 700, fontSize: "clamp(11px, 2vw, 14px)", color: "#B3801E" }}>
                كُتّاب بودي أزهري
              </div>
            </div>
          </FooterBlock>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-baseline justify-between" style={{ borderBottom: `1px dashed ${C.line}`, paddingBottom: "2%" }}>
      <span style={{ fontSize: "clamp(11px, 1.3vw, 14px)", color: C.muted, fontWeight: 700 }}>{label}</span>
      <span
        dir={ltr ? "ltr" : undefined}
        style={{ fontSize: "clamp(13px, 1.6vw, 17px)", color: "#B3801E", fontWeight: 700 }}
      >
        {value}
      </span>
    </div>
  );
}

function FooterBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center" style={{ width: "30%" }}>
      {children}
      <div
        style={{
          fontSize: "clamp(11px, 1.3vw, 14px)",
          color: C.muted,
          fontWeight: 700,
          marginTop: "4%",
          borderTop: `1px solid ${C.line}`,
          paddingTop: "3%",
          width: "85%",
        }}
      >
        {label}
      </div>
    </div>
  );
}

/** Mushaf (Al-Qur'an tertutup) bernuansa Timur Tengah -- sampul ijo tua + list emas, rosette
 *  geometris 8 sudut di tengah (motif khas ornamen Islami) ketimbang buku generik biasa. */
function QuranIcon() {
  return (
    <svg width="60%" height="60%" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="3.5" width="16" height="17" rx="1.4" fill="#1C4A33" stroke="#B3801E" strokeWidth="1.3" />
      <rect x="5.3" y="4.8" width="13.4" height="14.4" rx="0.8" stroke="#F0C670" strokeWidth="0.6" />
      <g transform="translate(12,12)" stroke="#F0C670" strokeWidth="0.9" strokeLinejoin="round">
        <path d="M0 -3.4L0.9 -0.9L3.4 0L0.9 0.9L0 3.4L-0.9 0.9L-3.4 0L-0.9 -0.9Z" fill="#F0C670" opacity="0.15" />
        <path d="M0 -3.4L0.9 -0.9L3.4 0L0.9 0.9L0 3.4L-0.9 0.9L-3.4 0L-0.9 -0.9Z" />
        <path d="M0 -2.4L0.65 -0.65L2.4 0L0.65 0.65L0 2.4L-0.65 0.65L-2.4 0L-0.65 -0.65Z" transform="rotate(22.5)" />
      </g>
      <path d="M8 7h1.6M8 17.2h1.6" stroke="#F0C670" strokeWidth="0.8" strokeLinecap="round" />
      <path d="M14.4 7H16M14.4 17.2H16" stroke="#F0C670" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  );
}

/* ═══════════════════════ Dekorasi — bulan, bintang, awan, bunga, rumput ═══════════════════════ */

function Decorations() {
  return (
    <svg
      className="absolute inset-0"
      width="100%"
      height="100%"
      viewBox="0 0 700 990"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {/* Awan pojok kiri-atas & kanan-atas */}
      <Cloud x={55} y={45} scale={0.8} />
      <Cloud x={615} y={55} scale={0.7} />

      {/* Bulan sabit pojok kanan-atas */}
      <g transform="translate(632,35) scale(0.8)">
        <path
          d="M20 0a20 20 0 1 0 0 40 16 16 0 1 1 0-40Z"
          fill="#F5C46A"
        />
      </g>

      {/* Bintang kecil tersebar (dikit aja) */}
      <Star x={100} y={30} s={6} />
      <Star x={160} y={75} s={5} />
      <Star x={555} y={35} s={5} />
      <Star x={45} y={130} s={5} />
      <Star x={660} y={150} s={6} />
      <Star x={350} y={25} s={5} />

      {/* Rumput + bunga sepanjang bawah, jarang-jarang */}
      <Grass x={0} />
      <Grass x={65} />
      <Grass x={630} />
      <Grass x={695} />
      <Flower x={30} y={945} scale={0.9} color="#E48FA0" />
      <Flower x={670} y={940} scale={0.9} color="#8FB6E4" />
      <Flower x={90} y={958} scale={0.6} color="#D9B968" />
      <Flower x={610} y={958} scale={0.6} color="#B08FE4" />

      {/* Bunga kecil di sudut bawah kiri/kanan atas juga, biar seimbang (dikit) */}
      <Flower x={40} y={80} scale={0.5} color="#E48FA0" />
      <Flower x={655} y={95} scale={0.5} color="#B08FE4" />
    </svg>
  );
}

function Cloud({ x, y, scale }: { x: number; y: number; scale: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`} opacity={0.9}>
      <ellipse cx="0" cy="10" rx="26" ry="14" fill="#EAF1FB" />
      <ellipse cx="22" cy="4" rx="20" ry="16" fill="#EAF1FB" />
      <ellipse cx="-22" cy="6" rx="18" ry="13" fill="#EAF1FB" />
    </g>
  );
}

function Star({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <path
      d={`M${x} ${y - s} L${x + s * 0.28} ${y - s * 0.28} L${x + s} ${y} L${x + s * 0.28} ${y + s * 0.28} L${x} ${y + s} L${x - s * 0.28} ${y + s * 0.28} L${x - s} ${y} L${x - s * 0.28} ${y - s * 0.28} Z`}
      fill="#F0C670"
    />
  );
}

function Grass({ x }: { x: number }) {
  return (
    <g transform={`translate(${x},963)`} opacity={0.85}>
      <path d="M0 27 Q6 5 12 27" stroke="#7FA872" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M10 27 Q18 0 26 27" stroke="#6C9962" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M20 27 Q28 8 36 27" stroke="#7FA872" strokeWidth="3" fill="none" strokeLinecap="round" />
    </g>
  );
}

function Flower({ x, y, scale, color }: { x: number; y: number; scale: number; color: string }) {
  const petals = [0, 72, 144, 216, 288];
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      {petals.map((deg) => (
        <ellipse
          key={deg}
          cx="0"
          cy="-7"
          rx="4.5"
          ry="7"
          fill={color}
          opacity={0.85}
          transform={`rotate(${deg})`}
        />
      ))}
      <circle r="3.5" fill="#F5C46A" />
    </g>
  );
}

