import { supabase } from "./supabaseClient";
import { ramahkanGalat } from "./jaringan";

/** 114 surat Al-Qur'an, urut mushaf. */
export const DAFTAR_SURAT: string[] = [
  "Al-Fatihah", "Al-Baqarah", "Ali 'Imran", "An-Nisa'", "Al-Ma'idah", "Al-An'am", "Al-A'raf", "Al-Anfal", "At-Taubah", "Yunus",
  "Hud", "Yusuf", "Ar-Ra'd", "Ibrahim", "Al-Hijr", "An-Nahl", "Al-Isra'", "Al-Kahf", "Maryam", "Taha",
  "Al-Anbiya'", "Al-Hajj", "Al-Mu'minun", "An-Nur", "Al-Furqan", "Asy-Syu'ara'", "An-Naml", "Al-Qasas", "Al-'Ankabut", "Ar-Rum",
  "Luqman", "As-Sajdah", "Al-Ahzab", "Saba'", "Fatir", "Yasin", "As-Saffat", "Sad", "Az-Zumar", "Gafir",
  "Fussilat", "Asy-Syura", "Az-Zukhruf", "Ad-Dukhan", "Al-Jasiyah", "Al-Ahqaf", "Muhammad", "Al-Fath", "Al-Hujurat", "Qaf",
  "Az-Zariyat", "At-Tur", "An-Najm", "Al-Qamar", "Ar-Rahman", "Al-Waqi'ah", "Al-Hadid", "Al-Mujadalah", "Al-Hasyr", "Al-Mumtahanah",
  "As-Saff", "Al-Jumu'ah", "Al-Munafiqun", "At-Tagabun", "At-Talaq", "At-Tahrim", "Al-Mulk", "Al-Qalam", "Al-Haqqah", "Al-Ma'arij",
  "Nuh", "Al-Jinn", "Al-Muzzammil", "Al-Muddassir", "Al-Qiyamah", "Al-Insan", "Al-Mursalat", "An-Naba'", "An-Nazi'at", "'Abasa",
  "At-Takwir", "Al-Infitar", "Al-Mutaffifin", "Al-Insyiqaq", "Al-Buruj", "At-Tariq", "Al-A'la", "Al-Gasyiyah", "Al-Fajr", "Al-Balad",
  "Asy-Syams", "Al-Lail", "Ad-Duha", "Asy-Syarh", "At-Tin", "Al-'Alaq", "Al-Qadr", "Al-Bayyinah", "Az-Zalzalah", "Al-'Adiyat",
  "Al-Qari'ah", "At-Takasur", "Al-'Asr", "Al-Humazah", "Al-Fil", "Quraisy", "Al-Ma'un", "Al-Kausar", "Al-Kafirun", "An-Nasr",
  "Al-Masad", "Al-Ikhlas", "Al-Falaq", "An-Nas",
];

/** Bagian capaian yang bacaannya berupa surat (Baghdadiyah belajar membaca huruf/kitab, bukan surat). */
export const bagianPunyaSurat = (namaBagian: string): boolean => !/baghdadiyah/i.test(namaBagian);

/** Kunci peta surat: `${bagian}|${slot}|${nama santri}`. */
export const kunciSurat = (bagian: string, slot: number, nama: string) => `${bagian}|${slot}|${nama}`;

/** Semua surat yang tercatat untuk satu kelas pada satu bulan (semua bagian & slot). */
export async function bacaSuratBulan(kelas: string, bulan: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("capaian_quran_surat")
    .select("section, slot, nama_santri, surat")
    .eq("kelas", kelas)
    .eq("bulan", bulan);
  if (error) throw new Error(ramahkanGalat(error.message));
  const out: Record<string, string> = {};
  for (const r of data ?? []) out[kunciSurat(r.section as string, r.slot as number, r.nama_santri as string)] = r.surat as string;
  return out;
}

/** Simpan surat untuk satu bagian + satu slot. Entri berisi surat -> disimpan; entri kosong -> catatan lamanya dihapus.
 *  Sesudahnya dibaca balik: kalau tidak sama dengan yang dikirim, dilempar galat (jangan ada "Tersimpan" palsu). */
export async function simpanSurat(p: {
  kelas: string;
  bulan: string;
  bagian: string;
  slot: number;
  entri: { nama: string; surat: string }[];
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesi login habis, coba masuk lagi.");

  const isi = p.entri.filter((e) => e.surat.trim());
  const kosong = p.entri.filter((e) => !e.surat.trim()).map((e) => e.nama);

  if (isi.length) {
    const { error } = await supabase.from("capaian_quran_surat").upsert(
      isi.map((e) => ({ user_id: user.id, kelas: p.kelas, bulan: p.bulan, section: p.bagian, slot: p.slot, nama_santri: e.nama, surat: e.surat })),
      { onConflict: "kelas,bulan,section,slot,nama_santri" }
    );
    if (error) throw new Error(ramahkanGalat(error.message));
  }
  if (kosong.length) {
    const { error } = await supabase
      .from("capaian_quran_surat")
      .delete()
      .eq("kelas", p.kelas)
      .eq("bulan", p.bulan)
      .eq("section", p.bagian)
      .eq("slot", p.slot)
      .in("nama_santri", kosong);
    if (error) throw new Error(ramahkanGalat(error.message));
  }

  const { data, error } = await supabase
    .from("capaian_quran_surat")
    .select("nama_santri, surat")
    .eq("kelas", p.kelas)
    .eq("bulan", p.bulan)
    .eq("section", p.bagian)
    .eq("slot", p.slot);
  if (error) throw new Error(ramahkanGalat(error.message));
  const tersimpan = new Map((data ?? []).map((r) => [r.nama_santri as string, r.surat as string]));
  const gagal = p.entri.filter((e) => (e.surat.trim() ? tersimpan.get(e.nama) !== e.surat : tersimpan.has(e.nama))).length;
  if (gagal > 0) throw new Error(`${gagal} pilihan surat belum tercatat di server. Pilihanmu masih aman di perangkat; tekan Simpan sekali lagi.`);
}
