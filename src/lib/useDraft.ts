import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

// Draf form disimpan di perangkat (localStorage), terikat ke akun yang login + identitas form
// (mis. "jurnal:2026-10-03"). Tujuannya: ketikan yang BELUM disimpan gak hilang kalau guru kepencet
// back, keluar aplikasi, HP pindah aplikasi, atau halaman ke-reload. Draf cuma ada di perangkat itu
// -- belum masuk ke management sampai guru tekan Simpan, dan dihapus otomatis begitu berhasil disimpan.

const PREFIX = "portal-draft:v1:";
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // draf lebih dari 14 hari dianggap basi

type Stored<T> = { v: T; t: number };

function readDraft<T>(key: string): Stored<T> | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Stored<T>) : null;
  } catch {
    return null;
  }
}

function writeDraft<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify({ v: value, t: Date.now() } satisfies Stored<T>));
  } catch {
    /* storage penuh/diblokir (mis. mode privat): abaikan, form tetap jalan normal */
  }
}

function removeDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Pasang draf otomatis ke 1 form.
 * - `formKey`  : identitas form (null = belum siap/gak ada form aktif).
 * - `value`    : isi form sekarang (state yang diketik guru).
 * - `baseline` : isi form yang TERAKHIR TERSIMPAN (dari server). Kalau value == baseline, gak ada draf.
 * - `setValue` : buat nerapin draf yang dipulihkan ke state form.
 * - `ready`    : true kalau data server udah dimuat (biar draf gak ketimpa/nimpa data yang belum nyampai).
 * Balikannya: `restored` (true selama isi form berasal dari draf), `discard()` (buang draf, balik ke
 * baseline), dan `clear()` (panggil setelah Simpan berhasil).
 */
export function useDraft<T>(opts: {
  formKey: string | null;
  value: T;
  baseline: T;
  setValue: (v: T) => void;
  ready?: boolean;
}) {
  const { formKey, value, baseline, setValue, ready = true } = opts;
  const { session } = useAuth();
  const uid = session?.user?.id ?? "anon";
  const key = formKey ? `${PREFIX}${uid}:${formKey}` : null;

  const [restored, setRestored] = useState(false);
  const restoredForKey = useRef<string | null>(null);
  const justRestored = useRef(false);
  const latest = useRef({ key, value, baseline, ready });
  latest.current = { key, value, baseline, ready };

  // Pulihkan draf: sekali per (form, akun), begitu data server siap.
  useEffect(() => {
    // Form lagi gak aktif / datanya lagi dimuat ulang: lupakan status "udah dipulihkan" biar pas
    // aktif lagi (mis. guru ganti pilihan lalu balik ke pilihan yang sama, dan form di-reset dari
    // sheet) drafnya dipulihkan lagi -- bukan malah dianggap sama dengan baseline lalu dihapus.
    if (!key || !ready) {
      restoredForKey.current = null;
      return;
    }
    if (restoredForKey.current === key) return;
    restoredForKey.current = key;
    const d = readDraft<T>(key);
    if (d && Date.now() - d.t < MAX_AGE_MS && !same(d.v, baseline)) {
      justRestored.current = true;
      setValue(d.v);
      setRestored(true);
    } else {
      if (d) removeDraft(key);
      setRestored(false);
    }
    // baseline sengaja gak jadi dependency: pemulihan cuma boleh jalan sekali per form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);

  // Simpan draf SETIAP isi form berubah, langsung (tanpa debounce): kalau ditunda, guru yang ngetik
  // terus lalu langsung kepencet back/pindah halaman bakal kehilangan ketikannya karena penundanya
  // ikut batal pas halaman ditutup. Nulis localStorage per ketikan itu murah.
  useEffect(() => {
    if (!key || !ready || restoredForKey.current !== key) return;
    if (justRestored.current) {
      justRestored.current = false;
      return;
    }
    if (same(value, baseline)) {
      removeDraft(key);
      setRestored(false);
      return;
    }
    writeDraft(key, value);
  }, [key, ready, value, baseline]);

  // Pas aplikasi disembunyiin / ditutup, tulis langsung (jangan nunggu debounce).
  useEffect(() => {
    const flush = () => {
      const c = latest.current;
      if (!c.key || !c.ready || restoredForKey.current !== c.key) return;
      if (!same(c.value, c.baseline)) writeDraft(c.key, c.value);
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  const clear = useCallback(() => {
    if (latest.current.key) removeDraft(latest.current.key);
    setRestored(false);
  }, []);

  const discard = useCallback(() => {
    if (latest.current.key) removeDraft(latest.current.key);
    setValue(latest.current.baseline);
    setRestored(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { restored, clear, discard };
}
