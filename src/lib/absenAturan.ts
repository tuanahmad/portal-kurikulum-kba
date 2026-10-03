// Aturan kedisiplinan jam guru buat rekap absen bulanan (management). Semua angka di sini sengaja
// dikumpulin di 1 tempat biar gampang diubah kalau kebijakan jamnya berubah.

const menit = (h: number, m = 0) => h * 60 + m;

/** Datang: TANPA toleransi -- lewat semenit pun merah. */
export const DATANG_PAGI = menit(6, 30);
export const DATANG_SIANG = menit(14, 0);
export const PULANG_SIANG = menit(15, 30);
/** Pulang: merah kalau lebih awal dari (jam ideal - toleransi). Pulang lebih lambat gak masalah. */
export const TOLERANSI_PULANG = 30;

/** Jam pulang pagi ideal: Kuttab Awwal 1A & 1B 10.30; kelas lain 11.00. (Kuttab Awwal 2/3
 *  belum dikonfirmasi -- sementara ikut 11.00 kayak Qonuni; ubah di sini kalau beda.) */
export function pulangPagiIdeal(kelas: string): number {
  return kelas === "Kuttab Awwal 1A" || kelas === "Kuttab Awwal 1B" ? menit(10, 30) : menit(11, 0);
}

export function hmToMenit(hm: string | null | undefined): number | null {
  const m = String(hm ?? "").match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** true = terlambat datang. null jam = belum ada data (bukan terlambat). */
export function telatDatang(jam: string | null | undefined, ideal: number): boolean {
  const m = hmToMenit(jam);
  return m != null && m > ideal;
}

/** true = pulang lebih awal dari batas (ideal - toleransi). */
export function pulangAwal(jam: string | null | undefined, ideal: number): boolean {
  const m = hmToMenit(jam);
  return m != null && m < ideal - TOLERANSI_PULANG;
}
