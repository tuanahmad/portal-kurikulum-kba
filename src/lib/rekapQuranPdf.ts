import { studentIndexFor, type CapaianQuranData } from "./capaianQuranSheet";
import { kunciSurat, bagianPunyaSurat } from "./suratQuran";

// PDF rekap Capaian Al-Qur'an SATU kelas untuk SATU bulan (A4 portrait) -- dibuat DI BROWSER (jsPDF) dan langsung diunduh
// oleh management. Isi: tiap bagian (Talaqqi/Ziyadah/Murojaah/Wirid/...) -> tiap santri: total baris (atau putaran) dan
// rincian per surat. Angka diambil dari Google Sheet, nama surat dari catatan di aplikasi.

type RGB = [number, number, number];
const HIJAU: RGB = [28, 74, 51];
const DAUN: RGB = [237, 243, 238];
const MUTED: RGB = [104, 112, 95];
const GARIS: RGB = [226, 223, 213];
const INK: RGB = [28, 46, 51];

function bersih(s: unknown): string {
  return String(s ?? "")
    .replace(/[‘’ʼʻ`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/[^\n\t\x20-\x7E¡-ÿ]/g, "")
    .trim();
}

const angka = (v: string): number | null => {
  const t = v.trim().replace(",", ".");
  if (t === "" || !/^\d+(\.\d+)?$/.test(t)) return null;
  return parseFloat(t);
};
const rapi = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

export type RekapBaris = { nama: string; total: number; terisi: number; rincian: string };

/** Hitung rekap satu bagian untuk semua santri di `roster`. */
export function hitungRekapBagian(
  bagian: CapaianQuranData["sections"][number],
  roster: string[],
  surat: Record<string, string>
): RekapBaris[] {
  const satuan = bagian.type === "pekan" ? "putaran" : "baris";
  const punyaSurat = bagianPunyaSurat(bagian.name);
  return roster.map((nama, ri) => {
    const idx = studentIndexFor(bagian, roster, ri);
    const nilai = idx >= 0 ? bagian.students[idx]?.values ?? [] : [];
    const perSurat = new Map<string, { jumlah: number; kali: number }>();
    const kode = new Map<string, number>();
    let total = 0;
    let terisi = 0;
    for (let s = 1; s <= bagian.slotCount; s++) {
      const v = (nilai[s - 1] ?? "").trim();
      if (!v) continue;
      terisi++;
      const n = angka(v);
      if (n == null) kode.set(v.toUpperCase(), (kode.get(v.toUpperCase()) ?? 0) + 1);
      else total += n;
      if (punyaSurat) {
        const nm = surat[kunciSurat(bagian.name, s, nama)] || "(surat belum dipilih)";
        const cur = perSurat.get(nm) ?? { jumlah: 0, kali: 0 };
        cur.jumlah += n ?? 0;
        cur.kali += 1;
        perSurat.set(nm, cur);
      }
    }
    const bagianRincian: string[] = [];
    for (const [nm, c] of perSurat) bagianRincian.push(`${nm}: ${rapi(c.jumlah)} ${satuan} (${c.kali}x)`);
    for (const [k, c] of kode) bagianRincian.push(`${k}: ${c}x`);
    return { nama, total, terisi, rincian: bagianRincian.join("; ") };
  });
}

export function namaFilePdfRekapQuran(kelas: string, bulan: string): string {
  const aman = bersih(kelas).replace(/[\\/:*?"<>|]/g, "").trim() || "Kelas";
  return `Rekap Al-Quran ${bulan} - ${aman}.pdf`;
}

export async function unduhPdfRekapQuran(p: {
  kelas: string;
  bulan: string;
  roster: string[];
  data: CapaianQuranData;
  surat: Record<string, string>;
}) {
  const [{ jsPDF }, atMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = atMod.default;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  let y = M;
  const setC = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const lastY = () => (doc as any).lastAutoTable?.finalY ?? y;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  setC(HIJAU);
  doc.text("Rekap Capaian Al-Qur'an", M, y + 5);
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
    doc.text(bersih(nilai), M + 22, y);
    y += 5.2;
  };
  baris("Kelas", p.kelas);
  baris("Bulan", p.bulan);
  if (p.data.namaGuru) baris("Guru", p.data.namaGuru);
  y += 2;

  for (const bagian of p.data.sections) {
    const rekap = hitungRekapBagian(bagian, p.roster, p.surat);
    if (y > H - 50) {
      doc.addPage();
      y = M;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    setC(HIJAU);
    doc.text(bersih(bagian.name), M, y + 4);
    y += 6;
    const satuan = bagian.type === "pekan" ? "Putaran" : "Baris";
    autoTable(doc, {
      startY: y,
      head: [["Santri", `Total ${satuan.toLowerCase()}`, bagian.type === "pekan" ? "Pekan terisi" : "Pertemuan terisi", bagianPunyaSurat(bagian.name) ? "Rincian per surat" : "Keterangan"]],
      body: rekap.map((r) => [bersih(r.nama), rapi(r.total), String(r.terisi), bersih(r.rincian) || "-"]),
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 1.8, lineColor: GARIS, lineWidth: 0.1, textColor: INK, valign: "top" },
      headStyles: { fillColor: DAUN, textColor: MUTED, fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 42 }, 1: { cellWidth: 20, halign: "center" }, 2: { cellWidth: 24, halign: "center" } },
      margin: { left: M, right: M, bottom: 16 },
    });
    y = lastY() + 7;
  }

  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setC(MUTED);
    doc.text(bersih(`Portal Guru - Kuttab Budi Ashari  |  Rekap Al-Qur'an ${p.bulan}  |  ${p.kelas}`), M, H - 7);
    doc.text(`${i} / ${n}`, W - M, H - 7, { align: "right" });
  }
  doc.save(namaFilePdfRekapQuran(p.kelas, p.bulan));
}
