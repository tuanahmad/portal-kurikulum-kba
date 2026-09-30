import { supabase } from "./supabaseClient";

export type { SesiKey } from "./absen";
export { SESI_LIST, SESI_LABEL, ymd, mondayOf, weekdaysFrom, labelHari, labelTanggal, labelRentangPekan } from "./absen";

export type SantriStatus = "hadir" | "tidak_hadir";

export const SANTRI_STATUS_LABEL: Record<SantriStatus, string> = {
  hadir: "Hadir",
  tidak_hadir: "Tidak Hadir",
};

export type SantriSesiEntry = {
  status: SantriStatus;
  keterangan: string;
};

export type SantriAbsenEntry = {
  nama_santri: string;
  pagi: SantriSesiEntry;
  siang: SantriSesiEntry;
};

export const emptySantriSesi = (): SantriSesiEntry => ({ status: "hadir", keterangan: "" });

export const emptySantriEntry = (nama: string): SantriAbsenEntry => ({
  nama_santri: nama,
  pagi: emptySantriSesi(),
  siang: emptySantriSesi(),
});

function rowToSesi(status: unknown, ket: unknown): SantriSesiEntry {
  return {
    status: (status as SantriStatus) ?? "hadir",
    keterangan: (ket as string) ?? "",
  };
}

/** Baca absen santri 1 kelas buat 1 tanggal -- map nama_santri -> entry (yang belum ada baris
 *  di DB berarti belum diabsen, biar diisi default "hadir" pas roster di-render di form). */
export async function readAbsenSantriDay(kelas: string, tanggal: string): Promise<Record<string, SantriAbsenEntry>> {
  const { data, error } = await supabase
    .from("absen_santri")
    .select("nama_santri, status_pagi, keterangan_pagi, status_siang, keterangan_siang")
    .eq("kelas", kelas)
    .eq("tanggal", tanggal);
  if (error) throw new Error(error.message);

  const out: Record<string, SantriAbsenEntry> = {};
  for (const row of data ?? []) {
    out[row.nama_santri] = {
      nama_santri: row.nama_santri,
      pagi: rowToSesi(row.status_pagi, row.keterangan_pagi),
      siang: rowToSesi(row.status_siang, row.keterangan_siang),
    };
  }
  return out;
}

/** Simpan absen santri 1 kelas 1 tanggal -- kirim SEMUA santri roster sekaligus (upsert per
 *  baris nama), biar nyimpen 1 santri gak nimpa punya yang lain. */
export async function saveAbsenSantriDay(kelas: string, tanggal: string, entries: SantriAbsenEntry[]): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesi login habis, coba masuk lagi.");

  const clean = (s: SantriSesiEntry) => ({
    status: s.status,
    keterangan: s.status === "tidak_hadir" ? s.keterangan.trim() : "",
  });

  const rows = entries.map((e) => {
    const p = clean(e.pagi);
    const g = clean(e.siang);
    return {
      user_id: user.id,
      kelas,
      tanggal,
      nama_santri: e.nama_santri,
      status_pagi: p.status,
      keterangan_pagi: p.keterangan,
      status_siang: g.status,
      keterangan_siang: g.keterangan,
    };
  });

  const { error } = await supabase.from("absen_santri").upsert(rows, { onConflict: "kelas,tanggal,nama_santri" });
  if (error) throw new Error(error.message);
}

export type AbsenSantriRekapRow = { kelas: string; nama_santri: string; status_pagi: SantriStatus; status_siang: SantriStatus };

/** Rekap SEMUA kelas 1 bulan sekaligus -- buat rekap management (kayak readTasmiRekapTahun),
 *  dikelompokkan per kelas di sisi page, bukan di sini, biar page bisa nampilin ringkasan semua
 *  kelas dulu baru rincian per kelas pas di-expand. */
export async function readAbsenSantriRekapBulanSemua(year: number, month1to12: number): Promise<AbsenSantriRekapRow[]> {
  const from = `${year}-${String(month1to12).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month1to12, 0).getDate();
  const to = `${year}-${String(month1to12).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("absen_santri")
    .select("kelas, nama_santri, status_pagi, status_siang")
    .gte("tanggal", from)
    .lte("tanggal", to);
  if (error) throw new Error(error.message);
  return (data ?? []) as AbsenSantriRekapRow[];
}
