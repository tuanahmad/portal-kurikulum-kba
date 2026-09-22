import { supabase } from "./supabaseClient";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

/** Browser (termasuk Safari iOS 16.4+, tapi cuma kalau udah "Add to Home Screen") dukung Push API. */
export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** iOS Safari cuma bisa nerima push kalau situsnya udah ditambahkan ke Home Screen (berjalan
 *  sebagai PWA berdiri sendiri) — di luar itu, PushManager ada tapi subscribe-nya gagal diam-diam. */
export function isIosNotStandalone(): boolean {
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
  return isIos && !isStandalone;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function authHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${session?.access_token ?? SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
  };
}

/** Status subscription browser SAAT INI (bukan tanya server — cukup cepat buat dipanggil pas render). */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

/** Minta izin notifikasi (kalau belum), daftarin service worker, subscribe ke push, simpan ke server. */
export async function enablePushNotifications(): Promise<{ ok: boolean; error?: string }> {
  if (!pushSupported()) return { ok: false, error: "Browser ini belum dukung notifikasi." };
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, error: "Izin notifikasi ditolak." };

    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    }

    const json = sub.toJSON();
    const headers = await authHeaders();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/save-push-subscription`, {
      method: "POST",
      headers,
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body?.error || `Gagal simpan (${res.status})` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Matikan notifikasi — unsubscribe di browser + hapus record di server. */
export async function disablePushNotifications(): Promise<{ ok: boolean; error?: string }> {
  try {
    const sub = await getCurrentSubscription();
    if (!sub) return { ok: true };
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    const headers = await authHeaders();
    await fetch(`${SUPABASE_URL}/functions/v1/save-push-subscription`, {
      method: "DELETE",
      headers,
      body: JSON.stringify({ endpoint }),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
