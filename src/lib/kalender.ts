import { supabase } from "./supabaseClient";
import { ramahkanGalat } from "./jaringan";
import { ymd } from "./jurnal";

// Kalender akademik: libur, ujian, kegiatan. Semua guru boleh baca, hanya management yang mengisi (aturan di database).

export type JenisAcara = "libur" | "ujian" | "kegiatan";
export type Acara = { id: string; judul: string; jenis: JenisAcara; tanggal_mulai: string; tanggal_selesai: string; catatan: string | null };

export const JENIS: Record<JenisAcara, { label: string; warna: string; latar: string }> = {
  libur: { label: "Libur", warna: "var(--c-bahaya)", latar: "var(--c-bahayaBg)" },
  ujian: { label: "Ujian", warna: "var(--c-emasTeks)", latar: "var(--c-emasBg)" },
  kegiatan: { label: "Kegiatan", warna: "var(--c-green)", latar: "var(--c-leaf)" },
};
export const JENIS_URUT: JenisAcara[] = ["libur", "ujian", "kegiatan"];

const KOLOM = "id, judul, jenis, tanggal_mulai, tanggal_selesai, catatan";

/** Acara yang menyentuh rentang tanggal [dari, sampai] (format YYYY-MM-DD), urut tanggal mulai. */
export async function bacaAcara(dari: string, sampai: string): Promise<Acara[]> {
  const { data, error } = await supabase
    .from("kalender_akademik")
    .select(KOLOM)
    .lte("tanggal_mulai", sampai)
    .gte("tanggal_selesai", dari)
    .order("tanggal_mulai");
  if (error) throw new Error(ramahkanGalat(error.message));
  return (data ?? []) as Acara[];
}

/** Acara yang belum lewat (mulai dari hari ini), paling dekat dulu. */
export async function bacaAcaraMendatang(batas = 3): Promise<Acara[]> {
  const { data, error } = await supabase
    .from("kalender_akademik")
    .select(KOLOM)
    .gte("tanggal_selesai", ymd(new Date()))
    .order("tanggal_mulai")
    .limit(batas);
  if (error) throw new Error(ramahkanGalat(error.message));
  return (data ?? []) as Acara[];
}

export async function simpanAcara(a: Omit<Acara, "id"> & { id?: string }): Promise<void> {
  const isi = { judul: a.judul.trim(), jenis: a.jenis, tanggal_mulai: a.tanggal_mulai, tanggal_selesai: a.tanggal_selesai, catatan: a.catatan?.trim() || null };
  const { error } = a.id ? await supabase.from("kalender_akademik").update(isi).eq("id", a.id) : await supabase.from("kalender_akademik").insert(isi);
  if (error) throw new Error(ramahkanGalat(error.message));
}

export async function hapusAcara(id: string): Promise<void> {
  const { error } = await supabase.from("kalender_akademik").delete().eq("id", id);
  if (error) throw new Error(ramahkanGalat(error.message));
}

/** Semua tanggal (YYYY-MM-DD) dalam [dari, sampai] yang tercakup acara bertipe libur. Dipakai untuk menghitung hari efektif. */
export async function tanggalLibur(dari: string, sampai: string): Promise<Set<string>> {
  const acara = (await bacaAcara(dari, sampai)).filter((a) => a.jenis === "libur");
  const out = new Set<string>();
  for (const a of acara) {
    const d = new Date(a.tanggal_mulai + "T00:00:00");
    const akhir = new Date(a.tanggal_selesai + "T00:00:00");
    while (d <= akhir) {
      const s = ymd(d);
      if (s >= dari && s <= sampai) out.add(s);
      d.setDate(d.getDate() + 1);
    }
  }
  return out;
}

/** Apakah acara mencakup tanggal itu. */
export const acaraPadaTanggal = (a: Acara, tgl: string) => a.tanggal_mulai <= tgl && tgl <= a.tanggal_selesai;

/** "12 Nov" atau "12-14 Nov" / "30 Nov - 2 Des". */
export function labelRentangAcara(a: Pick<Acara, "tanggal_mulai" | "tanggal_selesai">): string {
  const S = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const [, m1, d1] = a.tanggal_mulai.split("-").map(Number);
  const [, m2, d2] = a.tanggal_selesai.split("-").map(Number);
  if (a.tanggal_mulai === a.tanggal_selesai) return `${d1} ${S[m1 - 1]}`;
  return m1 === m2 ? `${d1}-${d2} ${S[m1 - 1]}` : `${d1} ${S[m1 - 1]} - ${d2} ${S[m2 - 1]}`;
}
