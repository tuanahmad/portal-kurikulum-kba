import { useEffect, useState } from "react";
import { C } from "../data";
import {
  pushSupported,
  isIosNotStandalone,
  getCurrentSubscription,
  enablePushNotifications,
  disablePushNotifications,
} from "../lib/pushNotif";

function BellIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 9a6 6 0 0 1 12 0v4.5l1.5 2.5h-15L6 13.5V9Z"
        stroke={color}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M9.5 18.5a2.5 2.5 0 0 0 5 0" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/** Toggle "Aktifkan Notifikasi" — pengingat lewat push notification browser (guru: harian
 *  Jurnal/Absen/Capaian Al-Qur'an; olahraga: bulanan Rencana/Evaluasi). Dipasang di ProfileMenu
 *  (mobile) & Sidebar (desktop). */
export function PushNotifToggle({ variant }: { variant: "light" | "dark" }) {
  const [status, setStatus] = useState<"loading" | "unsupported" | "ios-hint" | "off" | "on">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pushSupported()) {
      setStatus("unsupported");
      return;
    }
    if (isIosNotStandalone()) {
      setStatus("ios-hint");
      return;
    }
    getCurrentSubscription().then((sub) => setStatus(sub ? "on" : "off"));
  }, []);

  const color = variant === "dark" ? "rgba(255,255,255,0.88)" : C.ink;
  const mutedColor = variant === "dark" ? "rgba(255,255,255,0.6)" : C.muted;

  async function handleToggle() {
    setBusy(true);
    setError(null);
    const result = status === "on" ? await disablePushNotifications() : await enablePushNotifications();
    if (result.ok) {
      setStatus(status === "on" ? "off" : "on");
    } else {
      setError(result.error || "Gagal mengubah notifikasi.");
    }
    setBusy(false);
  }

  if (status === "loading" || status === "unsupported") return null;

  if (status === "ios-hint") {
    return (
      <div className="px-3.5 py-2.5 text-xs leading-relaxed" style={{ color: mutedColor }}>
        <div className="flex items-center gap-2 mb-1">
          <BellIcon color={mutedColor} />
          <span className="font-medium">Notifikasi</span>
        </div>
        Tambahkan Portal Guru ke Home Screen dulu (Share → Add to Home Screen) biar notifikasi bisa aktif di iPhone.
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handleToggle}
        disabled={busy}
        className="w-full flex items-center gap-3 rounded-xl px-3.5 py-3 transition-colors disabled:opacity-60"
        style={{ color }}
      >
        <BellIcon color={color} />
        <span className="text-sm font-medium flex-1 text-left">
          {busy ? "Memproses…" : status === "on" ? "Notifikasi Aktif" : "Aktifkan Notifikasi"}
        </span>
        {status === "on" && (
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "#4ADE80" }} aria-hidden="true" />
        )}
      </button>
      {error && (
        <p className="px-3.5 text-[11px]" style={{ color: "#E8A6A0" }}>
          {error}
        </p>
      )}
    </div>
  );
}
