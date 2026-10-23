import { supabase } from "./supabaseClient";
import { ymd } from "./jurnal";
import { capaianQuranFileId, pekanKalenderKe, slotsDiPekan } from "../data";
import { readCapaianQuran } from "./capaianQuranSheet";

export type TodayStatus = {
  totalKelas: number;
  jurnalFilled: string[]; // nama kelas yang sudah isi Jurnal hari ini
  absenFilled: string[]; // nama kelas yang sudah isi Absen hari ini (minimal 1 sesi)
  quranFilled: string[]; // nama kelas yang sudah ada isian Capaian Al-Qur'an MINGGU ini
  quranUnknown: string[]; // gagal dibaca (network/sheet error) - jangan dianggap "belum isi"
};

const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** Pekan kalender (Senin-Jumat) ke berapa dalam bulan ini; pekan 1 bisa pendek (lihat data.ts). */
function pekanKeBerapa(d: Date): number {
  return pekanKalenderKe(d);
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

/** Ringkasan pengisian Jurnal & Absen HARI INI + Capaian Al-Qur'an MINGGU INI, lintas semua
 *  kelas — dipakai di Home management biar gak perlu buka Rekap satu-satu buat tau siapa yang
 *  belum isi. Capaian Al-Qur'an baca 13 file Google Sheets paralel (Promise.allSettled, kelas
 *  yang gagal dibaca gak dianggap "belum isi" — daripada salah tuduh gara-gara error jaringan). */
export async function readTodayStatus(allKelas: string[]): Promise<TodayStatus> {
  const today = ymd(new Date());
  const now = new Date();
  const bulanNama = MONTH_NAMES[now.getMonth()];
  const pekanIdx = pekanKeBerapa(now);

  const [{ data: jurnalRows }, { data: absenRows }, quranResults] = await Promise.all([
    supabase.from("jurnal_harian").select("kelas").eq("tanggal", today),
    supabase.from("absen_guru").select("kelas").eq("tanggal", today),
    Promise.allSettled(
      allKelas.map(async (kelas) => {
        const fileId = capaianQuranFileId(kelas);
        if (!fileId) return { kelas, filled: null };
        const data = await readCapaianQuran(fileId, bulanNama);
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
