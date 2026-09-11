import { supabase } from "./supabaseClient";

// helper tanggal/pekan dipakai bareng dgn Jurnal
export {
  ymd,
  mondayOf,
  weekdaysFrom,
  labelHari,
  labelTanggal,
  labelRentangPekan,
} from "./jurnal";

export type AbsenStatus = "hadir" | "izin" | "sakit" | "cuti";

export const STATUS_LABEL: Record<AbsenStatus, string> = {
  hadir: "Hadir",
  izin: "Izin",
  sakit: "Sakit",
  cuti: "Cuti",
};

export type SesiKey = "pagi" | "siang";
export const SESI_LIST: SesiKey[] = ["pagi", "siang"];
export const SESI_LABEL: Record<SesiKey, string> = {
  pagi: "Kelas Pagi",
  siang: "Kelas Siang",
};

export type SesiEntry = {
  status: AbsenStatus;
  jam_datang: string | null; // "HH:MM"
  jam_pulang: string | null; // "HH:MM"
  keterangan: string;
};

export type AbsenEntry = {
  tanggal: string; // "YYYY-MM-DD"
  pagi: SesiEntry;
  siang: SesiEntry;
  updated_at?: string;
};

export const emptySesi = (): SesiEntry => ({
  status: "hadir",
  jam_datang: null,
  jam_pulang: null,
  keterangan: "",
});

export const emptyAbsen = (tanggal: string): AbsenEntry => ({
  tanggal,
  pagi: emptySesi(),
  siang: emptySesi(),
});

/** Jam sekarang "HH:MM" (lokal). */
export function nowHM(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Normalkan "07:02:00" / "07:02" -> "07:02"; null/"" -> null. */
export function hm(v: string | null | undefined): string | null {
  if (!v) return null;
  const m = String(v).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

/** Sudah ada isian yang berarti buat 1 sesi? */
export function isSesiFilled(s: SesiEntry | undefined): boolean {
  if (!s) return false;
  if (s.status !== "hadir") return true;
  return !!(s.jam_datang || s.jam_pulang);
}

/** Sudah ada isian di salah satu sesi (pagi atau siang)? */
export function isAbsenFilled(e: AbsenEntry | undefined): boolean {
  return !!e && (isSesiFilled(e.pagi) || isSesiFilled(e.siang));
}

/** Sudah ada isian di KEDUA sesi? (dipakai buat nge-hijau-in badge "lengkap") */
export function isAbsenLengkap(e: AbsenEntry | undefined): boolean {
  return !!e && isSesiFilled(e.pagi) && isSesiFilled(e.siang);
}

function ringkasSesi(s: SesiEntry): string {
  if (s.status !== "hadir") return STATUS_LABEL[s.status];
  const d = s.jam_datang ? s.jam_datang.replace(":", ".") : "–";
  const p = s.jam_pulang ? s.jam_pulang.replace(":", ".") : "–";
  return `${d}–${p}`;
}

/** Ringkasan 1 baris utk header kartu, mis. "Pagi: 06.55–15.15 · Siang: Izin". */
export function ringkasAbsen(e: AbsenEntry | undefined): string {
  if (!e) return "Belum absen";
  const parts: string[] = [];
  if (isSesiFilled(e.pagi)) parts.push(`Pagi: ${ringkasSesi(e.pagi)}`);
  if (isSesiFilled(e.siang)) parts.push(`Siang: ${ringkasSesi(e.siang)}`);
  return parts.length ? parts.join(" · ") : "Belum absen";
}

function rowToSesi(status: unknown, datang: unknown, pulang: unknown, ket: unknown): SesiEntry {
  return {
    status: (status as AbsenStatus) ?? "hadir",
    jam_datang: hm(datang as string | null),
    jam_pulang: hm(pulang as string | null),
    keterangan: (ket as string) ?? "",
  };
}

/** Baca absen dalam rentang tanggal. `by` = { userId } (guru: dirinya) atau { kelas }
 *  (manajemen). Balikin map tanggal -> entry. */
export async function readAbsenRange(
  fromYmd: string,
  toYmd: string,
  by: { userId?: string; kelas?: string }
): Promise<Record<string, AbsenEntry>> {
  let q = supabase
    .from("absen_guru")
    .select(
      "tanggal, status_pagi, jam_datang_pagi, jam_pulang_pagi, keterangan_pagi, status_siang, jam_datang_siang, jam_pulang_siang, keterangan_siang, updated_at"
    )
    .gte("tanggal", fromYmd)
    .lte("tanggal", toYmd);
  if (by.userId) q = q.eq("user_id", by.userId);
  else if (by.kelas) q = q.eq("kelas", by.kelas);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const out: Record<string, AbsenEntry> = {};
  for (const row of data ?? []) {
    out[row.tanggal] = {
      tanggal: row.tanggal,
      pagi: rowToSesi(row.status_pagi, row.jam_datang_pagi, row.jam_pulang_pagi, row.keterangan_pagi),
      siang: rowToSesi(row.status_siang, row.jam_datang_siang, row.jam_pulang_siang, row.keterangan_siang),
      updated_at: row.updated_at,
    };
  }
  return out;
}

/** Simpan 1 hari — SELALU kirim kedua sesi (pagi & siang) sekaligus, biar nyimpen 1 sesi
 *  gak nimpa/nghapus sesi yang lain (upsert nulis 1 baris penuh). */
export async function saveAbsenDay(params: {
  kelas: string;
  tanggal: string;
  pagi: SesiEntry;
  siang: SesiEntry;
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesi login habis, coba masuk lagi.");

  const clean = (s: SesiEntry) => {
    const hadir = s.status === "hadir";
    return {
      status: s.status,
      jam_datang: hadir ? hm(s.jam_datang) : null,
      jam_pulang: hadir ? hm(s.jam_pulang) : null,
      keterangan: hadir ? "" : s.keterangan.trim(),
    };
  };
  const p = clean(params.pagi);
  const g = clean(params.siang);

  const { error } = await supabase.from("absen_guru").upsert(
    {
      user_id: user.id,
      kelas: params.kelas,
      tanggal: params.tanggal,
      status_pagi: p.status,
      jam_datang_pagi: p.jam_datang,
      jam_pulang_pagi: p.jam_pulang,
      keterangan_pagi: p.keterangan,
      status_siang: g.status,
      jam_datang_siang: g.jam_datang,
      jam_pulang_siang: g.jam_pulang,
      keterangan_siang: g.keterangan,
    },
    { onConflict: "user_id,tanggal" }
  );
  if (error) throw new Error(error.message);
}
