import { C } from "../data";

export function SkeletonBlock({ className = "", style = {} }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`skeleton-kilau rounded-lg ${className}`}
      style={{ background: "#E4E1D6", ...style }}
    />
  );
}

/** Skeleton satu halaman penuh: dipakai selagi cek sesi login (ProtectedRoute) */
export function FullPageSkeleton() {
  return (
    <div className="min-h-dvh" style={{ background: C.mist }}>
      <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${C.green}, ${C.gold}, ${C.green})` }} />
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex flex-col items-center gap-3 mb-8">
          <SkeletonBlock className="w-20 h-20 rounded-full" />
          <SkeletonBlock className="w-48 h-4" />
          <SkeletonBlock className="w-64 h-3" />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <SkeletonBlock className="h-32 rounded-2xl" />
          <SkeletonBlock className="h-32 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

/** Skeleton untuk isi di dalam halaman: kartu-kartu putih dengan garis teks (dipakai selagi memuat daftar/form). */
export function PageLoadingSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Memuat">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl p-4" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
          <div className="flex items-center gap-3">
            <SkeletonBlock className="w-10 h-10 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <SkeletonBlock className="h-3.5 w-2/3" />
              <SkeletonBlock className="h-3 w-1/3" />
            </div>
          </div>
          <SkeletonBlock className="h-3 w-full mt-4" />
          <SkeletonBlock className="h-3 w-5/6 mt-2" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton untuk Dashboard Overview selagi menarik data Sheets/Drive */
export function DashboardSkeleton() {
  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-2xl p-4 sm:p-5" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
        <div className="flex items-center justify-between mb-3">
          <SkeletonBlock className="w-40 h-4" />
          <SkeletonBlock className="w-16 h-3" />
        </div>
        <SkeletonBlock className="w-full h-2.5 rounded-full" />
        <div className="flex gap-4 mt-3">
          <SkeletonBlock className="w-20 h-3" />
          <SkeletonBlock className="w-24 h-3" />
          <SkeletonBlock className="w-16 h-3" />
        </div>
      </div>

      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl p-4 sm:p-5" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
          <div className="flex items-center justify-between mb-3">
            <SkeletonBlock className="w-32 h-4" />
            <SkeletonBlock className="w-14 h-3" />
          </div>
          <SkeletonBlock className="w-full h-2.5 rounded-full" />
          <div className="flex gap-4 mt-3">
            <SkeletonBlock className="w-20 h-3" />
            <SkeletonBlock className="w-24 h-3" />
            <SkeletonBlock className="w-16 h-3" />
          </div>
        </div>
      ))}
    </div>
  );
}
