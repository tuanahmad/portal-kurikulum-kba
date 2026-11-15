import { ymd, mondayOf, readJurnalRange, isEntryFilled } from "./jurnal";
import { readAbsenRange, isAbsenLengkap } from "./absen";
import { tanggalLibur } from "./kalender";

// Pengingat rutin di Kalender (dihitung dari tanggal, tidak disimpan di database):
//   1. Setiap Jumat          -> isi Capaian Al-Qur'an
//   2. Akhir bulan (30/31)   -> isi Refleksi dan Capaian Ilmu
//   3. Tanggal 1-5 tiap bulan -> isi RPB
//   4. Setiap Jumat, khusus guru yang jurnal/absen pekan itu belum lengkap -> lengkapi jurnal dan absen

export type KeyPengingat = "quran" | "akhirBulan" | "rpb" | "lengkapi";
export type Pengingat = { key: KeyPengingat; judul: string; warna: string; latar: string };

export const PENGINGAT: Record<KeyPengingat, Pengingat> = {
  quran: { key: "quran", judul: "Isi Capaian Al-Qur'an", warna: "#8A6A20", latar: "#FFF1D6" },
  akhirBulan: { key: "akhirBulan", judul: "Isi Refleksi dan Capaian Ilmu", warna: "#274C74", latar: "#E3EDF8" },
  rpb: { key: "rpb", judul: "Isi RPB", warna: "#1C5A52", latar: "#DDF1EE" },
  lengkapi: { key: "lengkapi", judul: "Lengkapi Jurnal dan Absen", warna: "#B3261E", latar: "#FDEBEA" },
};

/** Aturan rutin untuk satu tanggal. `lengkapi` ditambahkan terpisah (butuh data guru). */
export function pengingatRutin(tgl: Date): Pengingat[] {
  const out: Pengingat[] = [];
  const hari = tgl.getDate();
  const akhir = new Date(tgl.getFullYear(), tgl.getMonth() + 1, 0).getDate();
  if (tgl.getDay() === 5) out.push(PENGINGAT.quran);
  if (hari === akhir) out.push(PENGINGAT.akhirBulan);
  if (hari >= 1 && hari <= 5) out.push(PENGINGAT.rpb);
  return out;
}

/** Jumat pekan ini (YYYY-MM-DD) dan hari kerja pekan ini yang jurnal atau absennya belum lengkap (sampai hari ini). */
export async function bacaKekuranganPekanIni(userId: string): Promise<{ jumat: string; hari: string[] }> {
  const senin = mondayOf(new Date());
  const jumatD = new Date(senin);
  jumatD.setDate(senin.getDate() + 4);
  const hariIni = ymd(new Date());
  const dari = ymd(senin);
  const sampai = ymd(jumatD) < hariIni ? ymd(jumatD) : hariIni;
  const [jurnal, absen, libur] = await Promise.all([
    readJurnalRange(dari, sampai, { userId }),
    readAbsenRange(dari, sampai, { userId }),
    tanggalLibur(dari, sampai).catch(() => new Set<string>()),
  ]);
  const kurang: string[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(senin);
    d.setDate(senin.getDate() + i);
    const k = ymd(d);
    if (k > sampai || libur.has(k)) continue;
    if (!isEntryFilled(jurnal[k]) || !isAbsenLengkap(absen[k])) kurang.push(k);
  }
  return { jumat: ymd(jumatD), hari: kurang };
}
