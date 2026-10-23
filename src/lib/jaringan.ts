import { supabase } from "./supabaseClient";

/** Pemanggilan fungsi server yang lebih tahan sinyal HP: batas waktu, ulang 1x kalau koneksi putus / server sibuk,
 *  dan segarkan login 1x kalau ditolak (401). Aman diulang karena semua penulisan menimpa isi yang sama. */
const tunggu = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const PESAN_KONEKSI = "Koneksi bermasalah atau terlalu lambat. Ketikanmu masih aman di perangkat; periksa sinyal lalu coba lagi.";

export async function panggilFungsi(url: string, buatInit: () => Promise<RequestInit>, opsi: { batasMs?: number; ulang?: number } = {}): Promise<Response> {
  const { batasMs = 30000, ulang = 1 } = opsi;
  for (let i = 0; i <= ulang; i++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), batasMs);
    try {
      const init = await buatInit();
      const res = await fetch(url, { ...init, signal: ctl.signal });
      if (res.status === 401 && i < ulang) {
        await supabase.auth.refreshSession().catch(() => undefined);
        continue;
      }
      if ([429, 502, 503, 504].includes(res.status) && i < ulang) {
        await tunggu(1500);
        continue;
      }
      return res;
    } catch {
      if (i < ulang) await tunggu(1500);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(PESAN_KONEKSI);
}

/** Baca JSON dari respons; null kalau isinya bukan JSON (mis. halaman galat dari server). */
export async function bacaJson(res: Response): Promise<any | null> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/** Ubah pesan galat teknis dari jaringan jadi kalimat yang jelas. */
export function ramahkanGalat(pesan: string): string {
  return /failed to fetch|networkerror|load failed|network request failed|aborted/i.test(pesan) ? PESAN_KONEKSI : pesan;
}

const rapikan = (s: unknown) => {
  const t = String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  return /^-?\d+([.,]\d+)?$/.test(t) ? String(Number(t.replace(",", "."))) : t;
};

/** Apakah isian yang kita tulis sama dengan yang terbaca balik dari file (toleran spasi/huruf besar/koma-titik/angka nol di depan). */
export function isianSama(ditulis: string, terbaca: string): boolean {
  return rapikan(ditulis) === rapikan(terbaca);
}

function kumpulTeks(x: unknown, keluar: string[]) {
  if (x == null) return;
  if (typeof x === "string" || typeof x === "number" || typeof x === "boolean") {
    const t = String(x).trim();
    if (t) keluar.push(t);
  } else if (Array.isArray(x)) x.forEach((v) => kumpulTeks(v, keluar));
  else if (typeof x === "object") Object.values(x as Record<string, unknown>).forEach((v) => kumpulTeks(v, keluar));
}

/** Berapa teks (panjang >= 3) pada `ditulis` yang TIDAK ditemukan di `terbaca`. 0 = semua tersimpan. */
export function hitungTeksHilang(ditulis: unknown, terbaca: unknown): number {
  const a: string[] = [];
  const b: string[] = [];
  kumpulTeks(ditulis, a);
  kumpulTeks(terbaca, b);
  const ada = new Set(b.map(rapikan));
  return a.filter((t) => t.length >= 3 && !t.startsWith("=") && !ada.has(rapikan(t))).length;
}
