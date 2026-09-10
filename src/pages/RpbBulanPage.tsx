import { useParams, useNavigate, Navigate } from "react-router-dom";
import { C, RPB_FILES, isMonthOpen } from "../data";
import { AccentCard } from "../components/PortalComponents";

/** Halaman level 2 — dari 1 kartu bulan (RpbPage), pilih mau isi RPB atau Refleksi bulan itu.
 *  Refleksi belum ada versi isi-langsung-di-app (belum ada salinan uji coba buat itu), jadi
 *  kartunya masih non-aktif dulu — nyusul RPB setelah proses uji cobanya selesai. */
export default function RpbBulanPage() {
  const { bulan } = useParams<{ bulan: string }>();
  const navigate = useNavigate();

  const rpbFile = RPB_FILES.find((f) => f.name === bulan);

  if (!bulan || !rpbFile || !isMonthOpen(bulan)) {
    return <Navigate to="/rpb" replace />;
  }

  return (
    <div className="min-h-dvh" style={{ background: C.mist, color: C.ink }}>
      <div className="max-w-2xl mx-auto px-4 pt-[10px] sm:pt-[18px] pb-28">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/rpb")}
            aria-label="Kembali"
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "#FFF", border: `1px solid ${C.line}`, color: C.green }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1
            className="text-lg sm:text-xl font-semibold"
            style={{ color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Bulan {bulan}
          </h1>
        </div>

        <main className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          <AccentCard
            to={`/rpb/${bulan}/isi`}
            title="Rencana Pembelajaran Bulanan"
            desc="Target pembelajaran & rencana materi tiap pekan."
            icon={<DocIcon />}
            gradient={`linear-gradient(135deg, ${C.green} 0%, ${C.greenDeep} 100%)`}
          />
          <AccentCard
            to={`/rpb/${bulan}/refleksi`}
            title="Refleksi Bulanan"
            desc="Capaian target, evaluasi diri, & refleksi perkembangan murid."
            icon={<ReflectIcon />}
            gradient="linear-gradient(135deg, #C79A3B 0%, #8A6A20 100%)"
          />
        </main>
      </div>
    </div>
  );
}

function DocIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" stroke="#FFF" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M14 3.5V8h4" stroke="#FFF" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8 12.5h8M8 16h5.5" stroke="#FFF" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ReflectIcon({ color = "#FFF" }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 3.5c-4.5 0-8 3.2-8 7.3 0 2 .9 3.9 2.4 5.2L6 20l4.1-1.5c.6.1 1.2.2 1.9.2 4.5 0 8-3.2 8-7.4s-3.5-7.3-8-7.3Z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9 10.5h6M9 13.2h4" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
