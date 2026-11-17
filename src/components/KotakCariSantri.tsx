import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { C, KELAS_LIST, capaianRoster } from "../data";

const rapikan = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

/** Kotak "Cari santri" untuk management: ketik sebagian nama (huruf besar/kecil dan tanda baca diabaikan), ketuk hasilnya, dan
 *  langsung masuk ke profil ringkas santri itu. Daftar santri diambil dari roster yang sudah dimuat setelah login. */
export function KotakCariSantri() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const semua = useMemo(() => KELAS_LIST.flatMap((k) => capaianRoster(k.name).map((nama) => ({ nama, kelas: k.name, kunci: rapikan(nama) }))), []);

  const kata = rapikan(q).split(" ").filter(Boolean);
  const hasil = kata.length ? semua.filter((s) => kata.every((w) => s.kunci.includes(w))).slice(0, 8) : [];

  const buka = (s: { nama: string; kelas: string }) => nav(`/santri?kelas=${encodeURIComponent(s.kelas)}&nama=${encodeURIComponent(s.nama)}`);

  return (
    <div className="mb-4">
      <label className="relative block">
        <span className="sr-only">Cari santri</span>
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color: C.muted }}>
          <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && hasil.length === 1) buka(hasil[0]);
          }}
          placeholder="Cari santri…"
          autoComplete="off"
          className="w-full rounded-2xl pl-11 pr-4 py-3 text-sm outline-none"
          style={{ background: C.card, border: `1px solid ${C.line}`, color: C.ink }}
        />
      </label>
      {kata.length > 0 && (
        <ul className="mt-2 rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.line}` }}>
          {hasil.length === 0 ? (
            <li className="px-4 py-3 text-sm" style={{ color: C.muted }}>Tidak ada santri dengan nama itu.</li>
          ) : (
            hasil.map((s, i) => (
              <li key={s.kelas + s.nama} style={{ borderTop: i ? `1px solid ${C.line}` : undefined }}>
                <button type="button" onClick={() => buka(s)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left active:opacity-70">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: C.leaf, color: C.green }}>
                    {s.nama.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold truncate" style={{ color: C.ink }}>{s.nama}</span>
                    <span className="block text-xs truncate" style={{ color: C.muted }}>{s.kelas}</span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
