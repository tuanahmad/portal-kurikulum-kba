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

export type SantriRekapBulanRow = {
  nama_santri: string;
  hadirPagi: number;
  tidakHadirPagi: number;
  hadirSiang: number;
  tidakHadirSiang: number;
};

/** Rekap 1 kelas 1 bulan -- total hadir/tidak-hadir tiap santri, per sesi. Dipakai management. */
export async function readAbsenSantriRekapBulan(kelas: string, year: number, month1to12: number): Promise<SantriRekapBulanRow[]> {
  const from = `${year}-${String(month1to12).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month1to12, 0).getDate();
  const to = `${year}-${String(month1to12).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("absen_santri")
    .select("nama_santri, status_pagi, status_siang")
    .eq("kelas", kelas)
    .gte("tanggal", from)
    .lte("tanggal", to);
  if (error) throw new Error(error.message);

  const byNama = new Map<string, SantriRekapBulanRow>();
  for (const row of data ?? []) {
    const nama = row.nama_santri as string;
    if (!byNama.has(nama)) byNama.set(nama, { nama_santri: nama, hadirPagi: 0, tidakHadirPagi: 0, hadirSiang: 0, tidakHadirSiang: 0 });
    const r = byNama.get(nama)!;
    if (row.status_pagi === "hadir") r.hadirPagi++;
    else r.tidakHadirPagi++;
    if (row.status_siang === "hadir") r.hadirSiang++;
    else r.tidakHadirSiang++;
  }
  return Array.from(byNama.values()).sort((a, b) => a.nama_santri.localeCompare(b.nama_santri));
}
