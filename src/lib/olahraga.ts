import { supabase } from "./supabaseClient";
import { type AbsenStatus } from "./absen";

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

/* ═══════════════════════ Rencana kegiatan (per tingkat) ═══════════════════════ */

export type OlahragaEntry = {
  tingkat: OlahragaTingkat;
  bulan: string;
  pekan1: string;
  pekan2: string;
  pekan3: string;
  pekan4: string;
  target: string[];
  alat: string;
  updated_at?: string;
};

export const PEKAN_FIELDS: { key: keyof OlahragaEntry; label: string }[] = [
  { key: "pekan1", label: "Kegiatan Pekan 1" },
  { key: "pekan2", label: "Kegiatan Pekan 2" },
  { key: "pekan3", label: "Kegiatan Pekan 3" },
  { key: "pekan4", label: "Kegiatan Pekan 4" },
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
});

export function isRencanaFilled(e: OlahragaEntry | undefined): boolean {
  if (!e) return false;
  return (
    PEKAN_FIELDS.some((f) => String(e[f.key] ?? "").trim() !== "") ||
    e.target.length > 0 ||
    e.alat.trim() !== ""
  );
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
    },
    { onConflict: "kelompok,tingkat,bulan" }
  );
  if (error) throw new Error(error.message);
}

/* ═══════════════════════ Evaluasi kegiatan (per anak) ═══════════════════════ */

export type EvalAnakEntry = {
  eval_ketercapaian: string;
  eval_partisipasi: string;
  eval_kendala: string;
  eval_perkembangan: string;
  eval_tindak_lanjut: string;
  updated_at?: string;
};

export const EVAL_FIELDS: { key: keyof EvalAnakEntry; label: string }[] = [
  { key: "eval_ketercapaian", label: "Ketercapaian target" },
  { key: "eval_partisipasi", label: "Partisipasi & antusiasme" },
  { key: "eval_kendala", label: "Kendala" },
  { key: "eval_perkembangan", label: "Perkembangan yang terlihat" },
  { key: "eval_tindak_lanjut", label: "Tindak lanjut (rekomendasi bulan depan)" },
];

export const emptyEvalAnak = (): EvalAnakEntry => ({
  eval_ketercapaian: "",
  eval_partisipasi: "",
  eval_kendala: "",
  eval_perkembangan: "",
  eval_tindak_lanjut: "",
});

export function isEvalAnakFilled(e: EvalAnakEntry | undefined): boolean {
  return !!e && EVAL_FIELDS.some((f) => String(e[f.key] ?? "").trim() !== "");
}

/** Baca evaluasi semua anak buat 1 tingkat + bulan. `by` = { userId } atau { kelompok }.
 *  Balikin map nama santri -> entry. */
export async function readEvaluasiAnak(
  tingkat: OlahragaTingkat,
  bulan: string,
  by: { userId?: string; kelompok?: OlahragaKelompok }
): Promise<Record<string, EvalAnakEntry>> {
  let q = supabase
    .from("olahraga_evaluasi_anak")
    .select("nama_santri, eval_ketercapaian, eval_partisipasi, eval_kendala, eval_perkembangan, eval_tindak_lanjut, updated_at")
    .eq("tingkat", tingkat)
    .eq("bulan", bulan);
  if (by.userId) q = q.eq("user_id", by.userId);
  else if (by.kelompok) q = q.eq("kelompok", by.kelompok);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const out: Record<string, EvalAnakEntry> = {};
  for (const row of data ?? []) {
    out[row.nama_santri] = {
      eval_ketercapaian: row.eval_ketercapaian ?? "",
      eval_partisipasi: row.eval_partisipasi ?? "",
      eval_kendala: row.eval_kendala ?? "",
      eval_perkembangan: row.eval_perkembangan ?? "",
      eval_tindak_lanjut: row.eval_tindak_lanjut ?? "",
      updated_at: row.updated_at,
    };
  }
  return out;
}

/** Simpan evaluasi sekelompok anak sekaligus (1 tingkat, 1 bulan) — dipanggil oleh 1 tombol
 *  Simpan yang nyimpen semua santri yang lagi ditampilkan di kartu tingkat itu. */
export async function saveEvaluasiAnakBatch(params: {
  kelompok: OlahragaKelompok;
  tingkat: OlahragaTingkat;
  bulan: string;
  entries: Record<string, EvalAnakEntry>;
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesi login habis, coba masuk lagi.");

  const rows = Object.entries(params.entries).map(([nama, e]) => ({
    user_id: user.id,
    kelompok: params.kelompok,
    tingkat: params.tingkat,
    bulan: params.bulan,
    nama_santri: nama,
    eval_ketercapaian: e.eval_ketercapaian.trim(),
    eval_partisipasi: e.eval_partisipasi.trim(),
    eval_kendala: e.eval_kendala.trim(),
    eval_perkembangan: e.eval_perkembangan.trim(),
    eval_tindak_lanjut: e.eval_tindak_lanjut.trim(),
  }));
  if (rows.length === 0) return;

  const { error } = await supabase
    .from("olahraga_evaluasi_anak")
    .upsert(rows, { onConflict: "kelompok,tingkat,bulan,nama_santri" });
  if (error) throw new Error(error.message);
}

/* ═══════════════════════ Absen olahraga ═══════════════════════
 * Beda dari absen guru kelas biasa: 1x/hari (bukan pagi+siang), gak ada jam
 * (cuma kedatangan/status), dan cuma 3 hari — Senin, Selasa, Rabu. */

export const HARI_OLAHRAGA = ["Senin", "Selasa", "Rabu"] as const;
export type HariOlahraga = (typeof HARI_OLAHRAGA)[number];

export type AbsenOlahragaEntry = {
  tanggal: string; // "YYYY-MM-DD"
  status: AbsenStatus;
  keterangan: string;
  updated_at?: string;
};

export const emptyAbsenOlahraga = (tanggal: string): AbsenOlahragaEntry => ({
  tanggal,
  status: "hadir",
  keterangan: "",
});

/** Terisi kalau barisnya memang ada di DB (bukan cuma default kosong hasil fallback) —
 *  makanya cek `updated_at`, bukan isi field (soalnya "hadir" tanpa jam gak punya field lain
 *  yang bisa dibedakan dari kondisi kosong). */
export function isAbsenOlahragaFilled(e: AbsenOlahragaEntry | undefined): boolean {
  return !!e?.updated_at;
}

export async function readAbsenOlahragaRange(
  fromYmd: string,
  toYmd: string,
  by: { userId?: string; kelompok?: OlahragaKelompok }
): Promise<Record<string, AbsenOlahragaEntry>> {
  let q = supabase
    .from("absen_olahraga")
    .select("tanggal, status, keterangan, updated_at")
    .gte("tanggal", fromYmd)
    .lte("tanggal", toYmd);
  if (by.userId) q = q.eq("user_id", by.userId);
  else if (by.kelompok) q = q.eq("kelompok", by.kelompok);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const out: Record<string, AbsenOlahragaEntry> = {};
  for (const row of data ?? []) {
    out[row.tanggal] = {
      tanggal: row.tanggal,
      status: (row.status ?? "hadir") as AbsenStatus,
      keterangan: row.keterangan ?? "",
      updated_at: row.updated_at,
    };
  }
  return out;
}

export async function saveAbsenOlahraga(params: {
  kelompok: OlahragaKelompok;
  tanggal: string;
  status: AbsenStatus;
  keterangan: string;
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesi login habis, coba masuk lagi.");

  const { error } = await supabase.from("absen_olahraga").upsert(
    {
      user_id: user.id,
      kelompok: params.kelompok,
      tanggal: params.tanggal,
      status: params.status,
      keterangan: params.status === "hadir" ? "" : params.keterangan.trim(),
    },
    { onConflict: "user_id,tanggal" }
  );
  if (error) throw new Error(error.message);
}
