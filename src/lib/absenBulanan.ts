import { ymd, type AbsenBulanRow, type SesiEntry } from "./absen";
import { DATANG_PAGI, DATANG_SIANG, PULANG_SIANG, pulangPagiIdeal, telatDatang, pulangAwal, jamGanjil, normalisasiJam } from "./absenAturan";

// Model rekap absen guru per bulan -- dipakai bareng sama tampilan tabel di layar DAN export PDF,
// biar aturan merah/putihnya cuma ada di 1 tempat.

export type Guru = { kelas: string; nama: string };

export type SesiCell =
  | { kind: "status"; teks: string; ket: string }
  | {
      kind: "jam";
      datang: string | null;
      datangMerah: boolean;
      datangGanjil: boolean;
      pulang: string | null;
      pulangMerah: boolean;
      pulangGanjil: boolean;
    };

export type JamGanjil = { tanggal: string; sesi: "pagi" | "siang"; jenis: "datang" | "pulang"; jam: string };

export type GuruRow = {
  guru: Guru;
  telat: number;
  awal: number;
  /** Isian jam yang tidak wajar (lihat jamGanjil) -- ditandai, tidak dihitung telat/pulang awal. */
  ganjil: JamGanjil[];
  hari: { pagi: SesiCell; siang: SesiCell }[];
};

const STATUS_TEKS: Record<string, string> = { izin: "Izin", sakit: "Sakit", cuti: "Cuti" };

/** "06:14" / "06:14:00" -> "06.14"; kosong -> "-" (dipakai PDF) atau tampilan kasih "—". */
export function jamTeks(jam: string | null | undefined): string | null {
  const m = String(jam ?? "").match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}.${m[2]}` : null;
}

function sesiCell(s: SesiEntry | undefined, sesi: "pagi" | "siang", datangIdeal: number, pulangIdeal: number, tanggal: string): SesiCell {
  if (s && s.status !== "hadir") {
    return { kind: "status", teks: STATUS_TEKS[s.status] ?? s.status, ket: s.keterangan.trim() };
  }
  // Baca AM/PM dulu (02.13 di kelas siang = 14.13), baru dinilai telat / pulang awal / tidak wajar.
  const datangN = normalisasiJam(s?.jam_datang, sesi, "datang");
  const pulangN = normalisasiJam(s?.jam_pulang, sesi, "pulang");
  const dG = jamGanjil(datangN, sesi, "datang");
  const pG = jamGanjil(pulangN, sesi, "pulang");
  return {
    kind: "jam",
    // Kalau tetap tidak wajar setelah dibaca sebagai sore/pagi, tampilkan jam ASLI yang tersimpan (apa adanya),
    // bukan hasil bacaan yang justru menyesatkan (mis. 06.06 jadi 18.06).
    datang: jamTeks(dG ? s?.jam_datang : datangN),
    datangGanjil: dG,
    datangMerah: !dG && telatDatang(datangN, datangIdeal, tanggal),
    pulang: jamTeks(pG ? s?.jam_pulang : pulangN),
    pulangGanjil: pG,
    pulangMerah: !pG && pulangAwal(pulangN, pulangIdeal),
  };
}

export function buildRekapBulanan(guru: Guru[], rows: AbsenBulanRow[], days: Date[]): GuruRow[] {
  const byKey = new Map<string, AbsenBulanRow>();
  for (const r of rows) byKey.set(`${r.kelas}|${r.tanggal}`, r);

  return guru.map((g) => {
    const pulangPagi = pulangPagiIdeal(g.kelas);
    let telat = 0;
    let awal = 0;
    const ganjil: JamGanjil[] = [];
    const hari = days.map((d) => {
      const tgl = ymd(d);
      const r = byKey.get(`${g.kelas}|${tgl}`);
      const pagi = sesiCell(r?.pagi, "pagi", DATANG_PAGI, pulangPagi, tgl);
      const siang = sesiCell(r?.siang, "siang", DATANG_SIANG, PULANG_SIANG, tgl);
      for (const [c, sesi] of [[pagi, "pagi"], [siang, "siang"]] as const) {
        if (c.kind === "jam") {
          if (c.datangMerah) telat++;
          if (c.pulangMerah) awal++;
          if (c.datangGanjil && c.datang) ganjil.push({ tanggal: tgl, sesi, jenis: "datang", jam: c.datang });
          if (c.pulangGanjil && c.pulang) ganjil.push({ tanggal: tgl, sesi, jenis: "pulang", jam: c.pulang });
        }
      }
      return { pagi, siang };
    });
    return { guru: g, telat, awal, ganjil, hari };
  });
}
