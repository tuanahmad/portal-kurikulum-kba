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
          @page { size: A4 landscape; margin: 0; }
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

      <div className="flex justify-center px-4 pb-10">
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
        width: "297mm",
        height: "210mm",
        maxWidth: "100%",
        aspectRatio: "297 / 210",
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
        style={{ inset: "5%", border: "2px solid #D9B968", borderRadius: 24 }}
      />
      <div
        className="absolute rounded-2xl"
        style={{ inset: "6%", border: "1px solid #E7CE96", borderRadius: 18 }}
      />

      {/* Konten */}
      <div className="absolute inset-0 flex flex-col items-center text-center px-[8%]" style={{ paddingTop: "6.5%", paddingBottom: "4%" }}>
        {/* Header 2 kolom: logo+nama di kanan (awal teks RTL), lambang di kiri */}
        <div className="w-full flex items-start justify-between" style={{ maxWidth: "88%" }}>
          <div className="flex flex-col items-center" style={{ width: "22%" }}>
            <img
              src={LOGO}
              alt="Logo Kuttab Budi Ashari"
              style={{ width: "70%", mixBlendMode: "multiply", filter: "brightness(1.04)" }}
            />
            <div style={{ fontFamily: "'Tajawal', sans-serif", fontWeight: 700, fontSize: "clamp(10px, 1.1vw, 13px)", color: C.green, marginTop: "4%" }}>
              كُتّاب بودي أشعري
            </div>
            <div style={{ fontSize: "clamp(8px, 0.85vw, 10px)", color: C.muted, fontWeight: 600 }} dir="ltr">
              Kuttab Budi Ashari
            </div>
          </div>

          <div className="flex flex-col items-center" style={{ width: "22%" }}>
            <CrownIcon />
            <div
              className="rounded-full flex items-center justify-center"
              style={{ width: "58%", aspectRatio: "1/1", marginTop: "6%", border: "2px solid #E7CE96", background: "rgba(217,185,104,0.12)" }}
            >
              <StarBadgeIcon />
            </div>
          </div>
        </div>

        {/* Judul kaligrafi */}
        <div
          style={{
            fontFamily: "'Lalezar', cursive",
            fontWeight: 400,
            fontSize: "clamp(48px, 7.4vw, 88px)",
            color: "#B3801E",
            marginTop: "1.5%",
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
            padding: "0.9% 4%",
            marginTop: "2.2%",
            fontSize: "clamp(12px, 1.5vw, 16px)",
            fontWeight: 700,
            color: C.green,
          }}
        >
          تشهد كُتّاب بودي أشعري بأنّ {talib}
        </div>

        {/* Nama santri */}
        <div
          style={{
            fontSize: "clamp(20px, 2.8vw, 32px)",
            color: C.green,
            fontWeight: 700,
            marginTop: "1.8%",
            borderBottom: `2px solid #D9B968`,
            paddingBottom: "0.6%",
          }}
          dir="ltr"
        >
          {namaLengkap}
        </div>

        {/* Badge kelas */}
        {kelas && (
          <div className="flex items-center" style={{ gap: "2%", marginTop: "1.6%" }}>
            <span style={{ fontSize: "clamp(11px, 1.3vw, 14px)", color: C.muted, fontWeight: 600 }}>من فصل:</span>
            <span
              className="rounded-full"
              style={{
                background: "#E6F1FB",
                border: "1px solid #B9D6F2",
                color: "#1F5E93",
                fontWeight: 700,
                fontSize: "clamp(11px, 1.3vw, 14px)",
                padding: "0.3% 2.5%",
              }}
              dir="ltr"
            >
              {kelas}
            </span>
          </div>
        )}

        {/* Paragraf capaian */}
        <p
          style={{
            fontSize: "clamp(13px, 1.6vw, 17px)",
            color: "#3A3226",
            marginTop: "2.4%",
            maxWidth: "82%",
            lineHeight: 2,
            fontWeight: 600,
          }}
        >
          قد {atamma} تسميع <span style={{ color: "#B3801E", fontWeight: 700 }}>{record.juz || "—"}</span> بإشراف {ustadz}{" "}
          <span style={{ color: C.green, fontWeight: 700 }} dir="ltr">{record.nama_guru || "—"}</span> بتاريخ{" "}
          {labelTanggalArab(record.tanggal)}، في مدة{" "}
          <span style={{ color: "#B3801E", fontWeight: 700 }} dir="ltr">{record.durasi || "—"}</span> وبعدد الأخطاء:{" "}
          <span style={{ color: "#B3801E", fontWeight: 700 }}>{record.jumlah_kesalahan}</span>.
        </p>

        {/* Doa */}
        <p
          style={{
            fontSize: "clamp(12px, 1.5vw, 16px)",
            color: C.muted,
            marginTop: "2%",
            maxWidth: "64%",
            lineHeight: 1.9,
            fontStyle: "italic",
          }}
        >
          بارك الله {lahu}، ونسأل الله أن {yarzuqahu} حبّ القرآن دائمًا، و{yajaalahu} من أهل القرآن وخاصته.
        </p>

        {/* Footer */}
        <div className="w-full flex items-end justify-between mt-auto" style={{ maxWidth: "84%" }}>
          <FooterBlock label="التاريخ">
            <div dir="ltr" style={{ fontWeight: 700, fontSize: "clamp(11px, 1.3vw, 14px)", color: C.ink }}>
              {labelTanggalArab(record.tanggal)}
            </div>
          </FooterBlock>
          <FooterBlock label={ustadz}>
            <div dir="ltr" style={{ fontWeight: 700, fontSize: "clamp(11px, 1.3vw, 14px)", color: C.ink }}>
              {record.nama_guru || "—"}
            </div>
          </FooterBlock>
          <FooterBlock label="ختم المؤسسة">
            <div
              className="rounded-full flex items-center justify-center mx-auto"
              style={{ width: 46, height: 46, border: `2px dashed #B3801E` }}
            >
              <img src={LOGO} alt="" style={{ width: "70%", mixBlendMode: "multiply" }} />
            </div>
          </FooterBlock>
        </div>
      </div>
    </div>
  );
}

function FooterBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center" style={{ width: "30%" }}>
      {children}
      <div
        style={{
          fontSize: "clamp(9px, 1vw, 11px)",
          color: C.muted,
          fontWeight: 700,
          marginTop: "3%",
          borderTop: `1px solid ${C.line}`,
          paddingTop: "2%",
          width: "80%",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function StarBadgeIcon() {
  return (
    <svg width="60%" height="60%" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2l2.6 6.2L21 9l-5 4.4L17.4 20 12 16.6 6.6 20 8 13.4 3 9l6.4-0.8L12 2Z"
        fill="#F0C670"
        stroke="#B3801E"
        strokeWidth="1"
        strokeLinejoin="round"
      />
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
      viewBox="0 0 1000 707"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {/* Awan pojok kiri-atas & kanan-atas */}
      <Cloud x={70} y={55} scale={1} />
      <Cloud x={880} y={70} scale={0.85} />

      {/* Bulan sabit pojok kanan-atas */}
      <g transform="translate(905,50)">
        <path
          d="M20 0a20 20 0 1 0 0 40 16 16 0 1 1 0-40Z"
          fill="#F5C46A"
        />
      </g>

      {/* Bintang kecil tersebar (dikit aja) */}
      <Star x={140} y={40} s={7} />
      <Star x={230} y={90} s={5} />
      <Star x={790} y={45} s={6} />
      <Star x={60} y={160} s={5} />
      <Star x={945} y={190} s={7} />
      <Star x={500} y={35} s={5} />

      {/* Rumput + bunga sepanjang bawah, jarang-jarang */}
      <Grass x={0} />
      <Grass x={90} />
      <Grass x={905} />
      <Grass x={995} />
      <Flower x={45} y={660} scale={0.9} color="#E48FA0" />
      <Flower x={955} y={655} scale={0.9} color="#8FB6E4" />
      <Flower x={130} y={672} scale={0.6} color="#D9B968" />
      <Flower x={870} y={672} scale={0.6} color="#B08FE4" />

      {/* Bunga kecil di sudut bawah kiri/kanan atas juga, biar seimbang (dikit) */}
      <Flower x={55} y={95} scale={0.5} color="#E48FA0" />
      <Flower x={935} y={110} scale={0.5} color="#B08FE4" />
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
    <g transform={`translate(${x},680)`} opacity={0.85}>
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

function CrownIcon() {
  return (
    <svg width="46" height="34" viewBox="0 0 46 34" fill="none">
      <path
        d="M4 30h38l-3-17-9 9-7-15-7 15-9-9-3 17Z"
        fill="#F0C670"
        stroke="#B3801E"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="23" cy="8" r="2.4" fill="#E48FA0" />
      <circle cx="10" cy="17" r="1.8" fill="#8FB6E4" />
      <circle cx="36" cy="17" r="1.8" fill="#8FB6E4" />
    </svg>
  );
}
