import type { Laporan, KelasLaporan } from "./laporanBulanan";
import { quranTerisi, ilmuTerisi, rpbTerisi, refleksiTerisi } from "./laporanBulanan";
import { ilmuPerAnak, rpbTampil, persen } from "./laporanTampil";
import { KELOMPOK_LABEL } from "./olahraga";

// PDF laporan bulanan (A4 portrait) -- dibuat DI BROWSER (jsPDF) dan langsung diunduh ke perangkat yang
// menekan tombolnya. Isi sama dengan preview di layar: ringkasan dulu, lalu detail lengkap per kelas.

type RGB = [number, number, number];
const HIJAU: RGB = [28, 74, 51];
const DAUN: RGB = [237, 243, 238];
const MUTED: RGB = [104, 112, 95];
const GARIS: RGB = [226, 223, 213];
const OK: RGB = [29, 158, 117];
const WARN: RGB = [186, 117, 23];
const BAD: RGB = [179, 38, 30];
const BAD_BG: RGB = [253, 235, 234];

/** Font bawaan jsPDF cuma Latin-1: ganti tanda kutip/strip khusus ke bentuk biasa, buang huruf di luar
 *  jangkauan (mis. Arab) supaya tidak jadi karakter rusak. */
function bersih(s: unknown): string {
  const asli = String(s ?? "");
  const bersihnya = bersihDasar(asli);
  // Huruf Arab/non-Latin tidak bisa dicetak font bawaan PDF: jangan hilang diam-diam, beri penanda.
  return /[֐-ࣿﭐ-﻿]/.test(asli) ? `${bersihnya} [teks Arab tidak tampil di PDF, lihat di aplikasi]`.trim() : bersihnya;
}

function bersihDasar(s: string): string {
  return s
    .replace(/[‘’ʼʻ`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/[^\n\t\x20-\x7E¡-ÿ]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export async function unduhPdfLaporan(lap: Laporan) {
  const [{ jsPDF }, atMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = atMod.default;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const CW = W - 2 * M;
  let y = M;

  const judulLap = `Laporan ${lap.bulan} ${lap.year}`;
  const tglDimuat = lap.dimuat.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  const lastY = () => (doc as any).lastAutoTable?.finalY ?? y;
  const need = (h: number) => {
    if (y + h > H - 16) {
      doc.addPage();
      y = M;
    }
  };
  const setC = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);

  function h1(t: string) {
    need(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    setC(HIJAU);
    doc.text(bersih(t), M, y + 5);
    y += 9;
    doc.setDrawColor(199, 154, 59);
    doc.setLineWidth(0.5);
    doc.line(M, y, M + 22, y);
    y += 5;
  }
  function h2(t: string) {
    need(10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    setC(HIJAU);
    doc.text(bersih(t), M, y + 4);
    y += 7;
  }
  function h3(t: string) {
    need(10);
    y += 1.5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setC([34, 48, 31]);
    doc.text(bersih(t), M, y + 3);
    y += 5;
  }
  function para(t: string, opt?: { size?: number; color?: RGB; bold?: boolean; indent?: number }) {
    const size = opt?.size ?? 9;
    const ind = opt?.indent ?? 0;
    doc.setFont("helvetica", opt?.bold ? "bold" : "normal");
    doc.setFontSize(size);
    setC(opt?.color ?? [34, 48, 31]);
    const lines = doc.splitTextToSize(bersih(t), CW - ind) as string[];
    const lh = size * 0.42;
    for (const ln of lines) {
      need(lh + 1);
      doc.text(ln, M + ind, y + lh);
      y += lh + 0.6;
    }
    y += 1;
  }
  function label(l: string, v: string) {
    if (!bersih(v)) return;
    need(8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setC(HIJAU);
    doc.text(bersih(l), M, y + 3);
    y += 4;
    para(v, { size: 9 });
  }
  const kosong = (t: string) => para(t, { size: 8.5, color: MUTED });

  /* ═════════ Halaman 1: sampul + ringkasan ═════════ */
  doc.setFillColor(HIJAU[0], HIJAU[1], HIJAU[2]);
  doc.rect(0, 0, W, 34, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text(bersih(judulLap), M, 17);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Kuttab Budi Ashari  |  ${lap.kelas.length} kelas  |  Data per ${bersih(tglDimuat)}`, M, 25);
  y = 42;

  // KPI
  const rata = (() => {
    const v = lap.guruSummary.map((g) => g.persenHadir).filter((x): x is number => x != null);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  })();
  const lengkap = lap.kelas.filter((k) => quranTerisi(k.quran) && ilmuTerisi(k.ilmu) && rpbTerisi(k.rpb) && refleksiTerisi(k.refleksi)).length;
  const jTer = lap.kelas.reduce((a, k) => a + k.jurnal.terisi, 0);
  const jTot = lap.kelas.reduce((a, k) => a + k.jurnal.total, 0);
  const pJ = persen(jTer, jTot);
  const tasmi = lap.kelas.reduce((a, k) => a + k.tasmi.length, 0);
  const warnaP = (p: number | null): RGB => (p == null ? MUTED : p >= 85 ? OK : p >= 60 ? WARN : BAD);

  const kpis: { v: string; l: string; c: RGB }[] = [
    { v: rata == null ? "-" : `${rata}%`, l: "Rata-rata kehadiran guru", c: warnaP(rata) },
    { v: `${lengkap}/${lap.kelas.length}`, l: "Kelas lengkap (Qur'an, Ilmu, RPB, Refleksi)", c: warnaP(persen(lengkap, lap.kelas.length)) },
    { v: pJ == null ? "-" : `${pJ}%`, l: "Hari jurnal terisi", c: warnaP(pJ) },
    { v: String(tasmi), l: "Tasmi' bulan ini", c: HIJAU },
  ];
  const kw = (CW - 3 * 4) / 4;
  kpis.forEach((k, i) => {
    const x = M + i * (kw + 4);
    doc.setFillColor(DAUN[0], DAUN[1], DAUN[2]);
    doc.roundedRect(x, y, kw, 24, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    setC(k.c);
    doc.text(k.v, x + 4, y + 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setC(MUTED);
    doc.text(doc.splitTextToSize(bersih(k.l), kw - 6) as string[], x + 4, y + 16);
  });
  y += 32;

  // Batang pengisian per kelas (jumlah dari 4 sumber terisi)
  h2("Kelengkapan pengisian per kelas");
  para("Setiap batang menunjukkan berapa dari 4 isian bulanan (Capaian Al-Qur'an, Capaian Ilmu, RPB, Refleksi) yang sudah ada isinya.", { size: 8, color: MUTED });
  for (const k of lap.kelas) {
    const n = [quranTerisi(k.quran), ilmuTerisi(k.ilmu), rpbTerisi(k.rpb), refleksiTerisi(k.refleksi)].filter(Boolean).length;
    need(7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    setC([34, 48, 31]);
    doc.text(bersih(k.kelas), M, y + 4);
    const bx = M + 48;
    const bw = CW - 48 - 16;
    doc.setFillColor(237, 235, 226);
    doc.roundedRect(bx, y + 1.2, bw, 3.6, 1, 1, "F");
    const col = n === 4 ? OK : n >= 2 ? WARN : BAD;
    if (n > 0) {
      doc.setFillColor(col[0], col[1], col[2]);
      doc.roundedRect(bx, y + 1.2, (bw * n) / 4, 3.6, 1, 1, "F");
    }
    doc.setFont("helvetica", "bold");
    setC(col);
    doc.text(`${n}/4`, bx + bw + 3, y + 4);
    y += 6.5;
  }
  y += 2;

  if (lap.perhatian.length) {
    h2("Catatan perhatian");
    for (const p of lap.perhatian) para("- " + p, { size: 8.5, indent: 1 });
  }

  /* ═════════ Tabel kelengkapan ═════════ */
  doc.addPage();
  y = M;
  h1("Kelengkapan pengisian");
  autoTable(doc, {
    startY: y,
    head: [["Kelas", "Qur'an", "Ilmu", "RPB", "Refleksi", "Jurnal", "Absen santri", "Tasmi'"]],
    body: lap.kelas.map((k) => {
      const as = k.absenSantri ? persen(k.absenSantri.hadir, k.absenSantri.total) : null;
      const tk = (ok: boolean) => ({ content: ok ? "Ya" : "-", styles: { textColor: ok ? OK : BAD, fontStyle: "bold" as const } });
      return [k.kelas, tk(quranTerisi(k.quran)), tk(ilmuTerisi(k.ilmu)), tk(rpbTerisi(k.rpb)), tk(refleksiTerisi(k.refleksi)), `${k.jurnal.terisi}/${k.jurnal.total}`, as == null ? "-" : `${as}%`, String(k.tasmi.length)];
    }),
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.8, halign: "center", lineColor: GARIS, lineWidth: 0.1 },
    headStyles: { fillColor: DAUN, textColor: MUTED, fontStyle: "bold" },
    columnStyles: { 0: { halign: "left", cellWidth: 40 } },
    margin: { left: M, right: M, bottom: 16 },
  });
  y = lastY() + 8;

  h1("Kehadiran dan kedisiplinan guru");
  para("Hitungan per sesi (pagi dan siang). Telat = datang melewati jam ideal + toleransi (10 menit sampai 14 Oktober, 5 menit mulai 15 Oktober); pulang awal = lebih dari 30 menit sebelum jam pulang.", { size: 8, color: MUTED });
  autoTable(doc, {
    startY: y,
    head: [["Guru", "Kelas", "Hadir", "Izin", "Sakit", "Cuti", "Telat", "Pulang awal", "% hadir"]],
    body: lap.guruSummary.map((g) => [
      bersih(g.guru.nama),
      g.guru.kelas,
      g.hadir,
      g.izin,
      g.sakit,
      g.cuti,
      { content: String(g.telat), styles: g.telat > 0 ? { fillColor: BAD_BG, textColor: BAD, fontStyle: "bold" as const } : {} },
      { content: String(g.awal), styles: g.awal > 0 ? { fillColor: BAD_BG, textColor: BAD, fontStyle: "bold" as const } : {} },
      g.persenHadir == null ? "-" : `${g.persenHadir}%`,
    ]),
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.6, halign: "center", lineColor: GARIS, lineWidth: 0.1 },
    headStyles: { fillColor: DAUN, textColor: MUTED, fontStyle: "bold" },
    columnStyles: { 0: { halign: "left" }, 1: { halign: "left" } },
    margin: { left: M, right: M, bottom: 16 },
  });
  y = lastY() + 8;

  /* ═════════ Per kelas ═════════ */
  for (const k of lap.kelas) {
    doc.addPage();
    y = M;
    h1(k.kelas);
    para(`Guru: ${k.guru || "-"}  |  ${lap.bulan} ${lap.year}`, { size: 9, color: MUTED });
    bagianQuran(k);
    bagianIlmu(k);
    bagianRpb(k);
    bagianRefleksi(k);
    bagianTasmi(k);
  }

  /* ═════════ Olahraga ═════════ */
  doc.addPage();
  y = M;
  h1("Olahraga");
  h2("Evaluasi anak terisi");
  autoTable(doc, {
    startY: y,
    head: [["Kelas", "Santri terisi (ikhwan + akhwat)"]],
    body: lap.olahraga.evaluasi.map((e) => [`Kuttab Awwal ${e.tingkat.replace("KA ", "")}`, `${e.terisi} dari ${e.total}`]),
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 1.8, lineColor: GARIS, lineWidth: 0.1 },
    headStyles: { fillColor: DAUN, textColor: MUTED, fontStyle: "bold" },
    margin: { left: M, right: M, bottom: 16 },
  });
  y = lastY() + 6;
  h2("Rencana kegiatan");
  for (const r of lap.olahraga.rencana) {
    h3(`${KELOMPOK_LABEL[r.kelompok]} - ${r.tingkat}`);
    if (!r.entry) {
      kosong("Belum diisi.");
      continue;
    }
    [r.entry.pekan1, r.entry.pekan2, r.entry.pekan3, r.entry.pekan4].forEach((t, i) => label(`Pekan ${i + 1}`, t));
    label("Target", r.entry.target.join(", "));
    label("Alat", r.entry.alat);
  }
  h2("Kehadiran guru olahraga (sesi)");
  autoTable(doc, {
    startY: y,
    head: [["Kelompok", "Hadir", "Izin", "Sakit", "Cuti"]],
    body: lap.olahraga.absen.map((a) => [KELOMPOK_LABEL[a.kelompok], a.hadir, a.izin, a.sakit, a.cuti]),
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 1.8, lineColor: GARIS, lineWidth: 0.1 },
    headStyles: { fillColor: DAUN, textColor: MUTED, fontStyle: "bold" },
    margin: { left: M, right: M, bottom: 16 },
  });
  y = lastY() + 4;

  /* ═════════ Footer di semua halaman ═════════ */
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setC(MUTED);
    doc.text(`Portal Guru - Kuttab Budi Ashari  |  ${bersih(judulLap)}`, M, H - 7);
    doc.text(`${i} / ${n}`, W - M, H - 7, { align: "right" });
  }

  doc.save(`Laporan-Bulanan-${lap.bulan}-${lap.year}.pdf`);

  /* ───────── bagian per kelas ───────── */

  function bagianQuran(k: KelasLaporan) {
    h2("Capaian Al-Qur'an");
    if (!k.quran) return kosong(k.err.quran ? `Belum bisa dibaca: ${k.err.quran}` : "Belum ada data.");
    para("Batang = total baris yang dibaca dalam sebulan. PT = persiapan tasmi', TS = tasmi' (dihitung dari kode yang ditulis guru). Kolom surat/juz belum ada isiannya dan sengaja dikosongkan.", { size: 7.5, color: MUTED });
    for (const sec of k.quran) {
      h3(sec.name);
      const pert = sec.type === "pertemuan";
      const maks = Math.max(1, ...sec.santri.map((s) => (pert ? s.total : s.terisi)));
      for (const s of sec.santri) {
        need(6.5);
        const nilai = pert ? s.total : s.terisi;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        setC([34, 48, 31]);
        doc.text(bersih(s.nama).slice(0, 34), M, y + 3.6);
        const bx = M + 52;
        const bw = 50;
        doc.setFillColor(237, 235, 226);
        doc.roundedRect(bx, y + 1, bw, 3.2, 0.8, 0.8, "F");
        if (nilai > 0) {
          doc.setFillColor(HIJAU[0], HIJAU[1], HIJAU[2]);
          doc.roundedRect(bx, y + 1, Math.max(1.5, (bw * nilai) / maks), 3.2, 0.8, 0.8, "F");
        }
        const ket = s.terisi === 0 ? "belum diisi" : pert ? `${s.total} baris, ${s.terisi} hari` : `${s.terisi}/${sec.slotCount} pekan`;
        const pts = s.pt > 0 || s.ts > 0 ? `  PT ${s.pt} / TS ${s.ts}` : "";
        doc.setFont("helvetica", "bold");
        setC(HIJAU);
        doc.text(ket, bx + bw + 3, y + 3.6);
        doc.setFont("helvetica", "normal");
        setC(WARN);
        if (pts) doc.text(pts, bx + bw + 3 + doc.getTextWidth(ket) + 1, y + 3.6);
        setC(MUTED);
        doc.text("Surat/juz: -", W - M, y + 3.6, { align: "right" });
        y += 5.2;
      }
      y += 2;
    }
  }

  function bagianIlmu(k: KelasLaporan) {
    h2("Capaian Ilmu");
    if (!k.ilmu) return kosong(k.err.ilmu ? `Belum bisa dibaca: ${k.err.ilmu}` : "Belum ada data.");
    const anak = ilmuPerAnak(k.kelas, k.ilmu);
    if (!anak.length) return kosong("Belum ada isi.");
    for (const a of anak) {
      h3(a.nama);
      if (!a.items.length) {
        kosong("Belum diisi.");
        continue;
      }
      autoTable(doc, {
        startY: y,
        body: a.items.map((it) => [bersih(`${it.grup ? it.grup + " - " : ""}${it.label}`), bersih(it.value)]),
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 1.5, lineColor: GARIS, lineWidth: 0.1, valign: "top" },
        columnStyles: { 0: { cellWidth: 44, fontStyle: "bold", textColor: HIJAU, fillColor: DAUN } },
        margin: { left: M, right: M, bottom: 16 },
      });
      y = lastY() + 4;
    }
  }

  function bagianRpb(k: KelasLaporan) {
    h2("Rencana Pembelajaran Bulanan (RPB)");
    if (!k.rpb) return kosong(k.err.rpb ? `Belum bisa dibaca: ${k.err.rpb}` : "Belum ada data.");
    const { target, pekan } = rpbTampil(k.rpb);
    if (k.rpb.jumlahPertemuan) para(`Jumlah pertemuan: ${k.rpb.jumlahPertemuan}`, { size: 8.5, color: MUTED });
    if (!target.length && !pekan.length) return kosong("Belum ada isi.");
    if (target.length) {
      h3("Target per bidang");
      const body: any[][] = [];
      for (const g of target)
        g.rows.forEach((r, i) => body.push([i === 0 ? bersih(g.bidang) : "", bersih(r.subItem), bersih(r.target), bersih(r.indikator)]));
      autoTable(doc, {
        startY: y,
        head: [["Bidang", "Sub", "Target", "Indikator"]],
        body,
        theme: "grid",
        styles: { fontSize: 7.5, cellPadding: 1.4, lineColor: GARIS, lineWidth: 0.1, valign: "top" },
        headStyles: { fillColor: DAUN, textColor: MUTED, fontStyle: "bold" },
        columnStyles: { 0: { cellWidth: 28, fontStyle: "bold" } },
        margin: { left: M, right: M, bottom: 16 },
      });
      y = lastY() + 4;
    }
    if (pekan.length) {
      h3("Rencana per pekan");
      autoTable(doc, {
        startY: y,
        head: [["Pekan", "Bidang", "Sub ilmu", "Metode / kegiatan"]],
        body: pekan.map((r) => [bersih(r.pekan), bersih(r.bidang), bersih(r.subIlmu), bersih(r.metode)]),
        theme: "grid",
        styles: { fontSize: 7.5, cellPadding: 1.4, lineColor: GARIS, lineWidth: 0.1, valign: "top" },
        headStyles: { fillColor: DAUN, textColor: MUTED, fontStyle: "bold" },
        columnStyles: { 0: { cellWidth: 12, halign: "center" }, 1: { cellWidth: 30 }, 2: { cellWidth: 36 } },
        margin: { left: M, right: M, bottom: 16 },
      });
      y = lastY() + 4;
    }
  }

  function bagianRefleksi(k: KelasLaporan) {
    h2("Refleksi guru");
    if (!k.refleksi) return kosong(k.err.refleksi ? `Belum bisa dibaca: ${k.err.refleksi}` : "Belum ada data.");
    const r = k.refleksi;
    if (!refleksiTerisi(r)) return kosong("Belum diisi.");
    const ada = (x: string) => (x ?? "").trim() !== "";
    r.capaianTarget.forEach((c, i) => {
      const st = c[0] === "TRUE" ? "Ya" : c[1] === "TRUE" ? "Sebagian" : c[2] === "TRUE" ? "Belum" : "";
      const ket = (c[3] ?? "").trim();
      if (st || ket) label(`Capaian target ${i + 1}`, `${st}${ket ? " - " + ket : ""}`);
    });
    r.keberhasilan.forEach((t, i) => ada(t) && label(`Keberhasilan ${i + 1}`, t));
    const kendalaL = ["Kendala", "Dampak", "Penyebab"];
    r.kendala.forEach((row, i) => {
      if (!row.some(ada)) return;
      h3(`Kendala ${i + 1}`);
      row.forEach((x, j) => ada(x) && label(kendalaL[j], x));
    });
    if (r.evaluasiDiri.some(ada)) label("Evaluasi diri (skor butir 1-8)", r.evaluasiDiri.map((x, i) => `${i + 1}: ${x || "-"}`).join("    "));
    r.refleksiGuru.forEach((t, i) => ada(t) && label(`Refleksi ${i + 1}`, t));
    const rencanaL = ["Permasalahan", "Solusi", "Target waktu"];
    r.rencanaPerbaikan.forEach((row, i) => {
      if (!row.some(ada)) return;
      h3(`Rencana perbaikan ${i + 1}`);
      row.forEach((x, j) => ada(x) && label(rencanaL[j], x));
    });
    const muridL = ["Perkembangan", "Tantangan", "Rencana pendampingan"];
    for (const row of r.perkembanganMurid.filter((rw) => ada(rw[0]))) {
      h3(`Perkembangan murid: ${bersih(row[0])}`);
      if (![1, 2, 3].some((j) => ada(row[j]))) kosong("Belum diisi.");
      muridL.forEach((l, j) => ada(row[j + 1]) && label(l, row[j + 1]));
    }
  }

  function bagianTasmi(k: KelasLaporan) {
    h2("Tasmi' bulan ini");
    if (!k.tasmi.length) return kosong("Belum ada tasmi' di bulan ini.");
    autoTable(doc, {
      startY: y,
      head: [["Tanggal", "Santri", "Juz", "Penyimak", "Salah"]],
      body: k.tasmi.map((t) => [t.tanggal, bersih(t.nama_santri), bersih(t.juz) || "-", bersih(t.nama_guru) || "-", t.jumlah_kesalahan]),
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 1.5, lineColor: GARIS, lineWidth: 0.1 },
      headStyles: { fillColor: DAUN, textColor: MUTED, fontStyle: "bold" },
      margin: { left: M, right: M, bottom: 16 },
    });
    y = lastY() + 4;
  }
}
