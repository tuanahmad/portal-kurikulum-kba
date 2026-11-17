import { C } from "../data";
import { ramahkanGalat } from "../lib/jaringan";

/** Ditampilkan GANTI form kalau data dari server gagal dimuat. Form kosong + tombol Simpan berbahaya: menyimpan di
 *  keadaan itu bisa menimpa data yang sudah ada dengan isian kosong. */
export function GagalMuat({ pesan, onUlang }: { pesan: string; onUlang: () => void }) {
  return (
    <div className="mt-5 rounded-2xl p-5 text-center" style={{ background: C.card, border: `1px solid var(--c-bahayaGaris)` }}>
      <div className="text-sm font-semibold" style={{ color: "var(--c-bahayaTeks)" }}>Data belum bisa dimuat</div>
      <p className="mt-1.5 text-xs leading-relaxed" style={{ color: C.muted }}>
        Formulir disembunyikan supaya isianmu tidak menimpa data yang sudah tersimpan. Periksa sinyal, lalu coba lagi.
      </p>
      <p className="mt-2 text-[11px] break-words" style={{ color: "var(--c-bahayaTeks)" }}>{ramahkanGalat(pesan)}</p>
      <button
        type="button"
        onClick={onUlang}
        className="mt-3.5 px-5 py-2.5 rounded-xl text-sm font-bold"
        style={{ background: C.green, color: "#FFF" }}
      >
        Coba lagi
      </button>
    </div>
  );
}
