import { supabase } from "./supabaseClient";
import { ramahkanGalat } from "./jaringan";
import { PEKAN_FIELDS, TARGET_PRESET, namaAspek, type NilaiOlahraga, type OlahragaEntry } from "./olahraga";

// Penilaian kuantitatif evaluasi olahraga: tiap anak diberi nilai A–D per aspek kemampuan. Aspek yang dinilai =
// target yang dipilih guru di Rencana bulan itu (jadi yang dinilai selalu yang memang dilatih). Arti tiap huruf
// ada di tabel `olahraga_rubrik` (deskripsi A–D per aspek, dipakai bersama semua guru olahraga).

export const NILAI_OLAHRAGA: NilaiOlahraga[] = ["A", "B", "C", "D"];

export type Rubrik = { aspek: string; a: string; b: string; c: string; d: string };
export const kunciAspek = (t: string) => namaAspek(t).toLowerCase();
export const rubrikKosong = (aspek: string): Rubrik => ({ aspek, a: "", b: "", c: "", d: "" });

export function deskripsiNilai(r: Rubrik | undefined, n: NilaiOlahraga): string {
  if (!r) return "";
  return { A: r.a, B: r.b, C: r.c, D: r.d }[n] ?? "";
}

/** Rubrik lengkap = keempat deskripsi terisi. */
export const rubrikLengkap = (r: Rubrik | undefined) => !!r && [r.a, r.b, r.c, r.d].every((x) => x.trim() !== "");

/** Aspek yang dinilai bulan itu = semua target di rencana (per pekan; kalau belum ada, target lama sebulan),
 *  tanpa dobel. Urutan: target bawaan dulu (urut daftar bawaan), lalu target tambahan sesuai urutan muncul. */
export function aspekDariRencana(e: OlahragaEntry | null | undefined): string[] {
  if (!e) return [];
  const semua = PEKAN_FIELDS.flatMap((f) => e[f.targetKey]);
  const sumber = semua.length ? semua : e.target;
  const unik: string[] = [];
  for (const t of sumber.map(namaAspek)) if (t && !unik.some((u) => u.toLowerCase() === t.toLowerCase())) unik.push(t);
  const bawaan = TARGET_PRESET.filter((p) => unik.includes(p));
  return [...bawaan, ...unik.filter((u) => !TARGET_PRESET.includes(u))];
}

let simpanan: Promise<Record<string, Rubrik>> | null = null;

/** Semua rubrik, peta kunci (nama aspek huruf kecil) -> rubrik. Disimpan sementara selama aplikasi terbuka. */
export function bacaRubrik(segarkan = false): Promise<Record<string, Rubrik>> {
  if (simpanan && !segarkan) return simpanan;
  simpanan = (async () => {
    const { data, error } = await supabase.from("olahraga_rubrik").select("kunci, aspek, a, b, c, d");
    if (error) throw new Error(ramahkanGalat(error.message));
    const out: Record<string, Rubrik> = {};
    for (const r of data ?? []) out[r.kunci as string] = { aspek: r.aspek, a: r.a ?? "", b: r.b ?? "", c: r.c ?? "", d: r.d ?? "" };
    return out;
  })();
  simpanan.catch(() => {
    simpanan = null;
  });
  return simpanan;
}

/** Simpan deskripsi A–D (target tambahan buatan guru). Dibaca balik; kalau tidak sama, dilempar galat. */
export async function simpanRubrik(list: Rubrik[]): Promise<void> {
  if (!list.length) return;
  const rows = list.map((r) => ({
    kunci: kunciAspek(r.aspek),
    aspek: namaAspek(r.aspek),
    a: r.a.trim(),
    b: r.b.trim(),
    c: r.c.trim(),
    d: r.d.trim(),
    updated_at: new Date().toISOString(),
  }));
  const { data, error } = await supabase.from("olahraga_rubrik").upsert(rows, { onConflict: "kunci" }).select("kunci, a, b, c, d");
  if (error) throw new Error(ramahkanGalat(error.message));
  const balik = new Map((data ?? []).map((r) => [r.kunci as string, r]));
  const sama = rows.every((r) => {
    const x = balik.get(r.kunci);
    return !!x && x.a === r.a && x.b === r.b && x.c === r.c && x.d === r.d;
  });
  if (!sama) throw new Error("Deskripsi nilai belum tercatat di server. Tekan Simpan sekali lagi.");
  await bacaRubrik(true);
}
