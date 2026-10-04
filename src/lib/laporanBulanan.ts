import { KELAS_LIST, RPB_FILES, REFLEKSI_FILES, capaianRoster, capaianQuranFileId, capaianIlmuFileId, olahragaRoster, kalenderBulan } from "../data";
import { supabase } from "./supabaseClient";
import { ymd, readAbsenRangeAll, isSesiFilled, type SesiEntry } from "./absen";
import { buildRekapBulanan, type Guru, type GuruRow } from "./absenBulanan";
import { readCapaianQuran, studentIndexFor } from "./capaianQuranSheet";
import { readCapaianIlmu, type CapaianIlmuData } from "./capaianIlmuSheet";
import { readRpbTab, type RpbTabData } from "./rpbSheet";
import { readReflectionTab, type ReflectionData } from "./refleksiSheet";
import { readTasmiRekapTahun, type TasmiRekapRow } from "./tasmi";
import { TINGKAT_LIST, isEvalAnakFilled, type OlahragaEntry, type OlahragaKelompok, type OlahragaTingkat } from "./olahraga";

// Laporan bulanan seluruh sekolah (card "Sajian Data", management): semua data yang diisi guru
// dikumpulin di 1 objek `Laporan`, dipakai bareng sama tampilan layar DAN export PDF. Cuma BACA,
// gak ada yang ditulis. Teks guru dibawa apa adanya (gak diringkas/ditebak).

export type QuranSantri = {
  nama: string;
  /** Total angka (baris yang dibaca) dalam 1 bulan. */
  total: number;
  /** Berapa slot/pertemuan yang ada isinya. */
  terisi: number;
  /** Banyaknya kode PT (persiapan tasmi') / TS (tasmi') yang ditulis guru -- cuma dihitung, gak ditafsirkan. */
  pt: number;
  ts: number;
};
export type QuranSection = { name: string; type: "pertemuan" | "pekan"; slotCount: number; santri: QuranSantri[] };

export type KelasLaporan = {
  kelas: string;
  guru: string;
  quran: QuranSection[] | null;
  ilmu: CapaianIlmuData | null;
  rpb: RpbTabData | null;
  refleksi: ReflectionData | null;
  /** Pesan error per sumber (mis. tab bulan itu belum dibuat di sheet). */
  err: { quran?: string; ilmu?: string; rpb?: string; refleksi?: string };
  jurnal: { terisi: number; total: number };
  absenSantri: { hadir: number; total: number } | null;
  tasmi: TasmiRekapRow[];
};

export type GuruSummary = {
  guru: Guru;
  hadir: number;
  izin: number;
  sakit: number;
  cuti: number;
  telat: number;
  awal: number;
  /** Hadir / (hadir+izin+sakit+cuti) dalam persen, null kalau belum ada sesi terisi. */
  persenHadir: number | null;
};

export type OlahragaLaporan = {
  rencana: { kelompok: OlahragaKelompok; tingkat: OlahragaTingkat; entry: OlahragaEntry | null }[];
  /** Per kelas, ikhwan + akhwat DIGABUNG (roster KA 1/KA 2 campur; KA 3 = roster ikhwan + akhwat). */
  evaluasi: { tingkat: OlahragaTingkat; terisi: number; total: number }[];
  absen: { kelompok: OlahragaKelompok; hadir: number; izin: number; sakit: number; cuti: number }[];
};

export type Laporan = {
  bulan: string;
  year: number;
  month0: number;
  hariKerja: Date[];
  kelas: KelasLaporan[];
  guruRows: GuruRow[];
  guruSummary: GuruSummary[];
  olahraga: OlahragaLaporan;
  perhatian: string[];
  dimuat: Date;
};

export type Progress = { selesai: number; total: number };

/* ───────── penentu "terisi" per sumber ───────── */

export const quranTerisi = (q: QuranSection[] | null) =>
  !!q && q.some((s) => s.santri.some((x) => x.terisi > 0));
export const ilmuTerisi = (d: CapaianIlmuData | null) =>
  !!d && Object.values(d.values).some((arr) => arr.some((v) => (v ?? "").trim() !== ""));
export const rpbTerisi = (d: RpbTabData | null) =>
  !!d && [...d.tableB, ...d.tableC].some((r) => r.slice(1).some((c) => (c ?? "").trim() !== ""));
export const refleksiTerisi = (d: ReflectionData | null) =>
  !!d &&
  [...d.keberhasilan, ...d.refleksiGuru, ...d.kendala.flat(), ...d.rencanaPerbaikan.flat(), ...d.perkembanganMurid.flat()].some(
    (c) => (c ?? "").trim() !== ""
  );

/* ───────── util ───────── */

async function pool<T>(items: (() => Promise<T>)[], limit: number, onDone: () => void): Promise<T[]> {
  const out: T[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await items[i]();
      onDone();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

function weekdaysOf(year: number, month0: number): Date[] {
  const out: Date[] = [];
  const d = new Date(year, month0, 1);
  while (d.getMonth() === month0) {
    const w = d.getDay();
    if (w >= 1 && w <= 5) out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function ringkasQuran(raw: Awaited<ReturnType<typeof readCapaianQuran>>, kelas: string): QuranSection[] {
  const roster = capaianRoster(kelas);
  return raw.sections.map((sec) => {
    const santri: QuranSantri[] = roster.map((nama, i) => {
      const idx = studentIndexFor(sec, roster, i);
      const vals = idx >= 0 ? sec.students[idx].values : [];
      let total = 0;
      let terisi = 0;
      let pt = 0;
      let ts = 0;
      for (const v of vals) {
        const t = (v ?? "").trim();
        if (!t) continue;
        terisi++;
        if (/^pt\b/i.test(t) || /^pt\./i.test(t)) pt++;
        else if (/^ts\b/i.test(t) || /^ts\./i.test(t)) ts++;
        else {
          const n = parseFloat(t.replace(",", "."));
          if (!Number.isNaN(n)) total += n;
        }
      }
      return { nama, total: Math.round(total * 10) / 10, terisi, pt, ts };
    });
    return { name: sec.name, type: sec.type, slotCount: sec.slotCount, santri };
  });
}

function sesiHitung(s: SesiEntry, acc: { hadir: number; izin: number; sakit: number; cuti: number }) {
  if (!isSesiFilled(s)) return;
  acc[s.status]++;
}

/* ───────── pemuat utama ───────── */

export async function muatLaporan(bulan: string, onProgress?: (p: Progress) => void): Promise<Laporan> {
  const kal = kalenderBulan(bulan);
  if (!kal) throw new Error(`Bulan "${bulan}" tidak dikenal.`);
  const { year, month0 } = kal;
  const from = ymd(new Date(year, month0, 1));
  const to = ymd(new Date(year, month0 + 1, 0));
  const todayYmd = ymd(new Date());
  const hariKerja = weekdaysOf(year, month0);
  const hariBerjalan = hariKerja.filter((d) => ymd(d) <= todayYmd);

  const rpbFile = RPB_FILES.find((f) => f.name === bulan);
  const refFile = REFLEKSI_FILES.find((f) => f.name === bulan);

  // Tugas pembacaan Sheets: per kelas 4 sumber. Dijalankan paralel terbatas biar gak membebani edge function.
  type Slot = { kelas: string; kind: "quran" | "ilmu" | "rpb" | "refleksi" };
  const slots: Slot[] = [];
  for (const k of KELAS_LIST) for (const kind of ["quran", "ilmu", "rpb", "refleksi"] as const) slots.push({ kelas: k.name, kind });

  const total = slots.length + 6; // +6: tarikan Supabase
  let selesai = 0;
  const tick = () => onProgress?.({ selesai: ++selesai, total });
  onProgress?.({ selesai: 0, total });

  const sheetJobs = slots.map((s) => async () => {
    try {
      if (s.kind === "quran") {
        const id = capaianQuranFileId(s.kelas);
        if (!id) throw new Error("File tidak ditemukan");
        return { s, ok: true as const, v: ringkasQuran(await readCapaianQuran(id, bulan), s.kelas) };
      }
      if (s.kind === "ilmu") {
        const id = capaianIlmuFileId(s.kelas);
        if (!id) throw new Error("File tidak ditemukan");
        return { s, ok: true as const, v: await readCapaianIlmu(id, bulan) };
      }
      if (s.kind === "rpb") {
        if (!rpbFile) throw new Error("File RPB bulan ini belum ada");
        return { s, ok: true as const, v: await readRpbTab(rpbFile.id, s.kelas) };
      }
      if (!refFile) throw new Error("File Refleksi bulan ini belum ada");
      return { s, ok: true as const, v: await readReflectionTab(refFile.id, s.kelas) };
    } catch (e) {
      return { s, ok: false as const, e: errMsg(e) };
    }
  });

  const supa = async <T,>(f: () => PromiseLike<T>): Promise<T> => {
    const r = await f();
    tick();
    return r;
  };

  const [sheetRes, profilesRes, absenGuruRows, jurnalRes, absenSantriRes, tasmiRows, olahragaRes] = await Promise.all([
    pool(sheetJobs, 6, tick),
    supa(() => supabase.from("profiles").select("kelas, full_name").eq("role", "guru")),
    supa(() => readAbsenRangeAll(from, to)),
    supa(() =>
      supabase.from("jurnal_harian").select("kelas, tanggal, kondisi_guru, kondisi_santri, kabar_kendala").gte("tanggal", from).lte("tanggal", to)
    ),
    supa(() =>
      supabase.from("absen_santri").select("kelas, tanggal, status_pagi, status_siang").gte("tanggal", from).lte("tanggal", to)
    ),
    supa(() => readTasmiRekapTahun(year)),
    supa(async () => {
      const [rencana, evaluasi, absen] = await Promise.all([
        supabase.from("olahraga_bulanan").select("*").eq("bulan", bulan),
        supabase.from("olahraga_evaluasi_anak").select("kelompok, tingkat, nama_santri, eval_ketercapaian, eval_partisipasi, eval_kendala, eval_perkembangan, eval_tindak_lanjut").eq("bulan", bulan),
        supabase.from("absen_olahraga").select("kelompok, tanggal, status").gte("tanggal", from).lte("tanggal", to),
      ]);
      return { rencana, evaluasi, absen };
    }),
  ]);

  /* guru */
  const order = (k: string) => {
    const i = KELAS_LIST.findIndex((x) => x.name === k);
    return i === -1 ? 999 : i;
  };
  const guruList: Guru[] = ((profilesRes.data ?? []) as { kelas: string | null; full_name: string | null }[])
    .filter((r) => r.kelas)
    .map((r) => ({ kelas: r.kelas as string, nama: r.full_name || (r.kelas as string) }))
    .sort((a, b) => order(a.kelas) - order(b.kelas));
  const guruNama = new Map(guruList.map((g) => [g.kelas, g.nama]));

  const guruRows = buildRekapBulanan(guruList, absenGuruRows, hariKerja);
  const guruSummary: GuruSummary[] = guruRows.map((r) => {
    const acc = { hadir: 0, izin: 0, sakit: 0, cuti: 0 };
    for (const row of absenGuruRows) {
      if (row.kelas !== r.guru.kelas) continue;
      sesiHitung(row.pagi, acc);
      sesiHitung(row.siang, acc);
    }
    const n = acc.hadir + acc.izin + acc.sakit + acc.cuti;
    return { guru: r.guru, ...acc, telat: r.telat, awal: r.awal, persenHadir: n ? Math.round((acc.hadir / n) * 100) : null };
  });

  /* sheet -> per kelas */
  const perKelas = new Map<string, KelasLaporan>();
  for (const k of KELAS_LIST) {
    perKelas.set(k.name, {
      kelas: k.name,
      guru: guruNama.get(k.name) ?? "",
      quran: null,
      ilmu: null,
      rpb: null,
      refleksi: null,
      err: {},
      jurnal: { terisi: 0, total: hariBerjalan.length },
      absenSantri: null,
      tasmi: [],
    });
  }
  for (const r of sheetRes) {
    const kl = perKelas.get(r.s.kelas)!;
    if (!r.ok) {
      kl.err[r.s.kind] = r.e;
      continue;
    }
    if (r.s.kind === "quran") kl.quran = r.v as QuranSection[];
    else if (r.s.kind === "ilmu") kl.ilmu = r.v as CapaianIlmuData;
    else if (r.s.kind === "rpb") kl.rpb = r.v as RpbTabData;
    else kl.refleksi = r.v as ReflectionData;
  }

  /* jurnal */
  const jurnalHari = new Map<string, Set<string>>();
  for (const row of (jurnalRes.data ?? []) as { kelas: string; tanggal: string; kondisi_guru: string; kondisi_santri: string; kabar_kendala: string }[]) {
    if (![row.kondisi_guru, row.kondisi_santri, row.kabar_kendala].some((t) => (t ?? "").trim() !== "")) continue;
    if (!jurnalHari.has(row.kelas)) jurnalHari.set(row.kelas, new Set());
    jurnalHari.get(row.kelas)!.add(row.tanggal);
  }
  /* absen santri */
  const asAgg = new Map<string, { hadir: number; total: number }>();
  for (const row of (absenSantriRes.data ?? []) as { kelas: string; status_pagi: string; status_siang: string }[]) {
    const a = asAgg.get(row.kelas) ?? { hadir: 0, total: 0 };
    for (const st of [row.status_pagi, row.status_siang]) {
      a.total++;
      if (st === "hadir") a.hadir++;
    }
    asAgg.set(row.kelas, a);
  }
  /* tasmi (kelas tidak ada di TasmiRekapRow? ada: kelas) */
  const bulanPrefix = `${year}-${String(month0 + 1).padStart(2, "0")}`;
  for (const t of tasmiRows) {
    if (!t.tanggal.startsWith(bulanPrefix)) continue;
    perKelas.get(t.kelas)?.tasmi.push(t);
  }
  for (const kl of perKelas.values()) {
    kl.jurnal.terisi = jurnalHari.get(kl.kelas)?.size ?? 0;
    kl.absenSantri = asAgg.get(kl.kelas) ?? null;
  }

  /* olahraga */
  const kelompokList: OlahragaKelompok[] = ["ikhwan", "akhwat"];
  const rencanaRows = (olahragaRes.rencana.data ?? []) as any[];
  const rencana: OlahragaLaporan["rencana"] = [];
  for (const kel of kelompokList)
    for (const t of TINGKAT_LIST) {
      const row = rencanaRows.find((r) => r.kelompok === kel && r.tingkat === t);
      rencana.push({
        kelompok: kel,
        tingkat: t,
        entry: row
          ? {
              tingkat: t,
              bulan,
              pekan1: row.pekan1 ?? "",
              pekan2: row.pekan2 ?? "",
              pekan3: row.pekan3 ?? "",
              pekan4: row.pekan4 ?? "",
              target: Array.isArray(row.target) ? row.target : [],
              alat: row.alat ?? "",
            }
          : null,
      });
    }
  const evalRows = (olahragaRes.evaluasi.data ?? []) as any[];
  const evaluasi: OlahragaLaporan["evaluasi"] = TINGKAT_LIST.map((t) => {
    const roster = new Set([...olahragaRoster(t, "ikhwan"), ...olahragaRoster(t, "akhwat")]);
    const terisi = new Set(
      evalRows.filter((r) => r.tingkat === t && isEvalAnakFilled(r)).map((r) => r.nama_santri as string)
    );
    return { tingkat: t, terisi: [...terisi].filter((n) => roster.has(n)).length, total: roster.size };
  });
  const absenOl: OlahragaLaporan["absen"] = kelompokList.map((kel) => {
    const acc = { hadir: 0, izin: 0, sakit: 0, cuti: 0 };
    for (const r of (olahragaRes.absen.data ?? []) as any[]) if (r.kelompok === kel && r.status in acc) acc[r.status as keyof typeof acc]++;
    return { kelompok: kel, ...acc };
  });

  const kelasArr = KELAS_LIST.map((k) => perKelas.get(k.name)!);

  /* catatan perhatian (otomatis, hanya fakta dari data) */
  const perhatian: string[] = [];
  for (const kl of kelasArr) {
    const kosong: string[] = [];
    if (!quranTerisi(kl.quran)) kosong.push("Capaian Al-Qur'an");
    if (!ilmuTerisi(kl.ilmu)) kosong.push("Capaian Ilmu");
    if (!rpbTerisi(kl.rpb)) kosong.push("RPB");
    if (!refleksiTerisi(kl.refleksi)) kosong.push("Refleksi");
    if (kosong.length) perhatian.push(`${kl.kelas}: belum terisi — ${kosong.join(", ")}.`);
  }
  for (const g of guruSummary) {
    if (g.telat >= 3) perhatian.push(`${g.guru.nama} (${g.guru.kelas}): telat datang ${g.telat} kali.`);
    if (g.awal >= 3) perhatian.push(`${g.guru.nama} (${g.guru.kelas}): pulang lebih awal ${g.awal} kali.`);
  }
  for (const e of evaluasi) {
    if (e.terisi < e.total) perhatian.push(`Evaluasi olahraga ${e.tingkat}: ${e.terisi} dari ${e.total} santri terisi.`);
  }

  return {
    bulan,
    year,
    month0,
    hariKerja,
    kelas: kelasArr,
    guruRows,
    guruSummary,
    olahraga: { rencana, evaluasi, absen: absenOl },
    perhatian,
    dimuat: new Date(),
  };
}
