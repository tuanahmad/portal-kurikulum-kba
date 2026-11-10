import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

/** Garis kecil di atas layar saat tanpa sinyal (HP melaporkan offline, atau aplikasi berjalan dari sesi tersimpan).
 *  Jujur soal apa yang berlaku: ketikan aman di HP, tetapi tombol Simpan baru berhasil setelah sinyal kembali. */
export function StatusKoneksi() {
  const { modeOffline } = useAuth();
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  useEffect(() => {
    const naik = () => setOnline(true);
    const turun = () => setOnline(false);
    window.addEventListener("online", naik);
    window.addEventListener("offline", turun);
    return () => {
      window.removeEventListener("online", naik);
      window.removeEventListener("offline", turun);
    };
  }, []);

  if (online && !modeOffline) return null;
  return (
    <div
      role="status"
      className="fixed top-0 inset-x-0 z-[60] px-3 py-1.5 text-center text-[11px] font-semibold leading-snug"
      style={{ background: "#FFF3D6", color: "#6B5314", borderBottom: "1px solid #EBD9A5" }}
    >
      Tanpa sinyal. Ketikanmu aman di HP; tombol Simpan baru berhasil setelah sinyal kembali.
    </div>
  );
}
