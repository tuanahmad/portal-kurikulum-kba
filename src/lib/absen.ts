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

export type AbsenEntry = {
  tanggal: string; // "YYYY-MM-DD"
  status: AbsenStatus;
  jam_datang: string | null; // "HH:MM"
  jam_pulang: string | null; // "HH:MM"
  keterangan: string;
  updated_at?: string;
};

export const emptyAbsen = (tanggal: string): AbsenEntry => ({
  tanggal,
  status: "hadir",
  jam_datang: null,
  jam_pulang: null,
  keterangan: "",
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

/** Sudah ada isian yang berarti? */
export function isAbsenFilled(e: AbsenEntry | undefined): boolean {
  if (!e) return false;
  if (e.status !== "hadir") return true;
  return !!(e.jam_datang || e.jam_pulang);
}

/** Ringkasan 1 baris utk header kartu. */
export function ringkasAbsen(e: AbsenEntry | undefined): string {
  if (!isAbsenFilled(e)) return "Belum absen";
  const x = e as AbsenEntry;
  if (x.status !== "hadir") {
    return x.keterangan.trim()
      ? `${STATUS_LABEL[x.status]} — ${x.keterangan.trim()}`
      : STATUS_LABEL[x.status];
  }
  const d = x.jam_datang ? x.jam_datang.replace(":", ".") : "–";
  const p = x.jam_pulang ? x.jam_pulang.replace(":", ".") : "–";
  return `Hadir · datang ${d}, pulang ${p}`;
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
    .select("tanggal, status, jam_datang, jam_pulang, keterangan, updated_at")
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
      status: (row.status ?? "hadir") as AbsenStatus,
      jam_datang: hm(row.jam_datang),
      jam_pulang: hm(row.jam_pulang),
      keterangan: row.keterangan ?? "",
      updated_at: row.updated_at,
    };
  }
  return out;
}

export async function saveAbsenDay(params: {
  kelas: string;
  tanggal: string;
  status: AbsenStatus;
  jam_datang: string | null;
  jam_pulang: string | null;
  keterangan: string;
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesi login habis, coba masuk lagi.");

  const hadir = params.status === "hadir";
  const { error } = await supabase.from("absen_guru").upsert(
    {
      user_id: user.id,
      kelas: params.kelas,
      tanggal: params.tanggal,
      status: params.status,
      jam_datang: hadir ? hm(params.jam_datang) : null,
      jam_pulang: hadir ? hm(params.jam_pulang) : null,
      keterangan: hadir ? "" : params.keterangan.trim(),
    },
    { onConflict: "user_id,tanggal" }
  );
  if (error) throw new Error(error.message);
}
