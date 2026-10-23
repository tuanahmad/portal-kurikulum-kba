import { EmptyState } from "./EmptyState";
import { C } from "../data";
import { labelHari, labelTanggal, ymd, isEntryFilled, PERTANYAAN_JURNAL, NAMA_BULAN, type JurnalEntry } from "../lib/jurnal";

/** Tampilan baca (preview) jurnal SATU guru pada SATU pekan, digabung jadi satu tulisan berurutan.
 *  Hari yang berisi ditampilkan penuh; hari kerja berurutan yang kosong dilipat jadi satu baris saja. */

type Potongan =
  | { jenis: "isi"; tanggal: Date; entry: JurnalEntry }
  | { jenis: "kosong"; dari: Date; sampai: Date };

function susun(days: Date[], entries: Record<string, JurnalEntry>): Potongan[] {
  const out: Potongan[] = [];
  for (const d of days) {
    const e = entries[ymd(d)];
    if (isEntryFilled(e)) {
      out.push({ jenis: "isi", tanggal: d, entry: e as JurnalEntry });
    } else {
      const akhir = out[out.length - 1];
      if (akhir && akhir.jenis === "kosong") akhir.sampai = d;
      else out.push({ jenis: "kosong", dari: d, sampai: d });
    }
  }
  return out;
}

function labelKosong(dari: Date, sampai: Date): string {
  if (ymd(dari) === ymd(sampai)) return `${labelHari(dari)}, ${dari.getDate()} ${NAMA_BULAN[dari.getMonth()]}`;
  const bulanSama = dari.getMonth() === sampai.getMonth();
  const awal = bulanSama ? `${labelHari(dari)} ${dari.getDate()}` : `${labelHari(dari)} ${dari.getDate()} ${NAMA_BULAN[dari.getMonth()]}`;
  return `${awal} – ${labelHari(sampai)} ${sampai.getDate()} ${NAMA_BULAN[sampai.getMonth()]}`;
}

export default function JurnalGabungan({
  guru,
  kelas,
  rentang,
  days,
  entries,
}: {
  guru: string;
  kelas: string;
  rentang: string;
  days: Date[];
  entries: Record<string, JurnalEntry>;
}) {
  const potongan = susun(days, entries);
  const adaIsi = potongan.some((p) => p.jenis === "isi");

  return (
    <section className="mt-5 rounded-2xl p-4 sm:p-5" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
      <div className="pb-3 mb-1" style={{ borderBottom: `1px solid ${C.line}` }}>
        <div className="text-base font-semibold" style={{ color: C.ink }}>{guru}</div>
        <div className="text-xs mt-0.5" style={{ color: C.muted }}>
          {kelas} · {rentang}
        </div>
      </div>

      {!adaIsi && (
        <div className="pt-4">
          <EmptyState ikon="jurnal" judul="Belum ada jurnal pekan ini" petunjuk="Jurnal akan tampil di sini setelah guru mengisinya." padat />
        </div>
      )}

      {adaIsi &&
        potongan.map((p, i) =>
          p.jenis === "isi" ? (
            <div key={i} className="pt-4">
              <div className="inline-block text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: C.leaf, color: C.green }}>
                {labelHari(p.tanggal)}, {labelTanggal(p.tanggal)}
              </div>
              <div className="mt-2.5 space-y-3">
                {PERTANYAAN_JURNAL.map((q) => {
                  const v = p.entry[q.key]?.trim();
                  return (
                    <div key={q.key}>
                      <div className="text-[11px] font-semibold leading-snug" style={{ color: C.green }}>{q.label}</div>
                      <div className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap break-words" style={{ color: v ? C.ink : C.muted }}>
                        {v || "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p key={i} className="pt-4 text-xs italic" style={{ color: C.muted }}>
              {labelKosong(p.dari, p.sampai)}: belum diisi.
            </p>
          )
        )}
    </section>
  );
}
