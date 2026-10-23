import { supabase } from "./supabaseClient";
import { ymd, readJurnalRange, isEntryFilled } from "./jurnal";
import { readAbsenRange, isAbsenFilled, isAbsenLengkap } from "./absen";
import { capaianQuranFileId, pekanUntukSlot, slotUntukTanggal, slotsDiPekan, RPB_FILES, REFLEKSI_FILES } from "../data";
import { readRpbTab, type RpbTabData } from "./rpbSheet";
import { readReflectionTab, type ReflectionData } from "./refleksiSheet";
import { readCapaianQuran } from "./capaianQuranSheet";

export type TodayStatus = {
  totalKelas: number;
  jurnalFilled: string[]; // nama kelas yang sudah isi Jurnal hari ini
  absenFilled: string[]; // nama kelas yang sudah isi Absen hari ini (minimal 1 sesi)
  quranFilled: string[]; // nama kelas yang sudah ada isian Capaian Al-Qur'an MINGGU ini
  quranUnknown: string[]; // gagal dibaca (network/sheet error) - jangan dianggap "belum isi"
};

/** Cache sementara (di memori; hilang saat halaman dimuat ulang) untuk bacaan Google Sheets yang dipakai ringkasan Home.
 *  Tanpa ini tiap membuka Home memanggil Google Sheets lagi; kuota baca Google dipakai bersama semua guru, jadi bisa kehabisan
 *  dan mengganggu penyimpanan. Dihapus otomatis setelah ada penyimpanan (hapusCacheStatus). */
const CACHE_MS = 5 * 60 * 1000;
const cacheStatus = new Map<string, { t: number; v: unknown }>();
export function hapusCacheStatus() {
  cacheStatus.clear();
}
async function dariCache<T>(kunci: string, ambil: () => Promise<T>): Promise<T> {
  const c = cacheStatus.get(kunci);
  if (c && Date.now() - c.t < CACHE_MS) return c.v as T;
  const v = await ambil();
  cacheStatus.set(kunci, { t: Date.now(), v });
  return v;
}

const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** Pekan ke berapa (menurut nomor pertemuan di sheet, lihat data.ts) untuk hari ini; akhir pekan dihitung ikut Jumat terakhir. */
function pekanKeBerapa(d: Date, bulanNama: string): number {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  while (x.getDay() === 0 || x.getDay() === 6) x.setDate(x.getDate() - 1);
  const slot = slotUntukTanggal(bulanNama, x, 999);
  return slot ? pekanUntukSlot(bulanNama, slot) : 1;
}

function isFilled(v: string | undefined): boolean {
  const t = (v ?? "").trim();
  return t !== "" && t !== "-";
}

function hasFillThisWeek(sections: { type: string; students: { values: string[] }[] }[], pekanIdx: number, bulanNama: string): boolean {
  for (const sec of sections) {
    for (const st of sec.students) {
      if (sec.type === "pekan") {
        if (isFilled(st.values[pekanIdx - 1])) return true;
      } else {
        for (const s of slotsDiPekan(bulanNama, pekanIdx, st.values.length)) {
          if (isFilled(st.values[s - 1])) return true;
        }
      }
    }
  }
  return false;
}

/** Status pengisian MILIK SATU GURU untuk kartu "Hari Ini" di Home. Tiap bagian null kalau gagal dibaca
 *  (jaringan / tab bulan belum ada) -- jangan dianggap "belum isi". */
export type StatusGuruHariIni = {
  jurnal: boolean | null;
  absen: "lengkap" | "sebagian" | "belum" | null;
  quran: boolean | null;
  /** RPB bulan berjalan & Refleksi BULAN LALU -- hanya dibaca tanggal 1-5 (selain itu null). Bagian yang file bulannya
   *  tidak ada bernilai null (tidak dihitung). */
  rencana: { rpb: boolean | null; ref: boolean | null; bulanRpb: string; bulanRef: string } | null;
};

/** Terisi apa nggak (sama dengan aturan di halaman Rencana & Refleksi; "☐" = kotak bawaan template, bukan isian guru). */
function rpbTerisi(d: RpbTabData | null | undefined): boolean {
  return !!d && (d.tableB ?? []).some((row) => row.some((c) => (c ?? "").trim()));
}
function refleksiTerisi(d: ReflectionData | null | undefined): boolean {
  if (!d) return false;
  const anyRow = (rows?: string[][]) => (rows ?? []).some((r) => r.some((c) => (c ?? "").trim() && (c ?? "").trim() !== "☐"));
  const anyFlat = (vals?: string[]) => (vals ?? []).some((v) => (v ?? "").trim());
  const anyMurid = (rows?: string[][]) => (rows ?? []).some((r) => r.slice(1).some((c) => (c ?? "").trim())); // kolom Nama Murid (r[0]) tidak dihitung: nama terisi otomatis dari daftar santri
  return anyRow(d.capaianTarget) || anyFlat(d.keberhasilan) || anyRow(d.kendala) || anyFlat(d.evaluasiDiri) || anyFlat(d.refleksiGuru) || anyRow(d.rencanaPerbaikan) || anyMurid(d.perkembanganMurid);
}

export async function readStatusGuru(userId: string, kelas: string): Promise<StatusGuruHariIni> {
  const now = new Date();
  const today = ymd(now);
  const bulanNama = MONTH_NAMES[now.getMonth()];
  const pekanIdx = pekanKeBerapa(now, bulanNama);
  const fileId = capaianQuranFileId(kelas);
  const bulanLalu = MONTH_NAMES[new Date(now.getFullYear(), now.getMonth() - 1, 1).getMonth()];
  const rpbFile = RPB_FILES.find((f) => f.name === bulanNama);
  const refFile = REFLEKSI_FILES.find((f) => f.name === bulanLalu);
  const perluRencana = now.getDate() <= 5 && (!!rpbFile || !!refFile);
  const [j, a, q, rp, rf] = await Promise.allSettled([
    readJurnalRange(today, today, { userId }),
    readAbsenRange(today, today, { userId }),
    fileId ? dariCache(`quran:${fileId}:${bulanNama}`, () => readCapaianQuran(fileId, bulanNama)) : Promise.resolve(null),
    perluRencana && rpbFile ? dariCache(`rpb:${rpbFile.id}:${kelas}`, () => readRpbTab(rpbFile.id, kelas)) : Promise.resolve(null),
    perluRencana && refFile ? dariCache(`ref:${refFile.id}:${kelas}`, () => readReflectionTab(refFile.id, kelas)) : Promise.resolve(null),
  ]);
  return {
    jurnal: j.status === "fulfilled" ? isEntryFilled(j.value[today]) : null,
    absen: a.status === "fulfilled" ? (isAbsenLengkap(a.value[today]) ? "lengkap" : isAbsenFilled(a.value[today]) ? "sebagian" : "belum") : null,
    quran: q.status === "fulfilled" && q.value ? hasFillThisWeek(q.value.sections, pekanIdx, bulanNama) : null,
    rencana:
      perluRencana && rp.status === "fulfilled" && rf.status === "fulfilled"
        ? { rpb: rpbFile ? rpbTerisi(rp.value) : null, ref: refFile ? refleksiTerisi(rf.value) : null, bulanRpb: bulanNama, bulanRef: bulanLalu }
        : null,
  };
}

/** Ringkasan pengisian Jurnal & Absen HARI INI + Capaian Al-Qur'an MINGGU INI, lintas semua
 *  kelas — dipakai di Home management biar gak perlu buka Rekap satu-satu buat tau siapa yang
 *  belum isi. Capaian Al-Qur'an baca 13 file Google Sheets paralel (Promise.allSettled, kelas
 *  yang gagal dibaca gak dianggap "belum isi" — daripada salah tuduh gara-gara error jaringan). */
export async function readTodayStatus(allKelas: string[]): Promise<TodayStatus> {
  const today = ymd(new Date());
  const now = new Date();
  const bulanNama = MONTH_NAMES[now.getMonth()];
  const pekanIdx = pekanKeBerapa(now, bulanNama);

  const [{ data: jurnalRows }, { data: absenRows }, quranResults] = await Promise.all([
    supabase.from("jurnal_harian").select("kelas").eq("tanggal", today),
    supabase.from("absen_guru").select("kelas").eq("tanggal", today),
    Promise.allSettled(
      allKelas.map(async (kelas) => {
        const fileId = capaianQuranFileId(kelas);
        if (!fileId) return { kelas, filled: null };
        const data = await dariCache(`quran:${fileId}:${bulanNama}`, () => readCapaianQuran(fileId, bulanNama));
        return { kelas, filled: hasFillThisWeek(data.sections, pekanIdx, bulanNama) };
      })
    ),
  ]);

  const jurnalSet = new Set((jurnalRows ?? []).map((r) => r.kelas));
  const absenSet = new Set((absenRows ?? []).map((r) => r.kelas));
  const quranFilledSet = new Set<string>();
  const quranUnknownSet = new Set<string>();
  for (const r of quranResults) {
    if (r.status !== "fulfilled") continue; // network/sheet error - biarin, jangan ditandai apa-apa
    const { kelas, filled } = r.value;
    if (filled === null) quranUnknownSet.add(kelas); // gak ada file Capaian Quran buat kelas ini
    else if (filled) quranFilledSet.add(kelas);
  }
  // Baris yang gagal fetch (rejected) juga masuk "unknown" biar gak dianggap belum isi.
  for (let i = 0; i < allKelas.length; i++) {
    if (quranResults[i]?.status === "rejected") quranUnknownSet.add(allKelas[i]);
  }

  return {
    totalKelas: allKelas.length,
    jurnalFilled: allKelas.filter((k) => jurnalSet.has(k)),
    absenFilled: allKelas.filter((k) => absenSet.has(k)),
    quranFilled: allKelas.filter((k) => quranFilledSet.has(k)),
    quranUnknown: allKelas.filter((k) => quranUnknownSet.has(k)),
  };
}
