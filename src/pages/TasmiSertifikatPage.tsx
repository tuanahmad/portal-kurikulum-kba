import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { C, LOGO } from "../data";
import { readTasmiById, type TasmiRecord } from "../lib/tasmi";
import { PageLoadingSkeleton } from "../components/Skeleton";

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function labelTanggalPanjang(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${d} ${BULAN[m - 1]} ${y}`;
}

/** Kelas Qonuni dipisah Ikhwan/Akhwat -- dipakai buat nebak "bin"/"binti". Kuttab Awwal (belum
 *  dipisah gender di nama kelasnya) default ke "binti" apa adanya, guru bisa liat & minta ganti
 *  manual kalau meleset (gak ada field gender santri tersimpan di sistem). */
function binOrBinti(kelas: string | null): "bin" | "binti" {
  return kelas?.includes("Ikhwan") ? "bin" : "binti";
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

  const sapaan = binOrBinti(kelas);
  const namaLengkap = record.nama_ayah
    ? `${record.nama_santri} ${sapaan} ${record.nama_ayah}`
    : record.nama_santri;

  return (
    <div className="min-h-dvh" style={{ background: "#EFEAD9" }}>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;800&family=Quicksand:wght@500;600;700&family=Amiri:wght@700&display=swap"
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
        <Certificate record={record} namaLengkap={namaLengkap} />
      </div>
    </div>
  );
}

function Certificate({ record, namaLengkap }: { record: TasmiRecord; namaLengkap: string }) {
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
        fontFamily: "'Quicksand', sans-serif",
      }}
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
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-[10%]" style={{ paddingBottom: "3%" }}>
        <CrownIcon />
        <img src={LOGO} alt="Logo Kuttab Budi Ashari" style={{ width: "8%", marginTop: "1%" }} />

        <div
          style={{
            fontFamily: "'Baloo 2', cursive",
            fontWeight: 800,
            fontSize: "clamp(32px, 5.4vw, 64px)",
            color: "#B3801E",
            marginTop: "2%",
            letterSpacing: "0.03em",
            textShadow: "0 2px 0 #FFF2CE",
          }}
        >
          Busyro Tasmi'
        </div>

        <div style={{ fontSize: "clamp(12px, 1.4vw, 16px)", color: C.muted, marginTop: "0.8%", fontWeight: 600 }}>
          {labelTanggalPanjang(record.tanggal)}
        </div>

        <div
          dir="rtl"
          style={{
            fontFamily: "'Amiri', serif",
            fontSize: "clamp(24px, 3.6vw, 40px)",
            color: C.green,
            marginTop: "2.8%",
            fontWeight: 700,
          }}
        >
          بارك الله فيكم
        </div>

        <p
          style={{
            fontSize: "clamp(15px, 1.9vw, 21px)",
            color: "#3A3226",
            marginTop: "3.6%",
            maxWidth: "78%",
            lineHeight: 1.8,
            fontWeight: 600,
          }}
        >
          {record.nama_guru || "Ustadz/ah"} yang telah mengantarkan ananda{" "}
          <span style={{ color: C.green, fontWeight: 700 }}>{namaLengkap}</span> berhasil mentasmi'kan{" "}
          <span style={{ color: "#B3801E", fontWeight: 700 }}>{record.juz || "—"}</span> dengan{" "}
          <span style={{ color: "#B3801E", fontWeight: 700 }}>{record.jumlah_kesalahan}</span> kesalahan.
        </p>

        <p
          style={{
            fontSize: "clamp(12px, 1.5vw, 16px)",
            color: C.muted,
            marginTop: "3%",
            maxWidth: "60%",
            lineHeight: 1.75,
            fontStyle: "italic",
          }}
        >
          Semoga Allah senantiasa menyuburkan rasa cinta terhadap Al-Qur'an di dalam hati ananda dan
          menjadikannya bagian dari keluarga Allah.
        </p>
      </div>
    </div>
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
