import { useState } from "react";
import { Link } from "react-router-dom";
import { C, LOGO, KELAS_LIST, sheetUrl } from "../data";
import { GoldDivider } from "../components/PortalComponents";
import { BottomNav } from "../components/BottomNav";

export default function CapaianPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const kelas = KELAS_LIST.find((k) => k.name === selected) || null;

  return (
    <div className="min-h-screen" style={{ background: C.mist, color: C.ink }}>
      <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${C.green}, ${C.gold}, ${C.green})` }} />

      <div className="max-w-3xl mx-auto px-4 py-7 sm:py-10 pb-24">
        <div className="mb-2">
          <Link to="/home" className="text-xs underline" style={{ color: C.green }}>
            ← Home
          </Link>
        </div>

        <header className="text-center">
          <img src={LOGO} alt="Logo Kuttab Budi Ashari" className="mx-auto w-40 sm:w-48 h-auto" style={{ mixBlendMode: "multiply" }} />
          <div className="max-w-md mx-auto mt-3">
            <GoldDivider />
          </div>
          <h1
            className="text-xl sm:text-2xl font-semibold mt-3"
            style={{ color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Capaian Santri
          </h1>
          <p className="text-sm mt-2 max-w-md mx-auto" style={{ color: C.muted }}>
            Pilih kelas untuk melihat Capaian Ilmu dan Capaian Al-Qur'an.
          </p>
        </header>

        {/* Grid 12 kelas */}
        <main className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {KELAS_LIST.map((k) => {
            const active = k.name === selected;
            return (
              <button
                key={k.name}
                onClick={() => setSelected(active ? null : k.name)}
                className="text-sm font-medium px-3 py-3 rounded-xl text-center transition-colors"
                style={{
                  background: active ? C.green : "#FFF",
                  color: active ? "#FFF" : C.ink,
                  border: `1px solid ${active ? C.green : C.line}`,
                }}
              >
                {k.name}
              </button>
            );
          })}
        </main>

        {/* Detail kelas terpilih */}
        {kelas && (
          <div className="mt-6 space-y-2.5">
            <div
              className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl"
              style={{ background: "#FFF", border: `1px solid ${C.line}` }}
            >
              <div>
                <div className="text-sm font-semibold" style={{ color: C.ink }}>Capaian Ilmu</div>
                <div className="text-xs" style={{ color: C.muted }}>Sifatnya deskriptif · Diisi tiap tanggal 30</div>
              </div>
              <a
                href={sheetUrl(kelas.ilmuId)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold px-3.5 py-1.5 rounded-full whitespace-nowrap"
                style={{ background: C.green, color: "#FFF" }}
              >
                Buka & isi
              </a>
            </div>
            <div
              className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl"
              style={{ background: "#FFF", border: `1px solid ${C.line}` }}
            >
              <div>
                <div className="text-sm font-semibold" style={{ color: C.ink }}>Capaian Al-Qur'an</div>
                <div className="text-xs" style={{ color: C.muted }}>Sifatnya angka · Diisi tiap Jum'at</div>
              </div>
              <a
                href={sheetUrl(kelas.quranId)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold px-3.5 py-1.5 rounded-full whitespace-nowrap"
                style={{ background: C.green, color: "#FFF" }}
              >
                Buka & isi
              </a>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
