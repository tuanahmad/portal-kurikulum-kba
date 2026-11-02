// Isian angka Capaian Al-Qur'an (baris per pertemuan, putaran wirid). Google Sheet berbahasa Indonesia membaca koma sebagai
// desimal ("1,5" = angka), tetapi "1.5" atau "1/2" bisa dibaca sebagai TANGGAL. Maka isian dirapikan ke koma sebelum disimpan.
// Penjaga yang sama ada juga di server (supabase/functions/sheet-capaian-quran).

const PECAHAN: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75 };

/** Angka di AWAL isian: "5½" -> 5.5, "½" -> 0.5, "1,5" -> 1.5, "3 baris" -> 3. null kalau tidak diawali angka (PT, TS, -, kosong). */
export function angkaAwalQuran(v: unknown): number | null {
  const t = String(v ?? "").trim().replace(",", ".");
  const p = t.match(/^(\d+(?:\.\d+)?)?\s*([½¼¾])/);
  if (p) return (p[1] ? parseFloat(p[1]) : 0) + PECAHAN[p[2]];
  const m = t.match(/^\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

/** Seluruh isian harus angka: "5", "1,5", "5½", "½". null kalau ada tulisan lain (PT, "3 baris", ...). */
export function angkaPenuhQuran(v: unknown): number | null {
  const t = String(v ?? "").trim().replace(",", ".");
  if (/^\d+(?:\.\d+)?$/.test(t)) return parseFloat(t);
  const p = t.match(/^(\d+(?:\.\d+)?)?\s*([½¼¾])$/);
  return p ? (p[1] ? parseFloat(p[1]) : 0) + PECAHAN[p[2]] : null;
}

/** "1.5" -> "1,5"; "1/2" -> "0,5"; "1 1/2" -> "1,5"; "3/4" -> "0,75"; "5½" -> "5,5". Selain itu dikembalikan apa adanya (PT, TS, 4, 1,5, ...). */
export function normalisasiAngkaQuran(v: string): string {
  const t = (v ?? "").trim();
  if (!t) return v ?? "";
  const simbol = t.match(/^(\d+)?\s*([½¼¾])$/);
  if (simbol) return String((simbol[1] ? Number(simbol[1]) : 0) + PECAHAN[simbol[2]]).replace(".", ",");
  const pecahan = (b: number, a: number) => (b === 2 || b === 4) && a > 0 && a < b;
  let m = t.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (m && pecahan(Number(m[3]), Number(m[2]))) return String(Number(m[1]) + Number(m[2]) / Number(m[3])).replace(".", ",");
  m = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (m && pecahan(Number(m[2]), Number(m[1]))) return String(Number(m[1]) / Number(m[2])).replace(".", ",");
  if (/^\d+\.\d+$/.test(t)) return t.replace(".", ",");
  return v;
}
