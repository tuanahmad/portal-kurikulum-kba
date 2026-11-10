import { supabase } from "./supabaseClient";
import { ramahkanGalat } from "./jaringan";
import { KELAS_LIST, capaianRoster, olahragaRoster } from "../data";
import { TINGKAT_LIST, KELOMPOK_LABEL, type OlahragaKelompok } from "./olahraga";
import { bacaAbsenSantriOlahragaRentang } from "./absenSantriOlahraga";

// Rekap kehadiran SANTRI per bulan, dihitung per anak (untuk diunduh sebagai PDF oleh management).
// Dua laporan terpisah: absen di kelas (pagi + siang) dan absen olahraga.

export const BULAN_NAMA = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const BULAN_SINGKAT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** `catatan` = keterangan tidak hadir (untuk kelas: sesi PAGI); `catatanSiang` hanya ada di laporan kelas (sesi SIANG). */
export type BarisKehadiran = { nama: string; hadir: number; tidak: number; catatan: string[]; catatanSiang?: string[] };
/** `seharusnya` = jumlah sesi/pertemuan yang SEHARUSNYA ada bulan itu (bukan yang diisi guru): persen dihitung terhadap angka ini. */
export type GrupKehadiran = { judul: string; baris: BarisKehadiran[]; seharusnya: number };

/** Hari efektif bulan itu: hari sekolah (hari-hari dalam pekan yang diberikan) dari tanggal 1 sampai hari ini (bulan
 *  berjalan) atau akhir bulan. Hari yang TIDAK ADA satu pun catatan absen dianggap libur dan tidak dihitung: aplikasi
 *  belum punya kalender libur. Kalau dikosongkan semua guru pada hari sekolah, hari itu ikut terhitung libur. */
export function hariEfektif(y: number, m0: number, hariSekolah: number[], tanggalAdaCatatan: Set<string>, hariIni = new Date()): number {
  const batas = new Date(y, m0 + 1, 0).getDate();
  let n = 0;
  for (let d = 1; d <= batas; d++) {
    const tgl = new Date(y, m0, d);
    if (tgl > hariIni) break;
    if (hariSekolah.includes(tgl.getDay()) && tanggalAdaCatatan.has(`${y}-${pad(m0 + 1)}-${pad(d)}`)) n++;
  }
  return n;
}

/** "November 2026", atau "November 2026 (sampai 10 Nov)" untuk bulan yang masih berjalan (total belum penuh sebulan). */
export function labelPeriode(y: number, m0: number, hariIni = new Date()): string {
  const dasar = `${BULAN_NAMA[m0]} ${y}`;
  return hariIni.getFullYear() === y && hariIni.getMonth() === m0 ? `${dasar} (sampai ${hariIni.getDate()} ${BULAN_SINGKAT[m0]})` : dasar;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const awalBulan = (y: number, m0: number) => `${y}-${pad(m0 + 1)}-01`;
export const akhirBulan = (y: number, m0: number) => `${y}-${pad(m0 + 1)}-${pad(new Date(y, m0 + 1, 0).getDate())}`;

function tglPendek(ymdStr: string): string {
  const [, m, d] = ymdStr.split("-").map(Number);
  return `${d} ${BULAN_SINGKAT[m - 1]}`;
}

/** Persen hadir terhadap jumlah SEHARUSNYA (maksimal 100%); "-" kalau bulan itu belum punya hari efektif. */
export const persenHadir = (b: BarisKehadiran, seharusnya: number) =>
  seharusnya <= 0 ? "-" : `${Math.min(100, Math.round((b.hadir / seharusnya) * 100))}%`;
/** Sesi/pertemuan yang belum diabsen sama sekali untuk santri itu. */
export const belumDiabsen = (b: BarisKehadiran, seharusnya: number) => Math.max(0, seharusnya - b.hadir - b.tidak);

/** Roster dulu (urutan resmi), lalu santri yang punya catatan tetapi sudah tidak ada di roster. */
function susunBaris(roster: string[], peta: Map<string, BarisKehadiran>, kosong: (nama: string) => BarisKehadiran): BarisKehadiran[] {
  const baris = roster.map((nama) => peta.get(nama) ?? kosong(nama));
  const dikenal = new Set(roster);
  for (const [nama, b] of peta) if (!dikenal.has(nama)) baris.push(b);
  return baris;
}

/* ───────── Absen di kelas ───────── */

type RowKelas = { kelas: string; tanggal: string; nama_santri: string; status_pagi: string; status_siang: string; keterangan_pagi: string | null; keterangan_siang: string | null };

async function bacaAbsenKelasBulan(dari: string, sampai: string): Promise<RowKelas[]> {
  const { data, error } = await supabase
    .from("absen_santri")
    .select("kelas, tanggal, nama_santri, status_pagi, status_siang, keterangan_pagi, keterangan_siang")
    .gte("tanggal", dari)
    .lte("tanggal", sampai)
    .order("tanggal");
  if (error) throw new Error(ramahkanGalat(error.message));
  return (data ?? []) as RowKelas[];
}

const kosongKelas = (nama: string): BarisKehadiran => ({ nama, hadir: 0, tidak: 0, catatan: [], catatanSiang: [] });

export async function kehadiranKelasBulan(y: number, m0: number): Promise<GrupKehadiran[]> {
  const rows = await bacaAbsenKelasBulan(awalBulan(y, m0), akhirBulan(y, m0));
  // Senin-Jumat, 2 sesi per hari (pagi + siang).
  const seharusnya = hariEfektif(y, m0, [1, 2, 3, 4, 5], new Set(rows.map((r) => r.tanggal))) * 2;
  return KELAS_LIST.map(({ name }) => {
    const peta = new Map<string, BarisKehadiran>();
    for (const r of rows.filter((x) => x.kelas === name)) {
      const b = peta.get(r.nama_santri) ?? kosongKelas(r.nama_santri);
      for (const [daftar, status, ket] of [
        [b.catatan, r.status_pagi, r.keterangan_pagi],
        [b.catatanSiang!, r.status_siang, r.keterangan_siang],
      ] as const) {
        if (status === "tidak_hadir") {
          b.tidak++;
          daftar.push(`${tglPendek(r.tanggal)}${ket?.trim() ? `: ${ket.trim()}` : ""}`);
        } else b.hadir++;
      }
      peta.set(r.nama_santri, b);
    }
    return { judul: name, baris: susunBaris(capaianRoster(name), peta, kosongKelas), seharusnya };
  });
}

/* ───────── Absen olahraga ───────── */

export async function kehadiranOlahragaBulan(y: number, m0: number): Promise<GrupKehadiran[]> {
  const rows = await bacaAbsenSantriOlahragaRentang(awalBulan(y, m0), akhirBulan(y, m0));
  rows.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  const kelompok: OlahragaKelompok[] = ["ikhwan", "akhwat"];
  // Hari sekolah diambil dari absen KELAS (diisi semua guru kelas), bukan dari guru olahraga: kalau guru olahraga belum
  // mengisi sama sekali, pertemuan yang seharusnya tetap terhitung. Catatan olahraga ikut ditambahkan (jaga-jaga).
  const hariSekolah = new Set<string>([...(await bacaAbsenKelasBulan(awalBulan(y, m0), akhirBulan(y, m0))).map((r) => r.tanggal), ...rows.map((r) => r.tanggal)]);
  return kelompok.flatMap((k) => {
    // Olahraga Senin-Rabu.
    const seharusnya = hariEfektif(y, m0, [1, 2, 3], hariSekolah);
    return TINGKAT_LIST.map((t) => {
      const peta = new Map<string, BarisKehadiran>();
      for (const r of rows.filter((x) => x.kelompok === k && x.tingkat === t)) {
        const b = peta.get(r.nama_santri) ?? { nama: r.nama_santri, hadir: 0, tidak: 0, catatan: [] };
        if (r.status === "tidak_hadir") {
          b.tidak++;
          b.catatan.push(`${tglPendek(r.tanggal)}${r.keterangan?.trim() ? `: ${r.keterangan.trim()}` : ""}`);
        } else b.hadir++;
        peta.set(r.nama_santri, b);
      }
      return { judul: `${KELOMPOK_LABEL[k]} · ${t}`, baris: susunBaris(olahragaRoster(t, k), peta, (nama) => ({ nama, hadir: 0, tidak: 0, catatan: [] })), seharusnya };
    });
  });
}
