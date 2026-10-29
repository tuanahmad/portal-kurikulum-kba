import { capaianRoster, jenjangOf, kalenderBulan, isMonthOpen, pekanGridCount, slotsDiPekan, slotUntukTanggal, pekanUntukSlot, tanggalSlot } from "../data";
import { muatLaporan, refleksiTerisi, quranTerisi, type Laporan, type KelasLaporan, type QuranSection, type Progress } from "./laporanBulanan";
import { daftarTargetIlmu, bacaTandaTargetBulan, kunciTarget, type TandaTersimpan } from "./targetIlmu";
import { angkaTargetQuran } from "./rpbSheet";
import { supabase } from "./supabaseClient";
import { ramahkanGalat } from "./jaringan";

// Laporan KBM (Sajian Data): menilai ketercapaian target per bulan dan menyusun narasinya.
//  - Ilmu: tiap target ilmu di RPB dinilai dari tanda guru (Sudah/Belum) di Capaian Ilmu. Tanpa tanda = tidak tercatat.
//  - Al-Qur'an: dihitung otomatis dari Capaian Al-Qur'an:
//      ziyadah/talaqqi tercapai bila total baris sebulan >= target per pertemuan (RPB bagian D) x jumlah pertemuan;
//      muroja'ah tercapai bila total baris muroja'ah > 0 dan >= total baris ziyadah;
//      wirid tercapai bila tiap pekan (yang sudah berjalan) minimal 1 putaran.
// Persentase = tercapai / (tercapai + belum). Yang tidak tercatat / tanpa target tidak ikut dihitung, KECUALI target
// ilmu: yang belum ditandai ikut dihitung sebagai penyebut (sama dengan laporan triwulan Juli-September).

export type Simbol = "ok" | "belum" | "kosong" | "tanpa";
export const SIMBOL: Record<Simbol, string> = { ok: "✓", belum: "✗", kosong: "○", tanpa: "–" };

export type ItemIlmu = { bidang: string; target: string; simbol: "ok" | "belum" | "kosong"; ket: string };
export type KelasIlmu = { kelas: string; guru: string; items: ItemIlmu[]; adaRpb: boolean };

export type KategoriQuran = "ziyadah" | "muroja" | "wirid";
export type ItemQuran = { nama: string; kategori: KategoriQuran; label: string; target: string; capaian: string; simbol: Simbol; ket: string; pekanKosong?: number };
export type KelasQuran = { kelas: string; guru: string; labelZ: string; pertemuan: number; items: ItemQuran[]; adaData: boolean };

export type GrafikKelas = { kelas: string; labelZ: string; pekan: number; santri: { nama: string; z: number[]; m: number[] }[] };

/** a tercapai dari b yang bisa dinilai; p = persen (null kalau b = 0). */
export type Rasio = { a: number; b: number; p: number | null };
const rasio = (a: number, b: number): Rasio => ({ a, b, p: b ? Math.round((a / b) * 100) : null });

export type NilaiBulan = {
  bulan: string;
  year: number;
  berjalan: boolean;
  lap: Laporan;
  ilmu: KelasIlmu[];
  quran: KelasQuran[];
  grafik: GrafikKelas[];
  ringkas: {
    ilmu: Rasio & { rencana: number; belum: number; kosong: number };
    belumPerBidang: Record<string, number>;
    ilmuPerKelas: Record<string, Rasio | null>;
    ziyadah: Rasio;
    muroja: Rasio;
    wirid: Rasio;
    ziyadahPerKelas: Record<string, Rasio | null>;
    santriBelumZ: { kelas: string; nama: string }[];
    tanpaTargetQuran: number;
  };
  kualitas: { kelas: string; masalah: string; usulan: string }[];
};

/* ───────── util ───────── */

const normNama = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const angka = (v: string): number | null => {
  const t = (v ?? "").trim().replace(",", ".");
  return /^\d+(\.\d+)?$/.test(t) ? parseFloat(t) : null;
};
/** Angka di awal isian ("2", "1,5", "3 putaran") -> angkanya; null kalau tidak diawali angka. */
const angkaAwal = (v: string): number | null => {
  const m = (v ?? "").trim().replace(",", ".").match(/^\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};
export const fmt = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

/** Kelompok bidang untuk tabel "target belum tercapai per bidang" (nama bidang di RPB ditulis guru dengan bebas). */
export function kategoriBidang(b: string): string {
  const s = b.toLowerCase();
  if (/hitung|angka|matemat|perkalian|pembagian|bilangan/.test(s)) return "Berhitung";
  if (/calis|calistung|huruf/.test(s)) return "Calis/huruf";
  if (/menulis|tulis|imla/.test(s)) return "Menulis";
  if (/bahasa/.test(s)) return "Bahasa";
  if (/membaca|baca/.test(s)) return "Membaca";
  if (/kisah|sirah|siroh|sejarah/.test(s)) return "Kisah";
  if (/urjuzah|ahsanul|tauhid|rusyd|mutun|matan|aqidah|akidah/.test(s)) return "Mutun";
  if (/doa|do'a|zikir|dzikir|shalat|sholat/.test(s)) return "Doa dan zikir";
  if (/baghdad/.test(s)) return "Baghdadiyah";
  if (/olahraga|renang|jiu|panah|kuda/.test(s)) return "Olahraga";
  if (/akhwat/.test(s)) return "Keakhwatan";
  if (/adab|akhlak|akhlaq/.test(s)) return "Adab";
  return b.trim();
}

/** Jumlah pertemuan bulan itu: angka di "Jumlah Pertemuan" RPB kalau ada, kalau tidak = jumlah hari sekolah (Senin-Jumat). */
export function pertemuanBulan(bulan: string, jumlahPertemuanRpb?: string): number {
  const m = (jumlahPertemuanRpb ?? "").match(/\d+/);
  const n = m ? parseInt(m[0], 10) : NaN;
  if (Number.isFinite(n) && n >= 1 && n <= 31) return n;
  let c = 0;
  for (let s = 1; s <= 25; s++) if (tanggalSlot(bulan, s)) c++;
  return c;
}

/** Pekan yang sudah SELESAI (untuk menilai wirid): bulan yang sudah lewat = semua pekan; bulan berjalan = pekan-pekan
 *  sebelum pekan ini (pekan ini ikut dihitung kalau hari ini hari sekolah terakhirnya). */
function pekanSelesai(bulan: string, berjalan: boolean): number {
  const semua = pekanGridCount(bulan);
  if (!berjalan) return semua;
  const s = slotUntukTanggal(bulan, new Date(), 25);
  if (!s) return semua;
  const p = pekanUntukSlot(bulan, s);
  return Math.min(semua, s % 5 === 0 ? p : p - 1);
}

function bulanBerjalan(bulan: string): boolean {
  const k = kalenderBulan(bulan);
  const now = new Date();
  return !!k && k.year === now.getFullYear() && k.month0 === now.getMonth();
}

/** Surat yang tercatat (Capaian Al-Qur'an) untuk 1 bulan, semua kelas: kelas -> `${bagian}|${nama}` -> daftar surat urut slot. */
async function bacaSuratSemua(bulan: string): Promise<Map<string, Map<string, string[]>>> {
  const { data, error } = await supabase.from("capaian_quran_surat").select("kelas, section, slot, nama_santri, surat").eq("bulan", bulan).order("slot");
  if (error) throw new Error(ramahkanGalat(error.message));
  const out = new Map<string, Map<string, string[]>>();
  for (const r of data ?? []) {
    const k = r.kelas as string;
    if (!out.has(k)) out.set(k, new Map());
    const key = `${r.section}|${normNama(r.nama_santri as string)}`;
    const arr = out.get(k)!.get(key) ?? [];
    if (!arr.includes(r.surat as string)) arr.push(r.surat as string);
    out.get(k)!.set(key, arr);
  }
  return out;
}

/* ───────── penilaian per kelas ───────── */

function nilaiIlmu(kl: KelasLaporan, tanda: Map<string, TandaTersimpan> | undefined): KelasIlmu {
  const items: ItemIlmu[] = daftarTargetIlmu(kl.rpb).map((t) => {
    const s = tanda?.get(kunciTarget(t.bidang, t.target));
    return {
      bidang: t.bidang,
      target: t.target,
      simbol: s ? (s.status === "sudah" ? "ok" : "belum") : "kosong",
      ket: s ? s.keterangan || (s.status === "sudah" ? "Tercapai." : "") : "Belum ditandai guru.",
    };
  });
  return { kelas: kl.kelas, guru: kl.guru, items, adaRpb: !!kl.rpb };
}

const cariSec = (q: QuranSection[] | null, re: RegExp) => q?.find((s) => re.test(s.name)) ?? null;

function nilaiQuran(kl: KelasLaporan, bulan: string, berjalan: boolean, surat: Map<string, string[]> | undefined): KelasQuran {
  const q = kl.quran;
  const secZ = cariSec(q, /ziyadah|talaqqi/i);
  const secM = cariSec(q, /muroja/i);
  const secW = cariSec(q, /wirid/i);
  const labelZ = secZ ? (/talaqqi/i.test(secZ.name) ? "Talaqqi" : "Ziyadah") : jenjangOf(kl.kelas) === "Qonuni" ? "Ziyadah" : "Talaqqi";
  const pertemuan = pertemuanBulan(bulan, kl.rpb?.jumlahPertemuan);
  const target = new Map((kl.rpb?.quran ?? []).map((r) => [normNama(r.nama), angkaTargetQuran(r.target)]));
  const items: ItemQuran[] = [];
  const nPekan = pekanSelesai(bulan, berjalan);
  // Pekan terakhir yang dipakai kelas ini di tabel wirid: pekan sesudahnya yang kosong untuk SEMUA santri (mis. pekan ke-5
  // September yang cuma 2 hari) tidak dianggap "tidak tercatat".
  const wiridDipakai = Math.max(0, ...(secW?.santri ?? []).map((s) => (s.nilai ?? []).reduce((a, v, j) => (v ? j + 1 : a), 0)));
  const daftarSurat = (sec: QuranSection, nama: string) => surat?.get(`${sec.name}|${normNama(nama)}`) ?? [];
  const kode = (pt: number, ts: number) => [pt ? `PT ${pt}x` : "", ts ? `TS ${ts}x` : ""].filter(Boolean).join(", ");

  for (const nama of capaianRoster(kl.kelas)) {
    const cari = (sec: QuranSection | null) => sec?.santri.find((s) => normNama(s.nama) === normNama(nama)) ?? null;
    const z = cariSec(q, /ziyadah|talaqqi/i) ? cari(secZ) : null;
    if (secZ) {
      const tgt = target.get(normNama(nama)) ?? null;
      const sur = daftarSurat(secZ, nama);
      const capaian = !z || z.terisi === 0 ? "Tidak tercatat" : `${fmt(z.total)} baris${sur.length ? ` · ${sur.join(", ")}` : ""}${kode(z.pt, z.ts) ? ` · ${kode(z.pt, z.ts)}` : ""}`;
      if (tgt == null) {
        items.push({ nama, kategori: "ziyadah", label: labelZ, target: "—", capaian, simbol: "tanpa", ket: "Target angka belum diisi di RPB; capaian hanya dicatat." });
      } else {
        const butuh = Math.round(tgt * pertemuan * 10) / 10;
        const tTeks = `${fmt(tgt)} baris × ${pertemuan} pertemuan = ${fmt(butuh)} baris`;
        if (!z || z.terisi === 0) items.push({ nama, kategori: "ziyadah", label: labelZ, target: tTeks, capaian, simbol: "kosong", ket: "Belum ada catatan bulan ini." });
        else if (z.total >= butuh) items.push({ nama, kategori: "ziyadah", label: labelZ, target: tTeks, capaian, simbol: "ok", ket: z.total > butuh ? "Melewati target." : "Tercapai." });
        else items.push({ nama, kategori: "ziyadah", label: labelZ, target: tTeks, capaian, simbol: "belum", ket: `Kurang ${fmt(butuh - z.total)} baris dari target.` });
      }
    }
    if (secM) {
      const m = cari(secM);
      const zTot = z?.total ?? 0;
      const sur = daftarSurat(secM, nama);
      const capaian = !m || m.terisi === 0 ? "Tidak tercatat" : `${fmt(m.total)} baris${sur.length ? ` · ${sur.join(", ")}` : ""}`;
      const tTeks = `≥ ziyadah bulan ini (${fmt(zTot)} baris)`;
      if (!m || m.terisi === 0) items.push({ nama, kategori: "muroja", label: "Muroja'ah", target: tTeks, capaian, simbol: "kosong", ket: "Belum ada catatan bulan ini." });
      else if (m.total > 0 && m.total >= zTot) items.push({ nama, kategori: "muroja", label: "Muroja'ah", target: tTeks, capaian, simbol: "ok", ket: "Tercapai." });
      else items.push({ nama, kategori: "muroja", label: "Muroja'ah", target: tTeks, capaian, simbol: "belum", ket: `Di bawah jumlah baris ziyadah.` });
    }
    if (secW) {
      const w = cari(secW);
      const n = Math.min(nPekan, secW.slotCount);
      const vals = Array.from({ length: n }, (_, j) => w?.nilai?.[j] ?? "");
      const capaian = vals.some(Boolean) ? vals.map((v, j) => `P${j + 1}: ${v || "-"}`).join(", ") : "Tidak tercatat";
      // Pekan berisi PT/TS (persiapan tasmi' / tasmi') tidak dinilai: santri sedang fokus tasmi'.
      const kodeTasmi = (v: string) => /^(pt|ts)\b/i.test(v.trim());
      // Dinilai dari pekan yang TERCATAT (sama dengan aturan laporan triwulan Juli-September); pekan kosong disebut di
      // keterangan dan masuk catatan kualitas data, tidak membuat gagal.
      const dinilai = vals.map((v, j) => ({ j, v })).filter((o) => o.v && !kodeTasmi(o.v));
      const kurang = dinilai.filter((o) => (angkaAwal(o.v) ?? 0) < 1).map((o) => o.j + 1);
      const kosongP = vals.map((v, j) => (v || j >= wiridDipakai ? 0 : j + 1)).filter(Boolean);
      const catatanKosong = kosongP.length ? ` Pekan ${kosongP.join(", ")} tidak tercatat.` : "";
      const tTeks = "≥ 1 putaran tiap pekan";
      if (n === 0) items.push({ nama, kategori: "wirid", label: "Wirid", target: tTeks, capaian: "-", simbol: "kosong", ket: "Belum ada pekan yang selesai bulan ini." });
      else if (!vals.some(Boolean)) items.push({ nama, kategori: "wirid", label: "Wirid", target: tTeks, capaian, simbol: "kosong", ket: "Belum ada catatan bulan ini." });
      else if (!dinilai.length) items.push({ nama, kategori: "wirid", label: "Wirid", target: tTeks, capaian, simbol: "tanpa", ket: `Pekan yang tercatat berisi PT/TS (tasmi'), tidak dinilai.${catatanKosong}` });
      else if (kurang.length) items.push({ nama, kategori: "wirid", label: "Wirid", target: tTeks, capaian, simbol: "belum", ket: `Pekan ${kurang.join(", ")} kurang dari 1 putaran.${catatanKosong}`, pekanKosong: kosongP.length });
      else items.push({ nama, kategori: "wirid", label: "Wirid", target: tTeks, capaian, simbol: "ok", ket: `Tercapai.${catatanKosong}`, pekanKosong: kosongP.length });
    }
  }
  return { kelas: kl.kelas, guru: kl.guru, labelZ, pertemuan, items, adaData: quranTerisi(q) };
}

function grafikKelas(kl: KelasLaporan, bulan: string, labelZ: string): GrafikKelas | null {
  const secZ = cariSec(kl.quran, /ziyadah|talaqqi/i);
  const secM = cariSec(kl.quran, /muroja/i);
  if (!secZ || secZ.type !== "pertemuan" || !quranTerisi(kl.quran)) return null;
  const pekan = pekanGridCount(bulan);
  const perPekan = (sec: QuranSection | null, nama: string) => {
    const s = sec?.santri.find((x) => normNama(x.nama) === normNama(nama));
    return Array.from({ length: pekan }, (_, w) =>
      slotsDiPekan(bulan, w + 1, sec?.slotCount ?? 0).reduce((a, slot) => a + (angka(s?.nilai?.[slot - 1] ?? "") ?? 0), 0)
    );
  };
  const santri = secZ.santri.map((s) => ({ nama: s.nama, z: perPekan(secZ, s.nama), m: secM?.type === "pertemuan" ? perPekan(secM, s.nama) : [] }));
  return { kelas: kl.kelas, labelZ, pekan, santri };
}

/* ───────── pemuat ───────── */

export async function muatNilaiBulan(bulan: string, onProgress?: (p: Progress) => void): Promise<NilaiBulan> {
  const [lap, tanda, surat] = await Promise.all([muatLaporan(bulan, onProgress), bacaTandaTargetBulan(bulan), bacaSuratSemua(bulan)]);
  const berjalan = bulanBerjalan(bulan);
  const ilmu = lap.kelas.map((kl) => nilaiIlmu(kl, tanda.get(kl.kelas)));
  const quran = lap.kelas.map((kl) => nilaiQuran(kl, bulan, berjalan, surat.get(kl.kelas)));
  const grafik = lap.kelas.map((kl, i) => grafikKelas(kl, bulan, quran[i].labelZ)).filter((g): g is GrafikKelas => !!g);

  const semuaIlmu = ilmu.flatMap((k) => k.items);
  const hit = (arr: { simbol: string }[], s: string) => arr.filter((x) => x.simbol === s).length;
  const belumPerBidang: Record<string, number> = {};
  for (const it of semuaIlmu) if (it.simbol === "belum") belumPerBidang[kategoriBidang(it.bidang)] = (belumPerBidang[kategoriBidang(it.bidang)] ?? 0) + 1;
  const ilmuPerKelas: Record<string, Rasio | null> = {};
  for (const k of ilmu) ilmuPerKelas[k.kelas] = k.items.length ? rasio(hit(k.items, "ok"), k.items.length) : null;
  const semuaQ = quran.flatMap((k) => k.items);
  const rq = (kat: KategoriQuran, arr = semuaQ) => {
    const x = arr.filter((i) => i.kategori === kat);
    return rasio(hit(x, "ok"), hit(x, "ok") + hit(x, "belum"));
  };
  const ziyadahPerKelas: Record<string, Rasio | null> = {};
  for (const k of quran) {
    const r = rq("ziyadah", k.items);
    ziyadahPerKelas[k.kelas] = r.b ? r : null;
  }

  const kualitas: NilaiBulan["kualitas"] = [];
  for (let i = 0; i < lap.kelas.length; i++) {
    const kl = lap.kelas[i];
    const sumber: [keyof KelasLaporan["err"], string][] = [["rpb", "RPB"], ["ilmu", "Capaian Ilmu"], ["quran", "Capaian Al-Qur'an"], ["refleksi", "Refleksi"]];
    for (const [k, nama] of sumber) if (kl.err[k]) kualitas.push({ kelas: kl.kelas, masalah: `${nama} tidak bisa dibaca: ${kl.err[k]}`, usulan: "Periksa tab bulan ini di file sheet-nya." });
    if (kl.rpb && ilmu[i].items.length === 0) kualitas.push({ kelas: kl.kelas, masalah: "RPB belum berisi target ilmu.", usulan: "Isi Target Pembelajaran di RPB." });
    const tanpaTanda = hit(ilmu[i].items, "kosong");
    if (tanpaTanda) kualitas.push({ kelas: kl.kelas, masalah: `${tanpaTanda} target ilmu belum ditandai Sudah/Belum.`, usulan: "Tandai di Capaian Ilmu, bagian Target RPB." });
    const tanpaTarget = quran[i].items.filter((x) => x.kategori === "ziyadah" && x.simbol === "tanpa").length;
    if (tanpaTarget) kualitas.push({ kelas: kl.kelas, masalah: `${tanpaTarget} santri belum punya angka target ${quran[i].labelZ.toLowerCase()}.`, usulan: "Isi target baris per pertemuan di RPB bagian Al-Qur'an." });
    const wiridBolong = quran[i].items.filter((x) => x.kategori === "wirid" && (x.pekanKosong ?? 0) > 0).length;
    if (wiridBolong) kualitas.push({ kelas: kl.kelas, masalah: `Catatan wirid ${wiridBolong} santri kosong di sebagian pekan.`, usulan: "Isi wirid tiap pekan (angka putaran)." });
    if (!kl.err.quran && !quranTerisi(kl.quran)) kualitas.push({ kelas: kl.kelas, masalah: "Capaian Al-Qur'an belum diisi.", usulan: "Isi capaian per pertemuan." });
    if (!kl.err.refleksi && !refleksiTerisi(kl.refleksi)) kualitas.push({ kelas: kl.kelas, masalah: "Refleksi guru belum diisi.", usulan: berjalan ? "Diisi di akhir bulan." : "Lengkapi refleksi bulan ini." });
  }

  return {
    bulan,
    year: lap.year,
    berjalan,
    lap,
    ilmu,
    quran,
    grafik,
    ringkas: {
      ilmu: { ...rasio(hit(semuaIlmu, "ok"), semuaIlmu.length), rencana: semuaIlmu.length, belum: hit(semuaIlmu, "belum"), kosong: hit(semuaIlmu, "kosong") },
      belumPerBidang,
      ilmuPerKelas,
      ziyadah: rq("ziyadah"),
      muroja: rq("muroja"),
      wirid: rq("wirid"),
      ziyadahPerKelas,
      santriBelumZ: quran.flatMap((k) => k.items.filter((x) => x.kategori === "ziyadah" && x.simbol === "belum").map((x) => ({ kelas: k.kelas, nama: x.nama }))),
      tanpaTargetQuran: semuaQ.filter((x) => x.kategori === "ziyadah" && x.simbol === "tanpa").length,
    },
    kualitas,
  };
}

/* ───────── periode ───────── */

export type Periode = { jenis: "bulan" | "triwulan"; bulan: string[]; kunci: string; label: string };
export const TRIWULAN: string[][] = [
  ["Juli", "Agustus", "September"],
  ["Oktober", "November", "Desember"],
  ["Januari", "Februari", "Maret"],
  ["April", "Mei", "Juni"],
];
const tahunDari = (b: string) => kalenderBulan(b)?.year ?? new Date().getFullYear();

export function periodeBulan(b: string): Periode {
  const k = kalenderBulan(b);
  return { jenis: "bulan", bulan: [b], kunci: `bulan:${tahunDari(b)}-${String((k?.month0 ?? 0) + 1).padStart(2, "0")}`, label: `${b} ${tahunDari(b)}` };
}
/** Triwulan ke-i tahun ajaran; hanya bulan yang sudah dibuka yang dimuat (triwulan berjalan = sebagian). */
export function periodeTriwulan(i: number): Periode {
  const bulan = TRIWULAN[i].filter((b) => isMonthOpen(b));
  const semua = TRIWULAN[i];
  return { jenis: "triwulan", bulan, kunci: `triwulan:${tahunDari(semua[0])}-${i + 1}`, label: `${semua[0]} – ${semua[2]} ${tahunDari(semua[2])}` };
}

export async function muatPeriode(p: Periode, onProgress?: (x: Progress & { bulan: string }) => void): Promise<NilaiBulan[]> {
  const out: NilaiBulan[] = [];
  // Berurutan (bukan paralel): kuota baca Google dipakai bersama guru yang sedang mengisi.
  for (let i = 0; i < p.bulan.length; i++) {
    const b = p.bulan[i];
    out.push(
      await muatNilaiBulan(b, (x) => onProgress?.({ selesai: i * 100 + Math.round((x.selesai / Math.max(x.total, 1)) * 100), total: p.bulan.length * 100, bulan: b }))
    );
  }
  return out;
}

/* ───────── narasi otomatis ───────── */

function satu(r: Rasio, satuan: string) {
  return `${r.p}% (${r.a} dari ${r.b} ${satuan})`;
}
/** "mencapai 33% pada bulan Juli (..), meningkat menjadi 52% pada bulan Agustus (..), dan 53% pada bulan September (..)". */
export function kalimatTren(data: { bulan: string; r: Rasio }[], satuan: string): string {
  const ada = data.filter((d) => d.r.p != null);
  if (!ada.length) return "belum dapat dinilai karena belum ada data yang lengkap";
  const bagian = ada.map((d, i) => {
    if (i === 0) return `mencapai ${satu(d.r, satuan)}${data.length > 1 ? ` pada bulan ${d.bulan}` : ""}`;
    const prev = ada[i - 1].r.p!;
    const kata = d.r.p! > prev ? "meningkat menjadi" : d.r.p! < prev ? "menurun menjadi" : "tetap";
    return `${kata} ${satu(d.r, satuan)} pada bulan ${d.bulan}`;
  });
  if (bagian.length === 1) return bagian[0];
  return `${bagian.slice(0, -1).join(", ")}, ${ada.length > 2 ? "dan " : "lalu "}${bagian[bagian.length - 1]}`;
}

const daftarKata = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} dan ${xs[xs.length - 1]}`);

/** Total target belum tercapai per kelompok bidang di seluruh periode, urut terbanyak. */
export function bidangBelumTerbanyak(bulan: NilaiBulan[]): [string, number[]][] {
  const kat = new Set(bulan.flatMap((b) => Object.keys(b.ringkas.belumPerBidang)));
  return [...kat]
    .map((k): [string, number[]] => [k, bulan.map((b) => b.ringkas.belumPerBidang[k] ?? 0)])
    .sort((a, b) => b[1].reduce((x, y) => x + y, 0) - a[1].reduce((x, y) => x + y, 0));
}

/** Santri yang belum mencapai target ziyadah/talaqqi di 2 bulan atau lebih dalam periode. */
export function santriBelumBerulang(bulan: NilaiBulan[]): { kelas: string; nama: string; bulan: string[] }[] {
  const peta = new Map<string, { kelas: string; nama: string; bulan: string[] }>();
  for (const b of bulan)
    for (const s of b.ringkas.santriBelumZ) {
      const k = `${s.kelas}|${s.nama}`;
      if (!peta.has(k)) peta.set(k, { ...s, bulan: [] });
      peta.get(k)!.bulan.push(b.bulan);
    }
  return [...peta.values()].filter((x) => x.bulan.length >= 2);
}

export type Narasi = { ringkasan: string[]; ilmu: string[]; quran: string[] };

export function susunNarasi(p: Periode, bulan: NilaiBulan[]): Narasi {
  const tren = (f: (b: NilaiBulan) => Rasio) => bulan.map((b) => ({ bulan: b.bulan, r: f(b) }));
  const tIlmu = tren((b) => b.ringkas.ilmu);
  const tZ = tren((b) => b.ringkas.ziyadah);
  const tM = tren((b) => b.ringkas.muroja);
  const tW = tren((b) => b.ringkas.wirid);
  const periodeTeks = p.jenis === "bulan" ? `bulan ${p.label}` : `bulan ${bulan[0]?.bulan} hingga ${bulan[bulan.length - 1]?.bulan} ${bulan[bulan.length - 1]?.year}`;
  const berjalan = bulan.some((b) => b.berjalan);
  const naik = (t: { r: Rasio }[]) => {
    const v = t.map((x) => x.r.p).filter((x): x is number => x != null);
    return v.length >= 2 && v[v.length - 1] > v[0];
  };

  const kosongIlmu = bulan.reduce((a, b) => a + b.ringkas.ilmu.kosong, 0);
  const tanpaTarget = bulan.reduce((a, b) => a + b.ringkas.tanpaTargetQuran, 0);
  const zTeks =
    tZ.every((x) => x.r.p == null) && tanpaTarget > 0
      ? "belum dapat dinilai karena angka target per santri (baris per pertemuan) belum diisi di RPB bagian Al-Qur'an"
      : kalimatTren(tZ, "santri");
  const terendah = [
    { nama: "bidang ilmu", p: tIlmu[tIlmu.length - 1]?.r.p },
    { nama: "ziyadah dan talaqqi Al-Qur'an", p: tZ[tZ.length - 1]?.r.p },
    { nama: "muroja'ah", p: tM[tM.length - 1]?.r.p },
    { nama: "wirid", p: tW[tW.length - 1]?.r.p },
  ].filter((x): x is { nama: string; p: number } => x.p != null && x.p < 75).sort((a, b) => a.p - b.p);

  const ringkasan = [
    `Alhamdulillah, berdasarkan hasil evaluasi kegiatan belajar dan mengajar (KBM) ${periodeTeks}, ketercapaian target pembelajaran yang disusun guru ${
      naik(tIlmu) || naik(tZ) ? "menunjukkan perkembangan" : "tercatat sebagai berikut"
    }, baik pada bidang ilmu maupun Al-Qur'an. Dari seluruh target ilmu yang direncanakan, ketercapaian ${kalimatTren(tIlmu, "target")}.${
      berjalan ? " Bulan yang masih berjalan dihitung sampai hari ini." : ""
    }`,
    `Ketercapaian target ziyadah dan talaqqi Al-Qur'an ${zTeks}. Pada target muroja'ah, ketercapaian ${kalimatTren(tM, "santri")}. Adapun target wirid ${kalimatTren(tW, "santri")}.`,
    [
      terendah.length
        ? `Dari hasil tersebut, beberapa target masih belum tercapai sesuai perencanaan, terutama pada ${daftarKata(terendah.slice(0, 2).map((x) => x.nama))}.`
        : "Dari hasil tersebut, sebagian besar target pembelajaran tercapai sesuai perencanaan.",
      kosongIlmu || tanpaTarget
        ? `Selain itu, kelengkapan pencatatan masih perlu diperhatikan (${[kosongIlmu ? `${kosongIlmu} target ilmu belum ditandai guru` : "", tanpaTarget ? `${tanpaTarget} catatan santri belum memiliki angka target Al-Qur'an` : ""].filter(Boolean).join("; ")}) agar evaluasi dapat menggambarkan perkembangan santri dengan lebih akurat.`
        : "",
      "Hasil evaluasi ini menjadi bahan untuk meninjau pelaksanaan rencana pembelajaran dan menentukan tindak lanjut pada periode berikutnya.",
    ]
      .filter(Boolean)
      .join(" "),
  ];

  const bidang = bidangBelumTerbanyak(bulan).filter(([, v]) => v.some((x) => x > 0));
  const ilmu = [
    `Berdasarkan rencana pembelajaran yang disusun guru, ketercapaian target ilmu ${kalimatTren(tIlmu, "target")}.`,
    bidang.length
      ? `Bidang yang paling banyak memiliki target belum tercapai adalah ${daftarKata(
          bidang.slice(0, 3).map(([k, v]) => `${k.toLowerCase()} (${bulan.length > 1 ? v.join(", ") : v[0]} target)`)
        )}. Rincian alasan dari guru tercantum pada lampiran checklist RPB dan Capaian Ilmu.`
      : "Belum ada target ilmu yang ditandai belum tercapai.",
    kosongIlmu ? `Sebanyak ${kosongIlmu} target belum ditandai guru sehingga dihitung sebagai tidak tercatat.` : "",
  ].filter(Boolean);

  const berulang = santriBelumBerulang(bulan);
  const semuaBulan = berulang.filter((x) => x.bulan.length === bulan.length && bulan.length > 2).length;
  const belumBulanIni = bulan[bulan.length - 1]?.ringkas.santriBelumZ.length ?? 0;
  const quran = [
    `Berdasarkan rencana pembelajaran Al-Qur'an yang disusun guru, ketercapaian target ziyadah dan talaqqi santri ${zTeks}.`,
    `Ketercapaian target muroja'ah ${kalimatTren(tM, "santri")}, dan target wirid ${kalimatTren(tW, "santri")}. Muroja'ah tercapai bila jumlah baris muroja'ah minimal sama dengan ziyadah bulan itu; wirid tercapai bila setiap pekan minimal 1 putaran.`,
    bulan.length > 1
      ? berulang.length
        ? `Sebanyak ${berulang.length} santri belum mencapai target ziyadah/talaqqi dua bulan atau lebih${semuaBulan ? `; ${semuaBulan} di antaranya belum tercapai di seluruh bulan` : ""}.`
        : "Tidak ada santri yang belum mencapai target ziyadah/talaqqi dua bulan berturut-turut."
      : belumBulanIni
        ? `Sebanyak ${belumBulanIni} santri belum mencapai target ziyadah/talaqqi bulan ini.`
        : "",
  ].filter(Boolean);

  return { ringkasan, ilmu, quran };
}

/* ───────── catatan kesimpulan (management) ───────── */

export async function bacaKesimpulan(kunci: string): Promise<string> {
  const { data, error } = await supabase.from("laporan_kbm_catatan").select("kesimpulan").eq("periode", kunci).maybeSingle();
  if (error) throw new Error(ramahkanGalat(error.message));
  return (data?.kesimpulan as string) ?? "";
}

export async function simpanKesimpulan(kunci: string, teks: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesi login habis, coba masuk lagi.");
  const { error } = await supabase.from("laporan_kbm_catatan").upsert({ periode: kunci, kesimpulan: teks, updated_by: user.id }, { onConflict: "periode" });
  if (error) throw new Error(ramahkanGalat(error.message));
  if ((await bacaKesimpulan(kunci)) !== teks) throw new Error("Kesimpulan belum tercatat di server. Tekan Simpan sekali lagi.");
}
