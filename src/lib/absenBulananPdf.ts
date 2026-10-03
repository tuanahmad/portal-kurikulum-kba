import { labelHari } from "./absen";
import type { GuruRow, SesiCell } from "./absenBulanan";

const MERAH_BG: [number, number, number] = [253, 235, 234];
const MERAH_TX: [number, number, number] = [179, 38, 30];

/** Bikin PDF rekap absen guru per bulan DI BROWSER (jsPDF) lalu langsung diunduh ke perangkat yang
 *  nekan tombolnya -- gak lewat server. Library-nya di-import dinamis biar gak nambah ukuran
 *  bundle utama aplikasi (cuma dimuat pas tombol ditekan). Tabelnya lebar (banyak tanggal), jadi
 *  otomatis kebelah ke beberapa halaman ke samping dengan kolom Guru/Telat/Pulang awal diulang. */
export async function unduhPdfRekapBulanan(opts: { bulanLabel: string; days: Date[]; rows: GuruRow[]; fileName: string }) {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableMod.default;

  const { bulanLabel, days, rows } = opts;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFontSize(13);
  doc.text(`Rekap Absen Guru - ${bulanLabel}`, 10, 11);
  doc.setFontSize(7.5);
  doc.setTextColor(90);
  doc.text(
    "Merah = datang terlambat (pagi lewat 06.30, siang lewat 14.00) atau pulang lebih awal (pagi: KA 1A/1B sebelum 10.00, lainnya sebelum 10.30; siang sebelum 15.00). Dtg = datang, Plg = pulang.",
    10,
    15.5,
    { maxWidth: 277 }
  );
  doc.setTextColor(0);

  // Header 3 baris: tanggal / sesi / Dtg-Plg
  const head: any[][] = [
    [
      { content: "Guru", rowSpan: 3, styles: { valign: "bottom", halign: "left" } },
      { content: "Telat\ndatang", rowSpan: 3, styles: { valign: "bottom" } },
      { content: "Pulang\nawal", rowSpan: 3, styles: { valign: "bottom" } },
      ...days.map((d) => ({ content: `${labelHari(d).slice(0, 3)} ${d.getDate()}`, colSpan: 4 })),
    ],
    days.flatMap(() => [{ content: "Pagi", colSpan: 2 }, { content: "Siang", colSpan: 2 }]),
    days.flatMap(() => ["Dtg", "Plg", "Dtg", "Plg"]),
  ];

  const fmtSesi = (c: SesiCell): any[] => {
    if (c.kind === "status") {
      return [{ content: c.ket ? `${c.teks}\n${c.ket}` : c.teks, colSpan: 2, styles: { textColor: [110, 110, 110], fontSize: 5 } }];
    }
    return [
      {
        content: c.datang ?? "-",
        styles: c.datangMerah ? { fillColor: MERAH_BG, textColor: MERAH_TX, fontStyle: "bold" } : {},
      },
      {
        content: c.pulang ?? "-",
        styles: c.pulangMerah ? { fillColor: MERAH_BG, textColor: MERAH_TX, fontStyle: "bold" } : {},
      },
    ];
  };

  const body: any[][] = rows.map((r) => [
    { content: `${r.guru.nama}\n${r.guru.kelas}`, styles: { halign: "left" } },
    { content: String(r.telat), styles: r.telat > 0 ? { fillColor: MERAH_BG, textColor: MERAH_TX, fontStyle: "bold" } : {} },
    { content: String(r.awal), styles: r.awal > 0 ? { fillColor: MERAH_BG, textColor: MERAH_TX, fontStyle: "bold" } : {} },
    ...r.hari.flatMap((h) => [...fmtSesi(h.pagi), ...fmtSesi(h.siang)]),
  ]);

  autoTable(doc, {
    head,
    body,
    startY: 21,
    theme: "grid",
    styles: { fontSize: 6, cellPadding: 0.9, halign: "center", valign: "middle", lineColor: [220, 220, 220], lineWidth: 0.1, textColor: 20 },
    headStyles: { fillColor: [236, 243, 238], textColor: [60, 60, 60], fontStyle: "bold", fontSize: 6 },
    columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 11 }, 2: { cellWidth: 11 } },
    horizontalPageBreak: true,
    horizontalPageBreakRepeat: [0, 1, 2],
    margin: { left: 8, right: 8, top: 21, bottom: 10 },
    didDrawPage: () => {
      doc.setFontSize(7);
      doc.setTextColor(120);
      doc.text(`Portal Guru - Kuttab Budi Ashari  |  ${bulanLabel}`, 8, doc.internal.pageSize.getHeight() - 4);
      doc.setTextColor(0);
    },
  });

  doc.save(opts.fileName);
}
