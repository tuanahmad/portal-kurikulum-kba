import { supabase } from "./supabaseClient";

export type OlahragaTingkat = "KA 1" | "KA 2" | "KA 3";
export const TINGKAT_LIST: OlahragaTingkat[] = ["KA 1", "KA 2", "KA 3"];

// Tahun ajaran Juli–Desember (samakan dgn fitur lain).
export const BULAN_OLAHRAGA = [
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

// Contoh target — guru bisa pilih beberapa + tambah sendiri.
export const TARGET_PRESET = [
  "Kaki",
  "Tangan",
  "Keseimbangan",
  "Kelenturan",
  "Kelincahan",
  "Kekuatan",
  "Koordinasi",
  "Daya tahan",
];

export type OlahragaKelompok = "ikhwan" | "akhwat";
export const KELOMPOK_LABEL: Record<OlahragaKelompok, string> = {
  ikhwan: "Ikhwan",
  akhwat: "Akhwat",
};

export type OlahragaEntry = {
  tingkat: OlahragaTingkat;
  bulan: string;
  // rencana
  pekan1: string;
  pekan2: string;
  pekan3: string;
  pekan4: string;
  target: string[];
  alat: string;
  // evaluasi
  eval_ketercapaian: string;
  eval_partisipasi: string;
  eval_kendala: string;
  eval_perkembangan: string;
  eval_tindak_lanjut: string;
  updated_at?: string;
};

export const PEKAN_FIELDS: { key: keyof OlahragaEntry; label: string }[] = [
  { key: "pekan1", label: "Kegiatan Pekan 1" },
  { key: "pekan2", label: "Kegiatan Pekan 2" },
  { key: "pekan3", label: "Kegiatan Pekan 3" },
  { key: "pekan4", label: "Kegiatan Pekan 4" },
];

export const EVAL_FIELDS: { key: keyof OlahragaEntry; label: string }[] = [
  { key: "eval_ketercapaian", label: "Ketercapaian target" },
  { key: "eval_partisipasi", label: "Partisipasi & antusiasme santri" },
  { key: "eval_kendala", label: "Kendala" },
  { key: "eval_perkembangan", label: "Perkembangan yang terlihat" },
  { key: "eval_tindak_lanjut", label: "Tindak lanjut (rekomendasi bulan depan)" },
];

export const emptyOlahraga = (
  tingkat: OlahragaTingkat,
  bulan: string
): OlahragaEntry => ({
  tingkat,
  bulan,
  pekan1: "",
  pekan2: "",
  pekan3: "",
  pekan4: "",
  target: [],
  alat: "",
  eval_ketercapaian: "",
  eval_partisipasi: "",
  eval_kendala: "",
  eval_perkembangan: "",
  eval_tindak_lanjut: "",
});

export function isRencanaFilled(e: OlahragaEntry | undefined): boolean {
  if (!e) return false;
  return (
    PEKAN_FIELDS.some((f) => String(e[f.key] ?? "").trim() !== "") ||
    e.target.length > 0 ||
    e.alat.trim() !== ""
  );
}
export function isEvalFilled(e: OlahragaEntry | undefined): boolean {
  return !!e && EVAL_FIELDS.some((f) => String(e[f.key] ?? "").trim() !== "");
}
export function isOlahragaFilled(e: OlahragaEntry | undefined): boolean {
  return isRencanaFilled(e) || isEvalFilled(e);
}

function rowToEntry(row: any): OlahragaEntry {
  return {
    tingkat: row.tingkat,
    bulan: row.bulan,
    pekan1: row.pekan1 ?? "",
    pekan2: row.pekan2 ?? "",
    pekan3: row.pekan3 ?? "",
    pekan4: row.pekan4 ?? "",
    target: Array.isArray(row.target) ? row.target : [],
    alat: row.alat ?? "",
    eval_ketercapaian: row.eval_ketercapaian ?? "",
    eval_partisipasi: row.eval_partisipasi ?? "",
    eval_kendala: row.eval_kendala ?? "",
    eval_perkembangan: row.eval_perkembangan ?? "",
    eval_tindak_lanjut: row.eval_tindak_lanjut ?? "",
    updated_at: row.updated_at,
  };
}

/** Baca semua tingkat untuk 1 bulan. `by` = { userId } (guru olahraga: dirinya)
 *  atau { kelompok } (manajemen). Balikin map tingkat -> entry. */
export async function readOlahragaBulan(
  bulan: string,
  by: { userId?: string; kelompok?: OlahragaKelompok }
): Promise<Record<string, OlahragaEntry>> {
  let q = supabase.from("olahraga_bulanan").select("*").eq("bulan", bulan);
  if (by.userId) q = q.eq("user_id", by.userId);
  else if (by.kelompok) q = q.eq("kelompok", by.kelompok);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const out: Record<string, OlahragaEntry> = {};
  for (const row of data ?? []) out[row.tingkat] = rowToEntry(row);
  return out;
}

export async function saveOlahraga(params: {
  kelompok: OlahragaKelompok;
  tingkat: OlahragaTingkat;
  bulan: string;
  pekan1: string;
  pekan2: string;
  pekan3: string;
  pekan4: string;
  target: string[];
  alat: string;
  eval_ketercapaian: string;
  eval_partisipasi: string;
  eval_kendala: string;
  eval_perkembangan: string;
  eval_tindak_lanjut: string;
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesi login habis, coba masuk lagi.");

  const { error } = await supabase.from("olahraga_bulanan").upsert(
    {
      user_id: user.id,
      kelompok: params.kelompok,
      tingkat: params.tingkat,
      bulan: params.bulan,
      pekan1: params.pekan1.trim(),
      pekan2: params.pekan2.trim(),
      pekan3: params.pekan3.trim(),
      pekan4: params.pekan4.trim(),
      target: params.target,
      alat: params.alat.trim(),
      eval_ketercapaian: params.eval_ketercapaian.trim(),
      eval_partisipasi: params.eval_partisipasi.trim(),
      eval_kendala: params.eval_kendala.trim(),
      eval_perkembangan: params.eval_perkembangan.trim(),
      eval_tindak_lanjut: params.eval_tindak_lanjut.trim(),
    },
    { onConflict: "kelompok,tingkat,bulan" }
  );
  if (error) throw new Error(error.message);
}
