// Aturan kedisiplinan jam guru buat rekap absen bulanan (management). Semua angka di sini sengaja
// dikumpulin di 1 tempat biar gampang diubah kalau kebijakan jamnya berubah.

const menit = (h: number, m = 0) => h * 60 + m;

/** Jam datang ideal. Terlambat = lewat (jam ideal + toleransi hari itu), lihat toleransiDatang(). */
export const DATANG_PAGI = menit(6, 30);
export const DATANG_SIANG = menit(14, 0);
export const PULANG_SIANG = menit(15, 30);
/** Pulang: merah kalau lebih awal dari (jam ideal - toleransi). Pulang lebih lambat gak masalah. */
export const TOLERANSI_PULANG = 30;

/** Toleransi datang (menit) menurut tanggal: sampai 14 Oktober 2026 (September dan 2 pekan awal
 *  Oktober) 10 menit; mulai 15 Oktober 2026 (2 pekan pertengahan & akhir Oktober dan seterusnya) 5 menit.
 *  Tanggal di luar yang disebut kebijakan (sebelum September, setelah Oktober) ikut aturan terdekat:
 *  sebelum 15 Okt = 10 menit, mulai 15 Okt = 5 menit. Ubah di sini kalau kebijakan berubah. */
export const TOLERANSI_DATANG_BERUBAH_MULAI = "2026-10-15";
export const TOLERANSI_DATANG_AWAL = 10;
export const TOLERANSI_DATANG_SESUDAH = 5;
export function toleransiDatang(tanggalYmd: string): number {
  return tanggalYmd < TOLERANSI_DATANG_BERUBAH_MULAI ? TOLERANSI_DATANG_AWAL : TOLERANSI_DATANG_SESUDAH;
}
/** Kalimat penjelas aturan datang -- dipakai di legenda tabel/PDF. */
export const LEGENDA_DATANG = "datang terlambat (pagi lewat 06.30, siang lewat 14.00, ditambah toleransi 10 menit sampai 14 Oktober dan 5 menit mulai 15 Oktober)";

/** Jam pulang pagi ideal: Kuttab Awwal 1A & 1B 10.30; semua kelas lain (KA 2, KA 3, Qonuni) 11.00
 *  (dikonfirmasi koordinator kurikulum). */
export function pulangPagiIdeal(kelas: string): number {
  return kelas === "Kuttab Awwal 1A" || kelas === "Kuttab Awwal 1B" ? menit(10, 30) : menit(11, 0);
}

export function hmToMenit(hm: string | null | undefined): number | null {
  const m = String(hm ?? "").match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** true = terlambat datang (lewat jam ideal + toleransi pada tanggal itu). null jam = belum ada data. */
export function telatDatang(jam: string | null | undefined, ideal: number, tanggalYmd: string): boolean {
  const m = hmToMenit(jam);
  return m != null && m > ideal + toleransiDatang(tanggalYmd);
}

/** true = pulang lebih awal dari batas (ideal - toleransi). */
export function pulangAwal(jam: string | null | undefined, ideal: number): boolean {
  const m = hmToMenit(jam);
  return m != null && m < ideal - TOLERANSI_PULANG;
}

/** Membaca AM/PM dengan akal sehat (data di database TIDAK diubah, hanya cara membacanya): jam kelas siang
 *  yang tercatat sebelum tengah hari (mis. 02.13) dibaca sebagai sore (14.13); jam datang kelas pagi yang
 *  tercatat setelah tengah hari (mis. 18.30) dibaca sebagai pagi (06.30). Keputusan koordinator kurikulum:
 *  guru boleh mengisi AM/PM-nya terserah, aplikasi yang menafsirkan. Hasil "HH:MM" atau null. */
export function normalisasiJam(jam: string | null | undefined, sesi: "pagi" | "siang", jenis: "datang" | "pulang"): string | null {
  const m = hmToMenit(jam);
  if (m == null) return null;
  let n = m;
  if (sesi === "siang" && m < menit(12)) n = m + menit(12);
  else if (sesi === "pagi" && jenis === "datang" && m >= menit(12)) n = m - menit(12);
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
}

/** Jam yang MASIH tidak masuk akal sesudah dinormalisasi (mis. kelas siang datang 18.06 atau pulang 22.44).
 *  Hanya ditandai (kuning) dan TIDAK dihitung telat/pulang awal -- tidak ditebak lebih jauh. */
export function jamGanjil(jamNormal: string | null | undefined, sesi: "pagi" | "siang", jenis: "datang" | "pulang"): boolean {
  const m = hmToMenit(jamNormal);
  if (m == null) return false;
  if (sesi === "siang") return jenis === "datang" ? m < menit(12) || m >= menit(18) : m < menit(13) || m > menit(20);
  return jenis === "datang" ? m < menit(4) || m >= menit(12) : false;
}
export const LEGENDA_GANJIL =
  "Jam kelas siang yang tercatat sebelum tengah hari dibaca sebagai sore (02.13 menjadi 14.13). Kuning = jam yang tetap tidak wajar setelah dibaca begitu, tidak dihitung telat/pulang awal.";
