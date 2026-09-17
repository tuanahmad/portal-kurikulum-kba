import { useEffect, useState } from "react";
import { C, INSTRUMEN_FOLDERS, jenjangOf } from "../data";
import { DriveTree } from "../components/DriveTree";
import { AccentCard } from "../components/PortalComponents";
import { SkeletonBlock } from "../components/Skeleton";
import { useAuth } from "../contexts/AuthContext";
import { listDriveFolders, findChildFolder, type DriveNode } from "../lib/drive";

type Jenjang = "Kuttab Awwal" | "Qonuni" | "Olahraga";

const GRADIENTS = [
  `linear-gradient(135deg, ${C.green} 0%, ${C.greenDeep} 100%)`,
  "linear-gradient(135deg, #C79A3B 0%, #8A6A20 100%)",
  `linear-gradient(135deg, ${C.green} 0%, ${C.gold} 100%)`,
];

const FOLDER_DESC: Record<string, string> = {
  modul: "Bahan ajar & modul harian",
  target: "Capaian yang harus dituju",
  panduan: "Cara & alur mengajarkannya",
};
const FOLDER_ICON: Record<string, JSX.Element> = {
  modul: <BookIcon />,
  target: <TargetIcon />,
  panduan: <CompassIcon />,
};

/** Hitung jumlah item langsung di folder jenjang tertentu (buat keterangan di kartu kategori) —
 *  gak perlu presisi (subfolder dihitung 1 item, gak direkursif), sekadar gambaran isi. */
function countFor(nodes: DriveNode[], jenjang: Jenjang): number {
  const jenjangFolder = findChildFolder(nodes, jenjang);
  const looseFiles = nodes.filter((n) => n.type === "file");
  return (jenjangFolder?.children.length ?? 0) + looseFiles.length;
}

export default function InstrumenPage() {
  const { role, kelas } = useAuth();
  // Guru olahraga bukan Kuttab Awwal/Qonuni dan cuma butuh lihat Panduan (belum ada Modul/Target
  // buat olahraga) — jadi jenjang & kategori-nya langsung dikunci, gak lewat picker 2 langkah.
  const isOlahraga = role === "olahraga";
  const myJenjang = isOlahraga ? "Olahraga" : jenjangOf(kelas);
  const [jenjang, setJenjang] = useState<Jenjang | null>(myJenjang);
  const [activeKey, setActiveKey] = useState<string | null>(isOlahraga ? "panduan" : null);

  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
    result: Record<string, DriveNode[]> | null;
  }>({ loading: true, error: null, result: null });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, error: null, result: null });
    listDriveFolders(INSTRUMEN_FOLDERS.map((f) => f.folderId))
      .then((result) => {
        if (!cancelled) setState({ loading: false, error: null, result });
      })
      .catch((e) => {
        if (!cancelled) setState({ loading: false, error: e instanceof Error ? e.message : String(e), result: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeFolder = INSTRUMEN_FOLDERS.find((f) => f.key === activeKey) || null;
  const activeIdx = activeFolder ? INSTRUMEN_FOLDERS.findIndex((f) => f.key === activeFolder.key) : 0;

  return (
    <div className="min-h-dvh" style={{ background: C.mist, color: C.ink }}>
      <div className="max-w-3xl mx-auto px-4 pt-7 sm:pt-10 pb-28">
        <header className="text-center">
          <h1
            className="text-xl sm:text-2xl font-semibold"
            style={{ color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Instrumen Ilmu
          </h1>
          <p className="text-sm mt-2 max-w-md mx-auto" style={{ color: C.muted }}>
            {isOlahraga
              ? "Panduan pengajaran olahraga sebagai acuan guru. Pembaruan file dilakukan tim management lewat Google Drive."
              : "Acuan guru dalam proses pembelajaran — modul, target, dan panduan pengajaran. Pembaruan file dilakukan tim management lewat Google Drive."}
          </p>
        </header>

        {role === "guru" && !myJenjang && (
          <p className="text-sm text-center mt-8" style={{ color: C.muted }}>
            Kelas belum diset untuk akun ini — hubungi koordinator kurikulum.
          </p>
        )}

        {/* Langkah 1 (management aja — guru udah otomatis kepasang dari kelasnya) — pilih jenjang */}
        {role === "management" && !jenjang && (
          <main className="mt-6">
            <span className="block text-xs font-bold uppercase tracking-wider mb-2.5 px-1" style={{ color: C.green }}>
              Pilih Jenjang
            </span>
            <div className="grid grid-cols-2 gap-4">
              <AccentCard
                title="Kuttab Awwal"
                icon={<LayerIcon />}
                gradient={GRADIENTS[0]}
                onClick={() => setJenjang("Kuttab Awwal")}
              />
              <AccentCard
                title="Qonuni"
                icon={<LayerIcon />}
                gradient={GRADIENTS[1]}
                onClick={() => setJenjang("Qonuni")}
              />
            </div>
          </main>
        )}

        {/* Langkah 2 — pilih kategori (Modul / Target / Panduan) */}
        {jenjang && !activeFolder && (
          <main className="mt-6">
            {role === "management" && (
              <button
                onClick={() => setJenjang(null)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-full mb-4 transition-colors hover:opacity-80"
                style={{ background: C.leaf, color: C.green, border: `1px solid ${C.green}` }}
              >
                <BackArrowIcon />
                {jenjang}
              </button>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {INSTRUMEN_FOLDERS.map((f, i) => {
                const nodes = state.result?.[f.folderId];
                const count = nodes ? countFor(nodes, jenjang) : null;
                return (
                  <AccentCard
                    key={f.key}
                    title={f.name}
                    desc={count == null ? FOLDER_DESC[f.key] : `${FOLDER_DESC[f.key]} · ${count} item`}
                    icon={FOLDER_ICON[f.key]}
                    gradient={GRADIENTS[i % GRADIENTS.length]}
                    onClick={() => setActiveKey(f.key)}
                  />
                );
              })}
            </div>

            {state.error && (
              <p className="text-sm px-1 py-3" style={{ color: "#B3441C" }}>
                Gagal memuat: {state.error}
              </p>
            )}
          </main>
        )}

        {/* Langkah 3 — isi kategori yang dipilih */}
        {jenjang && activeFolder && (
          <main className="mt-6">
            {!isOlahraga && (
              <button
                onClick={() => setActiveKey(null)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-full mb-4 transition-colors hover:opacity-80"
                style={{ background: C.leaf, color: C.green, border: `1px solid ${C.green}` }}
              >
                <BackArrowIcon />
                {activeFolder.name}
              </button>
            )}

            {state.loading && (
              <div className="space-y-2">
                <SkeletonBlock className="h-12 rounded-xl" />
                <SkeletonBlock className="h-12 rounded-xl" />
              </div>
            )}

            {state.error && (
              <p className="text-sm px-1 py-2" style={{ color: "#B3441C" }}>
                Gagal memuat: {state.error}
              </p>
            )}

            {state.result &&
              (() => {
                const nodes = state.result![activeFolder.folderId] || [];
                const jenjangFolder = findChildFolder(nodes, jenjang);
                const looseFiles = nodes.filter((n) => n.type === "file");
                const combined: DriveNode[] = [...(jenjangFolder?.children ?? []), ...looseFiles];
                return (
                  <DriveTree
                    nodes={combined}
                    section="Instrumen Ilmu"
                    gradient={GRADIENTS[activeIdx % GRADIENTS.length]}
                  />
                );
              })()}
          </main>
        )}
      </div>
    </div>
  );
}

function BackArrowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LayerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 4l8 4-8 4-8-4 8-4Z" stroke="#FFF" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M4 12l8 4 8-4" stroke="#FFF" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M4 16l8 4 8-4" stroke="#FFF" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M4 5.5c2-1 5-1 8 .5 3-1.5 6-1.5 8-.5v13c-2-1-5-1-8 .5-3-1.5-6-1.5-8-.5v-13Z" stroke="#FFF" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M12 6v13" stroke="#FFF" strokeWidth="1.7" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8" stroke="#FFF" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="4" stroke="#FFF" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="0.8" fill="#FFF" />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="#FFF" strokeWidth="1.7" />
      <path d="M15.2 8.8l-2 5-5 2 2-5 5-2Z" stroke="#FFF" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
