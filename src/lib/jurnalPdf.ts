import { labelHari, labelTanggal, ymd, isEntryFilled, PERTANYAAN_JURNAL, NAMA_BULAN, type JurnalEntry } from "./jurnal";

// PDF jurnal harian SATU guru untuk SATU bulan (A4 portrait) -- dibuat DI BROWSER (jsPDF) dan langsung diunduh oleh
// management. Isi: jurnal saja (tiga pertanyaan per hari kerja, apa adanya). Hari kerja tanpa isian ditulis "tidak diisi".

type RGB = [number, number, number];
const HIJAU: RGB = [28, 74, 51];
const DAUN: RGB = [237, 243, 238];
const MUTED: RGB = [104, 112, 95];
const GARIS: RGB = [226, 223, 213];
const INK: RGB = [28, 46, 51];

/** Font bawaan jsPDF cuma Latin-1: ganti tanda kutip/strip khusus ke bentuk biasa, buang huruf di luar
 *  jangkauan (mis. Arab) dan beri penanda supaya tidak hilang diam-diam. */
function bersih(s: unknown): string {
  const asli = String(s ?? "");
  const b = asli
    .replace(/[‘’ʼʻ`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/[^\n\t\x20-\x7E¡-ÿ]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
  return /[֐-ࣿﭐ-﻿]/.test(asli) ? `${b} [teks Arab tidak tampil di PDF, lihat di aplikasi]`.trim() : b;
}

/** Semua hari kerja (Senin-Jumat) di bulan itu + tanggal akhir pekan yang kebetulan punya isian. */
function hariUntukBulan(year: number, month0: number, entries: Record<string, JurnalEntry>): Date[] {
  const out: Date[] = [];
  const d = new Date(year, month0, 1);
  while (d.getMonth() === month0) {
    const dow = d.getDay();
    const key = ymd(d);
    if ((dow >= 1 && dow <= 5) || isEntryFilled(entries[key])) out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function namaFilePdfJurnal(guruNama: string, year: number, month0: number): string {
  const aman = bersih(guruNama).replace(/[\\/:*?"<>|]/g, "").trim() || "Guru";
  return `Jurnal ${NAMA_BULAN[month0]} ${year} - ${aman}.pdf`;
}

export async function buatPdfJurnalBulanan(p: {
  guruNama: string;
  kelas: string;
  year: number;
  month0: number;
  entries: Record<string, JurnalEntry>;
}): Promise<{ doc: any; fileName: string }> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 16;
  const CW = W - 2 * M;
  let y = M;

  const setC = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const need = (h: number) => {
    if (y + h > H - 18) {
      doc.addPage();
      y = M;
    }
  };

  // ── Kepala dokumen ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  setC(HIJAU);
  doc.text("Jurnal Harian Guru", M, y + 5);
  y += 9;
  doc.setDrawColor(199, 154, 59);
  doc.setLineWidth(0.5);
  doc.line(M, y, M + 22, y);
  y += 6;

  const baris = (label: string, nilai: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    setC(MUTED);
    doc.text(label, M, y);
    doc.setFont("helvetica", "bold");
    setC(INK);
    doc.text(bersih(nilai), M + 30, y);
    y += 5.2;
  };
  baris("Nama guru", p.guruNama);
  baris("Kelas", p.kelas);
  baris("Bulan", `${NAMA_BULAN[p.month0]} ${p.year}`);
  y += 3;

  // ── Isi per hari ──
  const hari = hariUntukBulan(p.year, p.month0, p.entries);
  for (const d of hari) {
    const e = p.entries[ymd(d)];
    const judulHari = `${labelHari(d)}, ${labelTanggal(d)}`;

    if (!isEntryFilled(e)) {
      need(7);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      setC(MUTED);
      doc.text(`${judulHari}  -  tidak diisi`, M, y + 3.5);
      y += 7;
      continue;
    }

    // hitung tinggi blok supaya satu hari tidak terpotong di tengah kalau muat di satu halaman
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    const potongan = PERTANYAAN_JURNAL.map((q) => {
      const isi = bersih((e as JurnalEntry)[q.key]) || "-";
      return { label: q.label, baris: doc.splitTextToSize(isi, CW - 4) as string[] };
    });
    const tinggi = 9 + potongan.reduce((a, s) => a + 5 + s.baris.length * 4.6 + 2, 0);
    if (tinggi < H - 2 * M - 10) need(tinggi);
    else need(30);

    doc.setFillColor(DAUN[0], DAUN[1], DAUN[2]);
    doc.roundedRect(M, y, CW, 7, 1.2, 1.2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    setC(HIJAU);
    doc.text(judulHari, M + 3, y + 4.8);
    y += 10;

    for (const s of potongan) {
      need(10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      setC(HIJAU);
      const labelBaris = doc.splitTextToSize(bersih(s.label), CW - 4) as string[];
      for (const lb of labelBaris) {
        need(5);
        doc.text(lb, M + 2, y);
        y += 4.2;
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      setC(INK);
      for (const bs of s.baris) {
        need(5);
        doc.text(bs, M + 2, y);
        y += 4.6;
      }
      y += 2;
    }
    doc.setDrawColor(GARIS[0], GARIS[1], GARIS[2]);
    doc.setLineWidth(0.2);
    doc.line(M, y, M + CW, y);
    y += 4;
  }

  // ── Nomor halaman ──
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setC(MUTED);
    doc.text(bersih(`Portal Guru - Kuttab Budi Ashari  |  Jurnal ${NAMA_BULAN[p.month0]} ${p.year}  |  ${p.guruNama}`), M, H - 8);
    doc.text(`Halaman ${i} dari ${n}`, W - M, H - 8, { align: "right" });
  }

  return { doc, fileName: namaFilePdfJurnal(p.guruNama, p.year, p.month0) };
}

export async function unduhPdfJurnalBulanan(p: Parameters<typeof buatPdfJurnalBulanan>[0]) {
  const { doc, fileName } = await buatPdfJurnalBulanan(p);
  doc.save(fileName);
}
