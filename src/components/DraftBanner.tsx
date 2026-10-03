import { C } from "../data";

/** Pemberitahuan kecil: isi form ini dipulihkan dari draf di perangkat (belum disimpan/belum masuk
 *  ke management). Tombol "Buang draf" mengembalikan form ke data yang terakhir tersimpan. */
export function DraftBanner({ show, onDiscard }: { show: boolean; onDiscard: () => void }) {
  if (!show) return null;
  return (
    <div
      className="mt-3 rounded-xl px-3.5 py-2.5 flex items-start gap-3"
      style={{ background: "#FFF6DF", border: `1px solid ${C.gold}` }}
      role="status"
    >
      <p className="flex-1 text-xs leading-relaxed" style={{ color: "#6B5311" }}>
        <b>Ketikanmu dipulihkan.</b> Ini draf yang belum disimpan — masih di perangkat ini dan belum masuk ke
        management. Lanjutkan lalu tekan <b>Simpan</b>.
      </p>
      <button
        type="button"
        onClick={onDiscard}
        className="text-xs font-bold shrink-0 underline"
        style={{ color: "#6B5311" }}
      >
        Buang draf
      </button>
    </div>
  );
}
