import { NAMA_BULAN, ymd, labelHari, labelTanggal } from "./jurnal";
import { readJurnalRange } from "./jurnal";
import { readAbsenOlahragaRangeGabungan, KELOMPOK_LABEL, kelasJurnalOlahraga, type OlahragaKelompok } from "./olahraga";
import { STATUS_LABEL } from "./absen";

const KELOMPOK: OlahragaKelompok[] = ["ikhwan", "akhwat"];

/** Font bawaan jsPDF cuma Latin-1: rapikan tanda khusus, buang huruf di luar jangkauan (mis. Arab). */
function bersih(s: unknown): string {
  return String(s ?? "")
    .replace(/[‘’ʼʻ`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\n\t\x20-\x7E¡-ÿ]/g, "")
    .trim();
}

/** Hari olahraga (Senin-Rabu) dalam satu bulan. */
function hariOlahragaBulan(y: number, m0: number): Date[] {
  const out: Date[] = [];
  const d = new Date(y, m0, 1);
  while (d.getMonth() === m0) {
    if (d.getDay() >= 1 && d.getDay() <= 3) out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

const awalAkhir = (y: number, m0: number) => ({ dari: ymd(new Date(y, m0, 1)), sampai: ymd(new Date(y, m0 + 1, 0)) });

/** PDF absen GURU olahraga sebulan: satu tabel per kelompok (Ikhwan, Akhwat), baris = hari olahraga. */
export async function unduhAbsenGuruOlahragaBulanan(y: number, m0: number) {
  const { dari, sampai } = awalAkhir(y, m0);
  const [data, { jsPDF }, autoTableMod] = await Promise.all([
    readAbsenOlahragaRangeGabungan(dari, sampai),
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableMod.default;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const hari = hariOlahragaBulan(y, m0);
  const bulan = `${NAMA_BULAN[m0]} ${y}`;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Absen Guru Olahraga", doc.internal.pageSize.getWidth() / 2, 15, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(bulan, doc.internal.pageSize.getWidth() / 2, 20.5, { align: "center" });

  let startY = 27;
  for (const k of KELOMPOK) {
    const rows = hari.map((d) => {
      const e = data[ymd(d)]?.[k];
      const isi = !!e?.updated_at;
      return [`${labelHari(d)}, ${labelTanggal(d)}`, isi ? STATUS_LABEL[e!.status] : "Belum absen", isi ? bersih(e!.keterangan) : ""];
    });
    const hadir = hari.filter((d) => data[ymd(d)]?.[k]?.updated_at && data[ymd(d)]![k]!.status === "hadir").length;
    autoTable(doc, {
      startY,
      head: [[{ content: `${KELOMPOK_LABEL[k]}  (hadir ${hadir} dari ${hari.length} hari olahraga)`, colSpan: 3, styles: { halign: "left" } }], ["Hari", "Status", "Keterangan"]],
      body: rows,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 1.8 },
      headStyles: { fillColor: [28, 74, 51] },
      columnStyles: { 0: { cellWidth: 52 }, 1: { cellWidth: 30 } },
      margin: { left: 14, right: 14 },
    });
    startY = (doc as any).lastAutoTable.finalY + 8;
  }
  doc.save(`Absen Guru Olahraga ${NAMA_BULAN[m0]} ${y}.pdf`);
}

/** PDF jurnal guru olahraga sebulan (satu kelompok), memakai format PDF jurnal biasa tapi hanya hari Senin-Rabu. */
export async function unduhJurnalOlahragaBulanan(y: number, m0: number, kelompok: OlahragaKelompok, guruNama: string) {
  const { dari, sampai } = awalAkhir(y, m0);
  const entries = await readJurnalRange(dari, sampai, { kelas: kelasJurnalOlahraga(kelompok) });
  const { unduhPdfJurnalBulanan } = await import("./jurnalPdf");
  await unduhPdfJurnalBulanan({ guruNama, kelas: kelasJurnalOlahraga(kelompok), year: y, month0: m0, entries, hariKerja: [1, 2, 3] });
}
