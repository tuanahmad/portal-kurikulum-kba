import { ymd, type AbsenBulanRow, type SesiEntry } from "./absen";
import { DATANG_PAGI, DATANG_SIANG, PULANG_SIANG, pulangPagiIdeal, telatDatang, pulangAwal } from "./absenAturan";

// Model rekap absen guru per bulan -- dipakai bareng sama tampilan tabel di layar DAN export PDF,
// biar aturan merah/putihnya cuma ada di 1 tempat.

export type Guru = { kelas: string; nama: string };

export type SesiCell =
  | { kind: "status"; teks: string; ket: string }
  | { kind: "jam"; datang: string | null; datangMerah: boolean; pulang: string | null; pulangMerah: boolean };

export type GuruRow = {
  guru: Guru;
  telat: number;
  awal: number;
  hari: { pagi: SesiCell; siang: SesiCell }[];
};

const STATUS_TEKS: Record<string, string> = { izin: "Izin", sakit: "Sakit", cuti: "Cuti" };

/** "06:14" / "06:14:00" -> "06.14"; kosong -> "-" (dipakai PDF) atau tampilan kasih "—". */
export function jamTeks(jam: string | null | undefined): string | null {
  const m = String(jam ?? "").match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}.${m[2]}` : null;
}

function sesiCell(s: SesiEntry | undefined, datangIdeal: number, pulangIdeal: number, tanggal: string): SesiCell {
  if (s && s.status !== "hadir") {
    return { kind: "status", teks: STATUS_TEKS[s.status] ?? s.status, ket: s.keterangan.trim() };
  }
  return {
    kind: "jam",
    datang: jamTeks(s?.jam_datang),
    datangMerah: telatDatang(s?.jam_datang, datangIdeal, tanggal),
    pulang: jamTeks(s?.jam_pulang),
    pulangMerah: pulangAwal(s?.jam_pulang, pulangIdeal),
  };
}

export function buildRekapBulanan(guru: Guru[], rows: AbsenBulanRow[], days: Date[]): GuruRow[] {
  const byKey = new Map<string, AbsenBulanRow>();
  for (const r of rows) byKey.set(`${r.kelas}|${r.tanggal}`, r);

  return guru.map((g) => {
    const pulangPagi = pulangPagiIdeal(g.kelas);
    let telat = 0;
    let awal = 0;
    const hari = days.map((d) => {
      const tgl = ymd(d);
      const r = byKey.get(`${g.kelas}|${tgl}`);
      const pagi = sesiCell(r?.pagi, DATANG_PAGI, pulangPagi, tgl);
      const siang = sesiCell(r?.siang, DATANG_SIANG, PULANG_SIANG, tgl);
      for (const c of [pagi, siang]) {
        if (c.kind === "jam") {
          if (c.datangMerah) telat++;
          if (c.pulangMerah) awal++;
        }
      }
      return { pagi, siang };
    });
    return { guru: g, telat, awal, hari };
  });
}
