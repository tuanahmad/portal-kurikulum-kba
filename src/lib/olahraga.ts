import { supabase } from "./supabaseClient";
import { ramahkanGalat } from "./jaringan";
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

/** Nama "kelas" untuk jurnal harian guru olahraga (tabel jurnal_harian menyimpan kelas sebagai teks). */
export const kelasJurnalOlahraga = (k: OlahragaKelompok) => `Olahraga ${KELOMPOK_LABEL[k]}`;

/* ═══════════════════════ Rencana kegiatan (per tingkat) ═══════════════════════ */

export type OlahragaEntry = {
  tingkat: OlahragaTingkat;
  bulan: string;
  pekan1: string;
  pekan2: string;
  pekan3: string;
  pekan4: string;
  /** Target per pekan (fokus tiap pekan). */
  target_pekan1: string[];
  target_pekan2: string[];
  target_pekan3: string[];
  target_pekan4: string[];
  /** Target LAMA: satu target gabungan untuk sebulan. Hanya dibaca (data lama tetap aman); isian baru lewat target per pekan. */
  target: string[];
  alat: string;
  updated_at?: string;
};

export const PEKAN_FIELDS: {
  key: "pekan1" | "pekan2" | "pekan3" | "pekan4";
  targetKey: "target_pekan1" | "target_pekan2" | "target_pekan3" | "target_pekan4";
  label: string;
}[] = [
  { key: "pekan1", targetKey: "target_pekan1", label: "Pekan 1" },
  { key: "pekan2", targetKey: "target_pekan2", label: "Pekan 2" },
  { key: "pekan3", targetKey: "target_pekan3", label: "Pekan 3" },
  { key: "pekan4", targetKey: "target_pekan4", label: "Pekan 4" },
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
  target_pekan1: [],
  target_pekan2: [],
  target_pekan3: [],
  target_pekan4: [],
  target: [],
  alat: "",
});

/** Ada target per pekan yang terisi (target lama gabungan tidak dihitung). */
export function adaTargetPekan(e: OlahragaEntry | undefined | null): boolean {
  return !!e && PEKAN_FIELDS.some((f) => e[f.targetKey].length > 0);
}

export function isRencanaFilled(e: OlahragaEntry | undefined): boolean {
  if (!e) return false;
  return (
    PEKAN_FIELDS.some((f) => String(e[f.key] ?? "").trim() !== "") ||
    adaTargetPekan(e) ||
    e.target.length > 0 ||
    e.alat.trim() !== ""
  );
}

const daftarTeks = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);

export function rowToEntry(row: any): OlahragaEntry {
  return {
    tingkat: row.tingkat,
    bulan: row.bulan,
    pekan1: row.pekan1 ?? "",
    pekan2: row.pekan2 ?? "",
    pekan3: row.pekan3 ?? "",
    pekan4: row.pekan4 ?? "",
    target_pekan1: daftarTeks(row.target_pekan1),
    target_pekan2: daftarTeks(row.target_pekan2),
    target_pekan3: daftarTeks(row.target_pekan3),
    target_pekan4: daftarTeks(row.target_pekan4),
    target: daftarTeks(row.target),
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
  target_pekan1: string[];
  target_pekan2: string[];
  target_pekan3: string[];
  target_pekan4: string[];
  alat: string;
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesi login habis, coba masuk lagi.");

  // Kolom `target` (target lama gabungan) sengaja tidak ditulis: data lama tetap utuh.
  const { data, error } = await supabase.from("olahraga_bulanan").upsert(
    {
      user_id: user.id,
      kelompok: params.kelompok,
      tingkat: params.tingkat,
      bulan: params.bulan,
      pekan1: params.pekan1.trim(),
      pekan2: params.pekan2.trim(),
      pekan3: params.pekan3.trim(),
      pekan4: params.pekan4.trim(),
      target_pekan1: params.target_pekan1,
      target_pekan2: params.target_pekan2,
      target_pekan3: params.target_pekan3,
      target_pekan4: params.target_pekan4,
      alat: params.alat.trim(),
    },
    { onConflict: "kelompok,tingkat,bulan" }
  )
    .select("pekan1, pekan2, pekan3, pekan4, target_pekan1, target_pekan2, target_pekan3, target_pekan4, alat")
    .maybeSingle();
  if (error) throw new Error(ramahkanGalat(error.message));
  // Cek ulang: baris harus benar-benar ada dan isinya sama dengan yang dikirim.
  const sama =
    !!data &&
    data.pekan1 === params.pekan1.trim() &&
    data.pekan2 === params.pekan2.trim() &&
    data.pekan3 === params.pekan3.trim() &&
    data.pekan4 === params.pekan4.trim() &&
    data.alat === params.alat.trim() &&
    JSON.stringify(data.target_pekan1 ?? []) === JSON.stringify(params.target_pekan1) &&
    JSON.stringify(data.target_pekan2 ?? []) === JSON.stringify(params.target_pekan2) &&
    JSON.stringify(data.target_pekan3 ?? []) === JSON.stringify(params.target_pekan3) &&
    JSON.stringify(data.target_pekan4 ?? []) === JSON.stringify(params.target_pekan4);
  if (!sama) throw new Error("Rencana belum tercatat di server. Ketikanmu masih aman di perangkat; tekan Simpan sekali lagi.");
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

  const { data, error } = await supabase.from("absen_olahraga").upsert(
    {
      user_id: user.id,
      kelompok: params.kelompok,
      tanggal: params.tanggal,
      status: params.status,
      keterangan: params.status === "hadir" ? "" : params.keterangan.trim(),
    },
    { onConflict: "user_id,tanggal" }
  )
    .select("status")
    .maybeSingle();
  if (error) throw new Error(ramahkanGalat(error.message));
  if (!data || data.status !== params.status) {
    throw new Error("Absen belum tercatat di server. Tekan Simpan sekali lagi.");
  }
}

/** Versi management: gabungan SEMUA kelompok (ikhwan + akhwat). KA 1/KA 2 rosternya campur, jadi
 *  guru ikhwan & akhwat sama-sama bisa ngisi nama yang sama -- kalau dua-duanya terisi, ambil yang
 *  paling baru diubah; kalau cuma satu yang terisi, ambil yang terisi (jangan ketimpa yang kosong). */
export async function readEvaluasiAnakGabungan(
  tingkat: OlahragaTingkat,
  bulan: string
): Promise<Record<string, EvalAnakEntry>> {
  const { data, error } = await supabase
    .from("olahraga_evaluasi_anak")
    .select("nama_santri, eval_ketercapaian, eval_partisipasi, eval_kendala, eval_perkembangan, eval_tindak_lanjut, updated_at")
    .eq("tingkat", tingkat)
    .eq("bulan", bulan)
    .order("updated_at", { ascending: true });
  if (error) throw new Error(error.message);

  const out: Record<string, EvalAnakEntry> = {};
  for (const row of data ?? []) {
    const e: EvalAnakEntry = {
      eval_ketercapaian: row.eval_ketercapaian ?? "",
      eval_partisipasi: row.eval_partisipasi ?? "",
      eval_kendala: row.eval_kendala ?? "",
      eval_perkembangan: row.eval_perkembangan ?? "",
      eval_tindak_lanjut: row.eval_tindak_lanjut ?? "",
      updated_at: row.updated_at,
    };
    const prev = out[row.nama_santri];
    if (!prev || isEvalAnakFilled(e) || !isEvalAnakFilled(prev)) out[row.nama_santri] = e;
  }
  return out;
}

export type AbsenOlahragaPerKelompok = Partial<Record<OlahragaKelompok, AbsenOlahragaEntry>>;

/** Absen olahraga semua kelompok sekaligus: map tanggal -> { ikhwan?, akhwat? }. */
export async function readAbsenOlahragaRangeGabungan(
  fromYmd: string,
  toYmd: string
): Promise<Record<string, AbsenOlahragaPerKelompok>> {
  const { data, error } = await supabase
    .from("absen_olahraga")
    .select("tanggal, kelompok, status, keterangan, updated_at")
    .gte("tanggal", fromYmd)
    .lte("tanggal", toYmd);
  if (error) throw new Error(error.message);

  const out: Record<string, AbsenOlahragaPerKelompok> = {};
  for (const row of data ?? []) {
    const k = row.kelompok as OlahragaKelompok;
    (out[row.tanggal] ??= {})[k] = {
      tanggal: row.tanggal,
      status: (row.status ?? "hadir") as AbsenStatus,
      keterangan: row.keterangan ?? "",
      updated_at: row.updated_at,
    };
  }
  return out;
}
