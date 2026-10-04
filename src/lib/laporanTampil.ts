import { capaianIlmuBidang } from "../data";
import { groupTableBByBidang } from "./rpbSheet";
import type { CapaianIlmuData } from "./capaianIlmuSheet";
import type { RpbTabData } from "./rpbSheet";

// Bentuk data siap-tampil yang dipakai BARENG oleh preview di layar dan export PDF, jadi isi
// keduanya selalu sama. Teks guru dibawa apa adanya.

export type IlmuAnak = { nama: string; items: { grup: string | null; label: string; value: string }[] };

/** Capaian Ilmu per santri: cuma bidang yang ada isinya, urut seperti di sheet. */
export function ilmuPerAnak(kelas: string, d: CapaianIlmuData): IlmuAnak[] {
  const groups = capaianIlmuBidang(kelas);
  return d.anak
    .filter((a) => (a.nama ?? "").trim() !== "")
    .map((a) => {
      const items: IlmuAnak["items"] = [];
      for (const g of groups)
        for (const b of g.items) {
          const v = (d.values[b.key]?.[a.idx] ?? "").trim();
          if (v) items.push({ grup: g.grup, label: b.label, value: v });
        }
      return { nama: a.nama.trim(), items };
    });
}

export type RpbTarget = { bidang: string; rows: { subItem: string; target: string; indikator: string }[] };
export type RpbPekanRow = { pekan: string; bidang: string; subIlmu: string; metode: string };

export function rpbTampil(d: RpbTabData): { target: RpbTarget[]; pekan: RpbPekanRow[] } {
  const target = groupTableBByBidang(d.tableB).map((g) => ({ bidang: g.bidang, rows: g.details }));
  const pekan: RpbPekanRow[] = [];
  let curPekan = "";
  let curBidang = "";
  for (const r of d.tableC) {
    const p = (r[0] ?? "").trim();
    const b = (r[1] ?? "").trim();
    const s = (r[2] ?? "").trim();
    const m = (r[3] ?? "").trim();
    if (p) curPekan = p;
    if (b) curBidang = b;
    if (!s && !m) continue; // baris judul bidang / kosong, tidak ada isi
    pekan.push({ pekan: curPekan, bidang: curBidang, subIlmu: s, metode: m });
  }
  return { target, pekan };
}

export const KAP = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const persen = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);
