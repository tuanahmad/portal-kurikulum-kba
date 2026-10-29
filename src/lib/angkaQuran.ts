// Isian angka Capaian Al-Qur'an (baris per pertemuan, putaran wirid). Google Sheet berbahasa Indonesia membaca koma sebagai
// desimal ("1,5" = angka), tetapi "1.5" atau "1/2" bisa dibaca sebagai TANGGAL. Maka isian dirapikan ke koma sebelum disimpan.
// Penjaga yang sama ada juga di server (supabase/functions/sheet-capaian-quran).

/** "1.5" -> "1,5"; "1/2" -> "0,5"; "1 1/2" -> "1,5"; "3/4" -> "0,75". Selain itu dikembalikan apa adanya (PT, TS, 4, 1,5, ...). */
export function normalisasiAngkaQuran(v: string): string {
  const t = (v ?? "").trim();
  if (!t) return v ?? "";
  const pecahan = (b: number, a: number) => (b === 2 || b === 4) && a > 0 && a < b;
  let m = t.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (m && pecahan(Number(m[3]), Number(m[2]))) return String(Number(m[1]) + Number(m[2]) / Number(m[3])).replace(".", ",");
  m = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (m && pecahan(Number(m[2]), Number(m[1]))) return String(Number(m[1]) / Number(m[2])).replace(".", ",");
  if (/^\d+\.\d+$/.test(t)) return t.replace(".", ",");
  return v;
}
