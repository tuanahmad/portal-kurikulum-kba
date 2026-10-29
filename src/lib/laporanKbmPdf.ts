import { C } from "../data";
import { W, JAM_AKTIF } from "./warnaLaporan";
import { refleksiTerisi } from "./laporanBulanan";
import { KELOMPOK_LABEL } from "./olahraga";
import { ATURAN } from "../components/LaporanKbm";
import { susunNarasi, bidangBelumTerbanyak, santriBelumBerulang, type NilaiBulan, type Periode, type Rasio, type Simbol, type GrafikKelas } from "./penilaianKbm";

// PDF laporan KBM (A4 portrait), dibuat di browser (jsPDF) lalu diunduh. Susunan mengikuti contoh Laporan Triwulan
// Juli-September 2026: sampul, daftar isi, 1 Ringkasan Umum, 2 Capaian Ilmu, 3 Capaian Al-Qur'an, 4 Kesimpulan dan
// Evaluasi (+ tanda tangan), lalu Lampiran: sampul, daftar isi, keterangan simbol, aturan penilaian, Bagian per bulan
// (A checklist ilmu, B checklist Al-Qur'an, C grafik pekanan, D refleksi, E data pendukung), Catatan Kualitas Data.

type RGB = [number, number, number];
const rgb = (hex: string): RGB => {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const HIJAU = rgb(C.green);
const DAUN = rgb(C.leaf);
const MUTED = rgb(C.muted);
const INK = rgb(C.ink);
const GARIS = rgb(C.line);
const OK = rgb(W.ok);
const BAD = rgb(W.bad);
const EMAS = rgb(W.emas);
const KREM = rgb(W.krem);
const BAD_BG = rgb(W.badBg);

/** Font bawaan jsPDF hanya Latin-1: tanda khusus diganti, huruf di luar jangkauan dibuang (Arab diberi penanda). */
function bersih(s: unknown): string {
  const asli = String(s ?? "");
  const t = asli
    .replace(/[‘’ʼʻ`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/✓/g, "(centang)")
    .replace(/✗/g, "(silang)")
    .replace(/○/g, "(lingkaran)")
    .replace(/ /g, " ")
    .replace(/[^\n\t\x20-\x7E¡-ÿ]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
  return /[֐-ࣿﭐ-﻿]/.test(asli) ? `${t} [teks Arab tidak tampil di PDF]`.trim() : t;
}

const teksRasio = (r: Rasio | null | undefined) => (!r || r.p == null ? "-" : `${r.a} dari ${r.b} (${r.p}%)`);
const isiPersen = (p: number | null): RGB | undefined => (p == null ? undefined : p >= 75 ? DAUN : p >= 40 ? KREM : BAD_BG);
const warnaPersen = (p: number | null): RGB => (p == null ? MUTED : p >= 75 ? OK : p >= 40 ? rgb(W.warn) : BAD);

type Sel = string | { teks: string; p: number | null } | { simbol: Simbol };

export async function unduhPdfLaporanKbm(periode: Periode, data: NilaiBulan[], kesimpulan: string) {
  const [{ jsPDF }, atMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = atMod.default;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 16;
  const CW = PW - 2 * M;
  const ATAS = 24;
  const BAWAH = PH - 16;
  let y = ATAS;

  const jenis = periode.jenis === "bulan" ? "Bulanan" : "Triwulan";
  const judulLap = `Laporan ${jenis} Kegiatan Belajar dan Mengajar`;
  const dibuat = new Date();
  const tglDibuat = dibuat.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  const bulanDibuat = dibuat.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const narasi = susunNarasi(periode, data);
  const kelasList = data[0]?.lap.kelas.map((k) => k.kelas) ?? [];

  // halaman mana yang "lampiran" (kepala halaman beda) dan mana yang sampul (tanpa kepala/kaki)
  const sampul = new Set<number>();
  const lampiranMulai = { hal: Infinity };
  const setC = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const lastY = () => (doc as any).lastAutoTable?.finalY ?? y;
  const halSekarang = () => doc.getNumberOfPages();
  const halBaru = () => {
    doc.addPage();
    y = ATAS;
  };
  const butuh = (h: number) => {
    if (y + h > BAWAH) halBaru();
  };

  function h1(t: string) {
    butuh(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    setC(HIJAU);
    doc.text(bersih(t), M, y + 5);
    y += 8;
    doc.setDrawColor(EMAS[0], EMAS[1], EMAS[2]);
    doc.setLineWidth(0.5);
    doc.line(M, y, M + 22, y);
    y += 5;
  }
  function h2(t: string) {
    butuh(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    setC(HIJAU);
    doc.text(bersih(t), M, y + 4);
    y += 7;
  }
  function h3(t: string) {
    butuh(10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    setC(INK);
    doc.text(bersih(t), M, y + 3.5);
    y += 6;
  }
  function para(t: string, opt?: { size?: number; color?: RGB; justify?: boolean }) {
    const size = opt?.size ?? 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    setC(opt?.color ?? INK);
    const lh = size * 0.45;
    for (const blok of bersih(t).split("\n")) {
      const lines = doc.splitTextToSize(blok || " ", CW) as string[];
      lines.forEach((ln, i) => {
        butuh(lh + 1);
        const akhir = i === lines.length - 1;
        doc.text(ln, M, y + lh, opt?.justify !== false && !akhir ? { maxWidth: CW, align: "justify" } : undefined);
        y += lh + 0.7;
      });
    }
    y += 2;
  }
  const catatan = (t: string) => para(t, { size: 7.5, color: MUTED, justify: false });

  /** Tabel; sel { simbol } digambar sebagai ikon, sel { teks, p } diwarnai menurut persen. */
  function tabel(judul: string | null, kepala: string[], baris: Sel[][], opt?: { lebar?: Record<number, number>; kecil?: boolean }) {
    if (judul) {
      butuh(14);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      setC(HIJAU);
      doc.text(bersih(judul), M, y + 3);
      y += 5;
    }
    const body = baris.map((r) =>
      r.map((c) => {
        if (typeof c === "string") return bersih(c);
        if ("simbol" in c) return { content: "", simbol: c.simbol } as any;
        return { content: bersih(c.teks), styles: { fillColor: isiPersen(c.p), textColor: warnaPersen(c.p), fontStyle: "bold", halign: "center" } } as any;
      })
    );
    autoTable(doc, {
      startY: y,
      head: [kepala.map(bersih)],
      body,
      theme: "grid",
      margin: { left: M, right: M, top: ATAS, bottom: PH - BAWAH },
      styles: { fontSize: opt?.kecil ? 7 : 8, cellPadding: 1.6, lineColor: GARIS, lineWidth: 0.1, textColor: INK, valign: "top", overflow: "linebreak" },
      headStyles: { fillColor: DAUN, textColor: HIJAU, fontStyle: "bold" },
      columnStyles: Object.fromEntries(Object.entries(opt?.lebar ?? {}).map(([k, w]) => [k, { cellWidth: w }])),
      didDrawCell: (h: any) => {
        const s = h.cell.raw?.simbol as Simbol | undefined;
        if (h.section !== "body" || !s) return;
        ikon(s, h.cell.x + h.cell.width / 2, h.cell.y + Math.min(h.cell.height, 7) / 2 + 0.3);
      },
    });
    y = lastY() + 4;
  }

  /** Ikon tanda: centang hijau, silang merah, lingkaran abu, strip abu. */
  function ikon(s: Simbol, cx: number, cy: number) {
    doc.setLineWidth(0.55);
    if (s === "ok") {
      doc.setDrawColor(OK[0], OK[1], OK[2]);
      doc.line(cx - 1.6, cy, cx - 0.5, cy + 1.2);
      doc.line(cx - 0.5, cy + 1.2, cx + 1.8, cy - 1.4);
    } else if (s === "belum") {
      doc.setDrawColor(BAD[0], BAD[1], BAD[2]);
      doc.line(cx - 1.3, cy - 1.3, cx + 1.3, cy + 1.3);
      doc.line(cx - 1.3, cy + 1.3, cx + 1.3, cy - 1.3);
    } else if (s === "kosong") {
      doc.setDrawColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.circle(cx, cy, 1.3, "S");
    } else {
      doc.setDrawColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.line(cx - 1.3, cy, cx + 1.3, cy);
    }
  }

  function halamanSampul(baris1: string, baris2: string) {
    sampul.add(halSekarang());
    doc.setFillColor(HIJAU[0], HIJAU[1], HIJAU[2]);
    doc.rect(0, 0, PW, PH, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.text(bersih(baris1), PW / 2, PH * 0.38, { align: "center" });
    doc.setFontSize(18);
    doc.text(bersih(baris2), PW / 2, PH * 0.38 + 11, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.text(bersih(periode.label), PW / 2, PH * 0.38 + 22, { align: "center" });
    doc.setDrawColor(EMAS[0], EMAS[1], EMAS[2]);
    doc.setLineWidth(0.8);
    doc.line(PW / 2 - 18, PH * 0.38 + 29, PW / 2 + 18, PH * 0.38 + 29);
    doc.setFontSize(10.5);
    doc.text("Disusun oleh: Tim Kurikulum", PW / 2, PH * 0.62, { align: "center" });
    doc.text("Mengetahui: Kepala Kuttab", PW / 2, PH * 0.62 + 6, { align: "center" });
    doc.setFontSize(9);
    doc.text(bersih(`Kuttab Budi Ashari · Evaluasi Kurikulum · ${bulanDibuat}`), PW / 2, PH - 22, { align: "center" });
  }

  /** Daftar isi: halaman disiapkan dulu, nomornya diisi setelah semua isi selesai digambar. */
  const isi: { teks: string; hal: number; tingkat: number; lampiran: boolean }[] = [];
  const catat = (teks: string, tingkat = 0, lampiran = false) => isi.push({ teks, hal: halSekarang(), tingkat, lampiran });

  /* ═════════ Laporan utama ═════════ */
  halamanSampul(`Laporan ${jenis}`, "Kegiatan Belajar dan Mengajar");
  halBaru();
  const halDaftarIsi = halSekarang();

  halBaru();
  catat("1. Ringkasan Umum");
  h1("1. Ringkasan Umum");
  narasi.ringkasan.forEach((p) => para(p));
  tabel(
    "Tabel 1. Ringkasan ketercapaian target",
    ["Ukuran", ...data.map((d) => d.bulan)],
    [
      ["Target ilmu tercapai", ...data.map((d) => ({ teks: teksRasio(d.ringkas.ilmu), p: d.ringkas.ilmu.p }))],
      ["Santri mencapai target ziyadah/talaqqi", ...data.map((d) => ({ teks: teksRasio(d.ringkas.ziyadah), p: d.ringkas.ziyadah.p }))],
      ["Santri mencapai target muroja'ah", ...data.map((d) => ({ teks: teksRasio(d.ringkas.muroja), p: d.ringkas.muroja.p }))],
      ["Santri mencapai target wirid", ...data.map((d) => ({ teks: teksRasio(d.ringkas.wirid), p: d.ringkas.wirid.p }))],
    ],
    { lebar: { 0: 62 } }
  );
  catatan(
    "Target ilmu dihitung dari seluruh target RPB di luar Al-Qur'an, termasuk target yang belum ditandai. Al-Qur'an dihitung dari santri yang datanya bisa dinilai; santri tanpa data atau tanpa angka target tidak dihitung."
  );
  grafikTren();

  halBaru();
  catat("2. Capaian Ilmu");
  h1("2. Capaian Ilmu");
  narasi.ilmu.forEach((p) => para(p));
  tabel(
    "Tabel 2. Rekap target ilmu",
    ["Bulan", "Direncanakan", "Tercapai", "Belum tercapai", "Tidak tercatat", "Ketercapaian"],
    data.map((d) => [d.bulan, String(d.ringkas.ilmu.rencana), String(d.ringkas.ilmu.a), String(d.ringkas.ilmu.belum), String(d.ringkas.ilmu.kosong), { teks: d.ringkas.ilmu.p == null ? "-" : `${d.ringkas.ilmu.p}%`, p: d.ringkas.ilmu.p }])
  );
  const bidang = bidangBelumTerbanyak(data).filter(([, v]) => v.some((x) => x > 0));
  if (bidang.length)
    tabel("Tabel 3. Jumlah target yang belum tercapai per bidang", ["Bidang", ...data.map((d) => d.bulan)], [
      ...bidang.map(([k, v]) => [k, ...v.map(String)]),
      ["Jumlah", ...data.map((d) => String(d.ringkas.ilmu.belum))],
    ]);
  tabel(
    "Tabel 4. Target ilmu tercapai per kelas",
    ["Kelas", ...data.map((d) => d.bulan)],
    kelasList.map((k) => [k, ...data.map((d) => ({ teks: d.ringkas.ilmuPerKelas[k] ? `${d.ringkas.ilmuPerKelas[k]!.a} dari ${d.ringkas.ilmuPerKelas[k]!.b}` : "-", p: d.ringkas.ilmuPerKelas[k]?.p ?? null }))])
  );
  catatan(`Hijau >= 75% tercapai, krem 40-74%, merah <40%. "-" berarti RPB belum berisi target ilmu.`);

  halBaru();
  catat("3. Capaian Al-Qur'an");
  h1("3. Capaian Al-Qur'an");
  narasi.quran.forEach((p) => para(p));
  tabel("Tabel 5. Rekap ketercapaian target Al-Qur'an (jumlah santri)", ["Kategori", ...data.map((d) => d.bulan)], [
    ["Ziyadah dan talaqqi", ...data.map((d) => ({ teks: teksRasio(d.ringkas.ziyadah), p: d.ringkas.ziyadah.p }))],
    ["Muroja'ah", ...data.map((d) => ({ teks: teksRasio(d.ringkas.muroja), p: d.ringkas.muroja.p }))],
    ["Wirid", ...data.map((d) => ({ teks: teksRasio(d.ringkas.wirid), p: d.ringkas.wirid.p }))],
  ]);
  catatan("Muroja'ah tercapai bila jumlah baris muroja'ah minimal sama dengan ziyadah bulan itu. Wirid tercapai bila setiap pekan minimal 1 putaran.");
  tabel(
    "Tabel 6. Santri yang mencapai target ziyadah/talaqqi per kelas",
    ["Kelas", ...data.map((d) => d.bulan)],
    kelasList.map((k) => [k, ...data.map((d) => ({ teks: d.ringkas.ziyadahPerKelas[k] ? `${d.ringkas.ziyadahPerKelas[k]!.a} dari ${d.ringkas.ziyadahPerKelas[k]!.b}` : "-", p: d.ringkas.ziyadahPerKelas[k]?.p ?? null }))])
  );
  catatan(`"-" berarti belum ada angka target di RPB atau datanya belum bisa dinilai.`);
  if (data.length > 1) {
    const berulang = santriBelumBerulang(data);
    if (berulang.length) tabel("Tabel 7. Santri yang belum mencapai target ziyadah/talaqqi dua bulan atau lebih", ["Kelas", "Santri", "Bulan belum tercapai"], berulang.map((s) => [s.kelas, s.nama, s.bulan.join(", ")]));
  } else if (data[0].ringkas.santriBelumZ.length) {
    const per = data[0].ringkas.santriBelumZ.reduce<Record<string, string[]>>((a, s) => ((a[s.kelas] ??= []).push(s.nama), a), {});
    tabel("Tabel 7. Santri yang belum mencapai target ziyadah/talaqqi", ["Kelas", "Santri"], Object.entries(per).map(([k, v]) => [k, v.join(", ")]), { lebar: { 0: 50 } });
  }

  halBaru();
  catat("4. Kesimpulan dan Evaluasi");
  h1("4. Kesimpulan dan Evaluasi");
  if (kesimpulan.trim()) para(kesimpulan, { justify: false });
  else catatan("Kesimpulan dan evaluasi belum diisi tim kurikulum.");
  butuh(40);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setC(INK);
  doc.text(bersih(tglDibuat), PW - M, y, { align: "right" });
  y += 7;
  doc.text("Disusun oleh,", M + 25, y, { align: "center" });
  doc.text("Mengetahui,", PW - M - 25, y, { align: "center" });
  doc.text("Kepala Kuttab", PW - M - 25, y + 5, { align: "center" });
  y += 26;
  doc.text("Tim Kurikulum", M + 25, y, { align: "center" });
  doc.text("(.......................................)", PW - M - 25, y, { align: "center" });
  y += 8;

  /* ═════════ Lampiran ═════════ */
  halBaru();
  lampiranMulai.hal = halSekarang();
  halamanSampul(`Lampiran Laporan ${jenis}`, "Kegiatan Belajar dan Mengajar");
  halBaru();
  const halDaftarLampiran = halSekarang();
  // keterangan simbol di halaman daftar isi lampiran (di bawah daftarnya) digambar belakangan

  halBaru();
  catat("Aturan Penilaian", 0, true);
  h1("Aturan Penilaian");
  ATURAN.forEach(([j, t], i) => para(`${i + 1}. ${j}. ${t}`, { size: 8.5, justify: false }));

  const romawi = ["I", "II", "III", "IV"];
  data.forEach((d, i) => {
    const rm = romawi[i] ?? String(i + 1);
    halBaru();
    catat(`Bagian ${rm} · ${d.bulan} ${d.year}`, 0, true);
    h1(`Bagian ${rm} · ${d.bulan} ${d.year}${d.berjalan ? " (bulan berjalan)" : ""}`);

    catat(`${rm}.A Checklist RPB dan Capaian Ilmu`, 1, true);
    h2(`${rm}.A Checklist RPB dan Capaian Ilmu`);
    for (const k of d.ilmu) {
      h3(`${k.kelas}${k.guru ? ` — ${k.guru}` : ""}`);
      if (!k.items.length) catatan(k.adaRpb ? "RPB belum berisi target ilmu." : "RPB belum bisa dibaca.");
      else tabel(null, ["No", "Bidang", "Target RPB", "Checklist", "Keterangan"], k.items.map((it, n) => [String(n + 1), it.bidang, it.target, { simbol: it.simbol }, it.ket]), { lebar: { 0: 8, 1: 28, 2: 55, 3: 17 } });
    }

    halBaru();
    catat(`${rm}.B Checklist Capaian Al-Qur'an per Santri`, 1, true);
    h2(`${rm}.B Checklist Capaian Al-Qur'an per Santri`);
    for (const k of d.quran) {
      h3(`${k.kelas}${k.guru ? ` — ${k.guru}` : ""} · ${k.pertemuan} pertemuan`);
      if (!k.items.length) catatan(k.adaData ? "Belum ada bagian ziyadah/talaqqi, muroja'ah, atau wirid." : "Capaian Al-Qur'an belum diisi.");
      else tabel(null, ["Santri", "Kategori", "Target", "Capaian", "Checklist", "Keterangan"], k.items.map((it) => [it.nama, it.label, it.target, it.capaian, { simbol: it.simbol }, it.ket]), { lebar: { 0: 32, 1: 18, 2: 34, 3: 38, 4: 17 }, kecil: true });
    }

    halBaru();
    catat(`${rm}.C Grafik Al-Qur'an Pekanan`, 1, true);
    h2(`${rm}.C Grafik Al-Qur'an Pekanan`);
    catatan("Setiap kotak satu santri; batang = baris per pekan. Hijau: ziyadah/talaqqi; emas: muroja'ah.");
    if (!d.grafik.length) catatan("Belum ada data pekanan.");
    d.grafik.forEach((g) => grafikPekanan(g));

    halBaru();
    catat(`${rm}.D Refleksi Guru`, 1, true);
    h2(`${rm}.D Refleksi Guru`);
    const terisi = d.lap.kelas.filter((k) => refleksiTerisi(k.refleksi));
    if (!terisi.length) catatan("Lembar Refleksi Bulanan Guru bulan ini belum diisi.");
    for (const k of terisi) {
      const r = k.refleksi!;
      const v = (s?: string) => bersih((s ?? "").trim()) || "-";
      h3(`${k.kelas}${k.guru ? ` — ${k.guru}` : ""}`);
      tabel(null, ["Bagian", "Isi"], [
        ["Capaian target", v(r.capaianTarget.map((c) => (c[3] ?? "").trim()).filter(Boolean).join(" "))],
        ["Strategi paling berhasil", v(r.keberhasilan[0])],
        ["Faktor keberhasilan", v(r.keberhasilan[1])],
        ["Yang paling disyukuri", v(r.refleksiGuru[0])],
        ["Kesalahan yang tidak ingin diulang", v(r.refleksiGuru[1])],
        ["Kemampuan yang akan ditingkatkan", v(r.refleksiGuru[2])],
      ], { lebar: { 0: 52 }, kecil: true });
      const kendala = r.kendala.filter((x) => x.some((c) => (c ?? "").trim()));
      if (kendala.length) tabel(null, ["Kendala", "Dampak", "Penyebab"], kendala.map((x) => x.slice(0, 3).map((c) => c ?? "")), { kecil: true });
      const rencana = r.rencanaPerbaikan.filter((x) => x.some((c) => (c ?? "").trim()));
      if (rencana.length) tabel(null, ["Rencana perbaikan", "Solusi", "Target waktu"], rencana.map((x) => x.slice(0, 3).map((c) => c ?? "")), { kecil: true });
      const murid = r.perkembanganMurid.filter((x) => (x[0] ?? "").trim() && x.slice(1).some((c) => (c ?? "").trim()));
      if (murid.length) tabel(null, ["Murid", "Perkembangan positif", "Tantangan", "Rencana pendampingan"], murid.map((x) => x.slice(0, 4).map((c) => c ?? "")), { kecil: true, lebar: { 0: 28 } });
    }

    halBaru();
    catat(`${rm}.E Data Pendukung`, 1, true);
    h2(`${rm}.E Data Pendukung`);
    const persen = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
    tabel("Kelengkapan pengisian per kelas", ["Kelas", "Jurnal (hari)", "Absen santri", "Tasmi'"], d.lap.kelas.map((k) => [
      k.kelas,
      { teks: `${k.jurnal.terisi}/${k.jurnal.total}`, p: persen(k.jurnal.terisi, k.jurnal.total) },
      k.absenSantri ? `${persen(k.absenSantri.hadir, k.absenSantri.total)}% hadir` : "-",
      String(k.tasmi.length),
    ]));
    tabel("Kehadiran dan kedisiplinan guru (per sesi)", ["Guru", "Hadir", "Izin", "Sakit", "Cuti", ...(JAM_AKTIF ? ["Telat", "Pulang awal"] : []), "% hadir"], d.lap.guruSummary.map((g) => [
      `${g.guru.nama} (${g.guru.kelas})`, String(g.hadir), String(g.izin), String(g.sakit), String(g.cuti),
      ...(JAM_AKTIF ? [String(g.telat), String(g.awal)] : []),
      { teks: g.persenHadir == null ? "-" : `${g.persenHadir}%`, p: g.persenHadir },
    ]), { lebar: { 0: 58 } });
    const tasmi = d.lap.kelas.flatMap((k) => k.tasmi.map((t) => [t.tanggal, k.kelas, t.nama_santri, t.juz || "-", String(t.jumlah_kesalahan)]));
    if (tasmi.length) tabel("Tasmi' bulan ini", ["Tanggal", "Kelas", "Santri", "Juz", "Salah"], tasmi);
    tabel("Olahraga", ["Bagian", "Isi"], [
      ...d.lap.olahraga.evaluasi.map((e) => [`Evaluasi ${e.tingkat}`, { teks: `${e.terisi}/${e.total} santri`, p: persen(e.terisi, e.total) }] as Sel[]),
      ...d.lap.olahraga.rencana.map((r) => [`Rencana ${KELOMPOK_LABEL[r.kelompok]} ${r.tingkat}`, r.entry ? "Terisi" : "Belum"]),
      ...d.lap.olahraga.absen.map((a) => [`Kehadiran guru ${KELOMPOK_LABEL[a.kelompok]}`, `hadir ${a.hadir}, izin ${a.izin}, sakit ${a.sakit}, cuti ${a.cuti}`]),
    ], { lebar: { 0: 62 } });
  });

  halBaru();
  catat(`Bagian ${romawi[data.length] ?? ""} · Catatan Kualitas Data`.replace("  ", " "), 0, true);
  h1(`Bagian ${romawi[data.length] ?? ""} · Catatan Kualitas Data`);
  const kual = data.flatMap((d) => d.kualitas.map((q) => [d.bulan, q.kelas, q.masalah, q.usulan]));
  if (kual.length) tabel(null, ["Bulan", "Kelas", "Masalah", "Usulan perbaikan"], kual, { lebar: { 0: 20, 1: 32 } });
  else catatan("Tidak ada catatan.");

  /* ═════════ daftar isi (diisi setelah nomor halaman diketahui) ═════════ */
  function tulisDaftar(hal: number, judul: string, lampiran: boolean) {
    doc.setPage(hal);
    y = ATAS;
    h1(judul);
    for (const e of isi.filter((x) => x.lampiran === lampiran)) {
      const nomor = lampiran ? e.hal - lampiranMulai.hal + 1 : e.hal;
      doc.setFont("helvetica", e.tingkat ? "normal" : "bold");
      doc.setFontSize(e.tingkat ? 9 : 10);
      setC(INK);
      const x = M + e.tingkat * 6;
      doc.text(bersih(e.teks), x, y + 4);
      doc.text(String(nomor), PW - M, y + 4, { align: "right" });
      const lebarTeks = doc.getTextWidth(bersih(e.teks));
      doc.setDrawColor(GARIS[0], GARIS[1], GARIS[2]);
      doc.setLineDashPattern([0.4, 1.2], 0);
      doc.line(x + lebarTeks + 2, y + 3.6, PW - M - 8, y + 3.6);
      doc.setLineDashPattern([], 0);
      y += e.tingkat ? 6 : 7;
    }
  }
  tulisDaftar(halDaftarIsi, "Daftar Isi", false);
  y += 4;
  para(
    "Bagian akhir dokumen ini memuat Lampiran, berisi checklist per kelas dan per santri, grafik pekanan Al-Qur'an, refleksi guru, data pendukung, aturan penilaian, dan catatan kualitas data.",
    { size: 9, color: MUTED, justify: false }
  );
  tulisDaftar(halDaftarLampiran, "Daftar Isi Lampiran", true);
  y += 6;
  h2("Keterangan simbol");
  const simbol: [Simbol, string][] = [
    ["ok", "Sesuai atau melebihi target RPB."],
    ["belum", "Belum sampai target, atau materi yang tercatat berbeda."],
    ["kosong", "Tidak tercatat / belum ditandai, belum bisa dinilai."],
    ["tanpa", "RPB tidak mencantumkan target; capaian hanya dicatat."],
  ];
  for (const [s, t] of simbol) {
    ikon(s, M + 3, y + 2.6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setC(INK);
    doc.text(bersih(t), M + 9, y + 3.6);
    y += 6.5;
  }

  /* ═════════ kepala & kaki halaman ═════════ */
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    if (sampul.has(i)) continue;
    doc.setPage(i);
    const lamp = i > lampiranMulai.hal;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setC(HIJAU);
    doc.text(bersih(lamp ? `Lampiran Laporan ${jenis} KBM` : judulLap), M, 11);
    doc.setFont("helvetica", "normal");
    setC(MUTED);
    doc.text(bersih(periode.label), M, 15);
    doc.setDrawColor(GARIS[0], GARIS[1], GARIS[2]);
    doc.setLineWidth(0.2);
    doc.line(M, 17.5, PW - M, 17.5);
    doc.setFontSize(7.5);
    doc.text("Kuttab Budi Ashari · Evaluasi Kurikulum".replace("·", "-"), M, PH - 8);
    doc.text(`Halaman ${lamp ? i - lampiranMulai.hal + 1 : i}`, PW - M, PH - 8, { align: "right" });
  }

  const aman = periode.label.replace(/[\\/:*?"<>|–]/g, "-");
  doc.save(`Laporan ${jenis} KBM ${aman}.pdf`);

  /* ═════════ gambar ═════════ */
  function grafikTren() {
    const seri: [string, (d: NilaiBulan) => number | null, RGB][] = [
      ["Ilmu", (d) => d.ringkas.ilmu.p, HIJAU],
      ["Ziyadah/talaqqi", (d) => d.ringkas.ziyadah.p, OK],
      ["Muroja'ah", (d) => d.ringkas.muroja.p, EMAS],
      ["Wirid", (d) => d.ringkas.wirid.p, rgb(W.warn)],
    ];
    const tinggiBaris = 4.6;
    const tinggi = 10 + seri.length * (6 + data.length * tinggiBaris);
    butuh(tinggi + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    setC(HIJAU);
    doc.text(data.length > 1 ? "Grafik 1. Tren ketercapaian target" : "Grafik 1. Ketercapaian target", M, y + 3);
    y += 7;
    const x0 = M + 24;
    const lebar = CW - 24 - 14;
    for (const [nama, f, warna] of seri) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      setC(INK);
      doc.text(bersih(nama), M, y + 3);
      y += 4.5;
      for (const d of data) {
        const p = f(d);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        setC(MUTED);
        doc.text(bersih(d.bulan), M + 2, y + 3);
        doc.setFillColor(237, 235, 226);
        doc.rect(x0, y + 0.6, lebar, 3, "F");
        if (p) {
          doc.setFillColor(warna[0], warna[1], warna[2]);
          doc.rect(x0, y + 0.6, (lebar * p) / 100, 3, "F");
        }
        const wp = warnaPersen(p);
        doc.setFont("helvetica", "bold");
        setC(wp);
        doc.text(p == null ? "-" : `${p}%`, PW - M, y + 3, { align: "right" });
        y += tinggiBaris;
      }
      y += 1.5;
    }
    y += 3;
  }

  function grafikPekanan(g: GrafikKelas) {
    const kol = 3;
    const gap = 3;
    const lebar = (CW - gap * (kol - 1)) / kol;
    const tinggi = 30;
    const maks = Math.max(1, ...g.santri.flatMap((s) => [...s.z, ...s.m]));
    h3(`${g.kelas} · ${g.labelZ}`);
    for (let i = 0; i < g.santri.length; i += kol) {
      butuh(tinggi + 3);
      g.santri.slice(i, i + kol).forEach((s, j) => {
        const x = M + j * (lebar + gap);
        doc.setDrawColor(GARIS[0], GARIS[1], GARIS[2]);
        doc.setLineWidth(0.2);
        doc.roundedRect(x, y, lebar, tinggi, 1.5, 1.5, "S");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        setC(INK);
        doc.text(bersih(s.nama).slice(0, 34), x + 2, y + 4);
        const ax = x + 3;
        const ay = y + tinggi - 5;
        const aw = lebar - 6;
        const ah = tinggi - 12;
        const lp = aw / g.pekan;
        for (let w = 0; w < g.pekan; w++) {
          const ganda = s.m.length > 0;
          const bw = ganda ? lp * 0.32 : lp * 0.55;
          const bx = ax + w * lp + (lp - (ganda ? bw * 2 + 0.6 : bw)) / 2;
          const hz = (s.z[w] / maks) * ah;
          if (hz > 0) {
            doc.setFillColor(HIJAU[0], HIJAU[1], HIJAU[2]);
            doc.rect(bx, ay - hz, bw, hz, "F");
          }
          if (ganda) {
            const hm = (s.m[w] / maks) * ah;
            if (hm > 0) {
              doc.setFillColor(EMAS[0], EMAS[1], EMAS[2]);
              doc.rect(bx + bw + 0.6, ay - hm, bw, hm, "F");
            }
          }
          doc.setFont("helvetica", "normal");
          doc.setFontSize(5.5);
          setC(MUTED);
          doc.text(`P${w + 1}`, ax + w * lp + lp / 2, ay + 3, { align: "center" });
          if (s.z[w]) {
            setC(INK);
            doc.text(String(Math.round(s.z[w] * 10) / 10).replace(".", ","), ax + w * lp + lp / 2, ay - hz - 0.8, { align: "center" });
          }
        }
        doc.setDrawColor(GARIS[0], GARIS[1], GARIS[2]);
        doc.line(ax, ay, ax + aw, ay);
      });
      y += tinggi + 3;
    }
    y += 2;
  }
}
