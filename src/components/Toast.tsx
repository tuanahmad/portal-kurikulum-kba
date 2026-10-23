import { useEffect, useState } from "react";
import { C } from "../data";

/** Notifikasi kecil yang hilang sendiri (mis. "Tersimpan"). Dipanggil dari mana saja: toast.sukses("Tersimpan").
 *  <ToastHost /> dipasang SATU kali di App. */
type Item = { id: number; teks: string; jenis: "sukses" | "galat" };
let daftar: Item[] = [];
let nomor = 1;
const pendengar = new Set<() => void>();
const kabari = () => pendengar.forEach((f) => f());

function tampil(teks: string, jenis: Item["jenis"]) {
  const id = nomor++;
  daftar = [...daftar.slice(-2), { id, teks, jenis }];
  kabari();
  setTimeout(() => {
    daftar = daftar.filter((x) => x.id !== id);
    kabari();
  }, jenis === "galat" ? 5000 : 2600);
}

export const toast = {
  sukses: (teks: string) => tampil(teks, "sukses"),
  galat: (teks: string) => tampil(teks, "galat"),
};

export function ToastHost() {
  const [, paksa] = useState(0);
  useEffect(() => {
    const f = () => paksa((n) => n + 1);
    pendengar.add(f);
    return () => {
      pendengar.delete(f);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      className="fixed left-0 right-0 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none"
      style={{ top: "calc(0.75rem + env(safe-area-inset-top, 0px))" }}
    >
      {daftar.map((x) => (
        <div
          key={x.id}
          role="status"
          className="toast-masuk inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg max-w-sm"
          style={{ background: x.jenis === "sukses" ? C.green : "#9F240B" }}
        >
          {x.jenis === "sukses" && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {x.teks}
        </div>
      ))}
    </div>
  );
}
