import { supabase } from "./supabaseClient";
import { ramahkanGalat } from "./jaringan";
import { TINGKAT_LIST, type OlahragaKelompok, type OlahragaTingkat } from "./olahraga";
import type { SantriStatus } from "./absenSantri";

// Absen SANTRI di pelajaran olahraga: per tanggal (Senin-Rabu), per tingkat KA 1-3, per kelompok (ikhwan/akhwat).
// Satu sesi sehari, hanya Hadir / Tidak Hadir + keterangan. Baris tersimpan = sudah diabsen.

export type EntriSantriOlahraga = { status: SantriStatus; keterangan: string };
/** tingkat -> nama santri -> entri */
export type AbsenHariOlahraga = Partial<Record<OlahragaTingkat, Record<string, EntriSantriOlahraga>>>;

export const entriBaru = (): EntriSantriOlahraga => ({ status: "hadir", keterangan: "" });

/** Absen satu tanggal. `by`: { userId } (guru olahraga) atau { kelompok } (management). */
export async function bacaAbsenSantriOlahraga(tanggal: string, by: { userId?: string; kelompok?: OlahragaKelompok }): Promise<AbsenHariOlahraga> {
  let q = supabase.from("absen_santri_olahraga").select("tingkat, nama_santri, status, keterangan").eq("tanggal", tanggal);
  if (by.userId) q = q.eq("user_id", by.userId);
  else if (by.kelompok) q = q.eq("kelompok", by.kelompok);
  const { data, error } = await q;
  if (error) throw new Error(ramahkanGalat(error.message));
  const out: AbsenHariOlahraga = {};
  for (const r of data ?? []) {
    const t = r.tingkat as OlahragaTingkat;
    (out[t] ??= {})[r.nama_santri as string] = { status: (r.status as SantriStatus) ?? "hadir", keterangan: (r.keterangan as string) ?? "" };
  }
  return out;
}

/** Simpan absen satu tanggal untuk seluruh tingkat dan santri yang dikirim. Dibaca balik; kalau tidak sama, dilempar galat. */
export async function simpanAbsenSantriOlahraga(kelompok: OlahragaKelompok, tanggal: string, isi: Record<OlahragaTingkat, Record<string, EntriSantriOlahraga>>): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesi login habis, coba masuk lagi.");
  const rows = TINGKAT_LIST.flatMap((t) =>
    Object.entries(isi[t] ?? {}).map(([nama, e]) => ({
      user_id: user.id,
      kelompok,
      tingkat: t,
      tanggal,
      nama_santri: nama,
      status: e.status,
      keterangan: e.status === "hadir" ? "" : e.keterangan.trim(),
    }))
  );
  if (!rows.length) return;
  const { error } = await supabase.from("absen_santri_olahraga").upsert(rows, { onConflict: "kelompok,tingkat,tanggal,nama_santri" });
  if (error) throw new Error(ramahkanGalat(error.message));

  const balik = await bacaAbsenSantriOlahraga(tanggal, { userId: user.id });
  const beda = rows.filter((r) => {
    const x = balik[r.tingkat as OlahragaTingkat]?.[r.nama_santri];
    return !x || x.status !== r.status || x.keterangan !== r.keterangan;
  }).length;
  if (beda > 0) throw new Error(`${beda} santri belum tercatat di server. Ketikanmu masih aman di perangkat; tekan Simpan sekali lagi.`);
}

/** Sudah diabsen = ada baris untuk tingkat itu. */
export const sudahDiabsen = (a: AbsenHariOlahraga | undefined, t: OlahragaTingkat) => !!a && Object.keys(a[t] ?? {}).length > 0;

export type BarisAbsenSantriOlahraga = { kelompok: OlahragaKelompok; tingkat: OlahragaTingkat; tanggal: string; nama_santri: string; status: SantriStatus; keterangan: string };

/** Absen semua kelompok dalam rentang tanggal (management, hanya baca). */
export async function bacaAbsenSantriOlahragaRentang(dari: string, sampai: string): Promise<BarisAbsenSantriOlahraga[]> {
  const { data, error } = await supabase
    .from("absen_santri_olahraga")
    .select("kelompok, tingkat, tanggal, nama_santri, status, keterangan")
    .gte("tanggal", dari)
    .lte("tanggal", sampai);
  if (error) throw new Error(ramahkanGalat(error.message));
  return (data ?? []) as BarisAbsenSantriOlahraga[];
}
