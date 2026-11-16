import { useEffect, useState } from "react";
import { C } from "../data";
import { toast } from "./Toast";
import { pushSupported, isIosNotStandalone, getCurrentSubscription, enablePushNotifications } from "../lib/pushNotif";

const KUNCI_NANTI = "notif-ajakan-nanti";
const JEDA_HARI = 3;

const sudahDitunda = () => {
  try {
    const t = Number(localStorage.getItem(KUNCI_NANTI) ?? 0);
    return t > 0 && Date.now() - t < JEDA_HARI * 86400000;
  } catch {
    return false;
  }
};

/** Kartu ajakan di Beranda guru: muncul selama notifikasi belum aktif di perangkat ini. Izin notifikasi harus diberikan guru
 *  sendiri di HP-nya (tidak bisa diaktifkan dari server), jadi dibuat semudah mungkin: satu ketukan "Aktifkan". */
export function KartuAktifkanNotif() {
  const [status, setStatus] = useState<"loading" | "sembunyi" | "off" | "ios" | "diblokir">("loading");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    if (!pushSupported()) {
      // iPhone di Safari biasa (belum di Layar Utama) tidak punya PushManager: beri petunjuk, bukan diam.
      setStatus(isIosNotStandalone() ? "ios" : "sembunyi");
      return;
    }
    if (isIosNotStandalone()) {
      setStatus("ios");
      return;
    }
    getCurrentSubscription()
      .then((sub) => {
        if (sub) setStatus("sembunyi");
        else if (Notification.permission === "denied") setStatus("diblokir");
        else setStatus(sudahDitunda() ? "sembunyi" : "off");
      })
      .catch(() => setStatus("sembunyi"));
  }, []);

  if (status === "loading" || status === "sembunyi") return null;

  async function aktifkan() {
    setSibuk(true);
    setGalat(null);
    const r = await enablePushNotifications();
    setSibuk(false);
    if (r.ok) {
      toast.sukses("Notifikasi aktif");
      setStatus("sembunyi");
    } else {
      if (typeof Notification !== "undefined" && Notification.permission === "denied") setStatus("diblokir");
      else setGalat(r.error || "Gagal mengaktifkan notifikasi.");
    }
  }

  function nanti() {
    try {
      localStorage.setItem(KUNCI_NANTI, String(Date.now()));
    } catch {
      /* abaikan */
    }
    setStatus("sembunyi");
  }

  const isi =
    status === "ios"
      ? "Di iPhone: ketuk Bagikan → Tambahkan ke Layar Utama, lalu buka Portal Guru dari ikon itu dan aktifkan notifikasi dari menu profil."
      : status === "diblokir"
        ? "Notifikasi diblokir di pengaturan HP. Buka pengaturan situs/aplikasi ini, izinkan Notifikasi, lalu muat ulang."
        : "Dapat pengingat absen, dan di Android bisa absen langsung dari notifikasi tanpa membuka aplikasi.";

  return (
    <div className="mb-4 rounded-2xl p-3.5" style={{ background: "#FFF8E6", border: "1px solid #EBD79B" }} role="region" aria-label="Aktifkan notifikasi">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#F3E3B0" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 9a6 6 0 0 1 12 0v4.5l1.5 2.5h-15L6 13.5V9Z" stroke="#8A6A20" strokeWidth="1.7" strokeLinejoin="round" />
            <path d="M9.5 18.5a2.5 2.5 0 0 0 5 0" stroke="#8A6A20" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold" style={{ color: C.ink }}>Aktifkan notifikasi absen</div>
          <p className="mt-0.5 text-xs leading-relaxed" style={{ color: C.muted }}>{isi}</p>
          {galat && <p className="mt-1 text-xs" style={{ color: "#8A2A20" }}>{galat}</p>}
          {status === "off" && (
            <div className="mt-2.5 flex items-center gap-3">
              <button type="button" onClick={aktifkan} disabled={sibuk} className="px-4 py-2 rounded-xl text-sm font-bold" style={{ background: C.green, color: "#FFF", opacity: sibuk ? 0.6 : 1 }}>
                {sibuk ? "Memproses…" : "Aktifkan"}
              </button>
              <button type="button" onClick={nanti} className="text-xs font-semibold" style={{ color: C.muted }}>Nanti</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
