import { useEffect, useState } from "react";
import { C, INSTRUMEN_FOLDERS, jenjangOf } from "../data";
import { DriveTree } from "../components/DriveTree";
import { SkeletonBlock } from "../components/Skeleton";
import { useAuth } from "../contexts/AuthContext";
import { listDriveFolders, findChildFolder, type DriveNode } from "../lib/drive";

type Jenjang = "Kuttab Awwal" | "Qonuni";

const GRADIENTS = [
  `linear-gradient(135deg, ${C.green} 0%, ${C.greenDeep} 100%)`,
  "linear-gradient(135deg, #C79A3B 0%, #8A6A20 100%)",
  `linear-gradient(135deg, ${C.green} 0%, ${C.gold} 100%)`,
];

export default function InstrumenPage() {
  const { role, kelas } = useAuth();
  const myJenjang = jenjangOf(kelas);
  const [jenjang, setJenjang] = useState<Jenjang>(myJenjang || "Kuttab Awwal");

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

  return (
    <div className="min-h-dvh" style={{ background: C.mist, color: C.ink }}>
      <div className="max-w-3xl mx-auto px-4 py-7 sm:py-10 pb-28">
        <header className="text-center">
          <h1
            className="text-xl sm:text-2xl font-semibold"
            style={{ color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Instrumen Ilmu
          </h1>
          <p className="text-sm mt-2 max-w-md mx-auto" style={{ color: C.muted }}>
            Acuan guru dalam proses pembelajaran — modul, target, dan panduan pengajaran.
            Pembaruan file dilakukan tim management lewat Google Drive.
          </p>
        </header>

        {role === "management" && (
          <div className="mt-5 flex items-center justify-center gap-2">
            {(["Kuttab Awwal", "Qonuni"] as Jenjang[]).map((j) => (
              <button
                key={j}
                onClick={() => setJenjang(j)}
                className="text-sm font-medium px-4 py-1.5 rounded-full transition-colors"
                style={{
                  background: jenjang === j ? C.green : "#FFF",
                  color: jenjang === j ? "#FFF" : C.ink,
                  border: `1px solid ${jenjang === j ? C.green : C.line}`,
                }}
              >
                {j}
              </button>
            ))}
          </div>
        )}

        {role === "guru" && !myJenjang && (
          <p className="text-sm text-center mt-8" style={{ color: C.muted }}>
            Kelas belum diset untuk akun ini — hubungi koordinator kurikulum.
          </p>
        )}

        {(role === "management" || myJenjang) && (
          <main className="mt-6 space-y-5">
            {state.loading &&
              INSTRUMEN_FOLDERS.map((f) => (
                <section key={f.key}>
                  <h2 className="text-xs font-bold uppercase tracking-[0.16em] mb-2.5 px-1" style={{ color: C.green }}>
                    {f.name}
                  </h2>
                  <div className="space-y-2">
                    <SkeletonBlock className="h-12 rounded-xl" />
                    <SkeletonBlock className="h-12 rounded-xl" />
                  </div>
                </section>
              ))}

            {state.error && (
              <p className="text-sm px-1 py-2" style={{ color: "#B3441C" }}>
                Gagal memuat: {state.error}
              </p>
            )}

            {state.result &&
              INSTRUMEN_FOLDERS.map((f, i) => {
                const nodes = state.result![f.folderId] || [];
                const jenjangFolder = findChildFolder(nodes, jenjang);
                const looseFiles = nodes.filter((n) => n.type === "file");
                const combined: DriveNode[] = [...(jenjangFolder?.children ?? []), ...looseFiles];
                return (
                  <section key={f.key}>
                    <h2 className="text-xs font-bold uppercase tracking-[0.16em] mb-2.5 px-1" style={{ color: C.green }}>
                      {f.name}
                    </h2>
                    <DriveTree nodes={combined} section="Instrumen Ilmu" gradient={GRADIENTS[i % GRADIENTS.length]} />
                  </section>
                );
              })}
          </main>
        )}
      </div>
    </div>
  );
}
