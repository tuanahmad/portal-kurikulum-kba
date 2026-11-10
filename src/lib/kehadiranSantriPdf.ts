import { persenHadir, belumDiabsen, labelPeriode, kehadiranKelasBulan, kehadiranOlahragaBulan, BULAN_NAMA, type GrupKehadiran } from "./kehadiranSantri";

const CATATAN_KELAS =
  "Dihitung per sesi (pagi dan siang, Senin-Jumat). Persen = sesi hadir dibagi total sesi bulan itu, bukan yang diisi guru. Hari tanpa catatan absen sama sekali dianggap libur. Belum diabsen = total dikurangi hadir dan tidak hadir.";
const CATATAN_OLAHRAGA =
  "Dihitung per pertemuan olahraga (Senin-Rabu). Persen = pertemuan hadir dibagi total pertemuan bulan itu, bukan yang diisi guru. Hari tanpa absen kelas sama sekali dianggap libur. Belum diabsen = total dikurangi hadir dan tidak hadir.";

/** Dipanggil tombol "Unduh PDF": "gabungan" = bagian kelas lalu bagian olahraga dalam satu file; "olahraga" = olahraga saja. */
export async function unduhKehadiranBulanan(y: number, m0: number, jenis: "gabungan" | "olahraga") {
  const bagian: BagianKehadiran[] = [];
  if (jenis === "gabungan") {
    bagian.push({ judul: "Kehadiran Santri di Kelas", catatanSesi: CATATAN_KELAS, satuan: "sesi", grup: await kehadiranKelasBulan(y, m0) });
  }
  bagian.push({ judul: "Kehadiran Santri di Olahraga", catatanSesi: CATATAN_OLAHRAGA, satuan: "pertemuan", grup: await kehadiranOlahragaBulan(y, m0) });
  await unduhPdfKehadiranSantri({
    bulanLabel: labelPeriode(y, m0),
    bagian,
    fileName: `Kehadiran-Santri${jenis === "gabungan" ? "" : "-Olahraga"}-${BULAN_NAMA[m0]}-${y}.pdf`,
  });
}

export type BagianKehadiran = {
  /** Judul bagian (di tengah halaman), mis. "Kehadiran Santri di Kelas". */
  judul: string;
  catatanSesi: string;
  satuan: "sesi" | "pertemuan";
  grup: GrupKehadiran[];
};

/** PDF kehadiran santri per bulan, dibuat DI BROWSER (jsPDF) lalu langsung diunduh -- sama seperti rekap absen guru.
 *  Terdiri dari satu atau lebih BAGIAN (mis. kelas lalu olahraga), tiap bagian mulai di halaman baru dengan judul di
 *  tengah. Satu tabel per kelas / kelompok, baris = santri: Hadir, Tidak hadir, Belum diabsen, persen, keterangan. */
export async function unduhPdfKehadiranSantri(opts: { bulanLabel: string; bagian: BagianKehadiran[]; fileName: string }) {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableMod.default;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const tengah = doc.internal.pageSize.getWidth() / 2;
  const daftar = (a?: string[]) => (a && a.length ? a.join("\n") : "-");

  opts.bagian.forEach((bg, idx) => {
    if (idx > 0) doc.addPage();

    // Judul di tengah + periode + catatan cara hitung.
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(bg.judul, tengah, 14, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(opts.bulanLabel, tengah, 20, { align: "center" });
    doc.setFontSize(8);
    doc.setTextColor(90);
    doc.text(bg.catatanSesi, tengah, 25, { align: "center", maxWidth: 185 });
    doc.setTextColor(0);

    let y = 36;
    for (const g of bg.grup) {
      if (doc.internal.pageSize.getHeight() - y < 40) {
        doc.addPage();
        y = 12;
      }
      // Laporan kelas punya dua sesi: keterangan pagi dan siang dipisah kolom, tiap tanggal satu baris.
      const duaSesi = g.baris.some((b) => b.catatanSiang !== undefined);
      const kolom = duaSesi ? 8 : 7;
      autoTable(doc, {
        startY: y,
        theme: "grid",
        head: [
          [{ content: `${g.judul}   |   total ${g.seharusnya} ${bg.satuan}`, colSpan: kolom, styles: { halign: "left", fillColor: [31, 79, 58], textColor: 255, fontSize: 9 } }],
          duaSesi
            ? ["No", "Nama santri", "Hadir", "Tidak hadir", "Belum diabsen", "Persen", "Ket. tidak hadir Pagi", "Ket. tidak hadir Siang"]
            : ["No", "Nama santri", "Hadir", "Tidak hadir", "Belum diabsen", "Persen", "Keterangan tidak hadir"],
        ],
        body: g.baris.map((b, i) => [
          String(i + 1),
          b.nama,
          String(b.hadir),
          { content: String(b.tidak), styles: b.tidak > 0 ? { fillColor: [253, 235, 234], textColor: [179, 38, 30], fontStyle: "bold" } : {} },
          { content: String(belumDiabsen(b, g.seharusnya)), styles: belumDiabsen(b, g.seharusnya) > 0 ? { textColor: [133, 79, 11] } : {} },
          persenHadir(b, g.seharusnya),
          daftar(b.catatan),
          ...(duaSesi ? [daftar(b.catatanSiang)] : []),
        ]),
        styles: { fontSize: 8, cellPadding: 1.4, valign: "middle", lineColor: [220, 220, 220], lineWidth: 0.1, textColor: 20 },
        headStyles: { fillColor: [236, 243, 238], textColor: [60, 60, 60], fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 9, halign: "center" },
          1: { cellWidth: duaSesi ? 38 : 48 },
          2: { cellWidth: 12, halign: "center" },
          3: { cellWidth: 16, halign: "center" },
          4: { cellWidth: 17, halign: "center" },
          5: { cellWidth: 14, halign: "center" },
          6: { cellWidth: "auto" },
          7: { cellWidth: "auto" },
        },
        margin: { left: 10, right: 10, top: 12, bottom: 12 },
        didDrawPage: () => {
          doc.setFontSize(7);
          doc.setTextColor(120);
          doc.text(`Portal Guru - Kuttab Budi Ashari  |  ${bg.judul}  |  ${opts.bulanLabel}`, 10, doc.internal.pageSize.getHeight() - 5);
          doc.setTextColor(0);
        },
      });
      y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? y) + 6;
    }
  });

  doc.save(opts.fileName);
}
