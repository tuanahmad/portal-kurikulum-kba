import { C } from "../data";
import { AutoTextarea } from "./AutoTextarea";
import { LABEL_MODE, PEKAN_TARGET_QURAN, type ModeQuran, type RpbQuranRow } from "../lib/rpbSheet";

// Isian Al-Qur'an PER SANTRI (Desember dst.), dipisah per bidang: target keseluruhan bulan + rincian per pekan.
//  - Alur tasmi' (Qonuni & KA 3 Akhwat): santri punya fase -- Ziyadah / Persiapan Tasmi' / Tasmi'.
//      Ziyadah          : Ziyadah, Murojaah, Wirid (masing-masing target bulan + rincian per pekan)
//      Persiapan/Tasmi' : Murojaah (target + rincian per pekan) dan Wirid (target satu bulan saja, tanpa rincian pekan);
//                         ziyadah tidak diisi dan tidak dinilai.
//  - Kuttab Awwal lain: Talaqqi, Murojaah Jama'i, Baghdadiyah (masing-masing target bulan + rincian per pekan).

type Props = {
  q: RpbQuranRow;
  i: number;
  label: string[]; // 3 judul: [ziyadah|talaqqi, murojaah, wirid|baghdadiyah]
  alurTasmi: boolean;
  onIsi: (i: number, j: number, val: string) => void; // target keseluruhan (3 isian)
  onTarget: (i: number, val: string) => void; // angka baris per pertemuan
  onPekan: (i: number, p: number, val: string) => void; // angka baris ziyadah/talaqqi per pekan (sheet)
  onRincian: (i: number, kat: string, bagian: "isi" | "target", p: number, val: string) => void;
  onMode: (i: number, m: ModeQuran) => void;
};

const KAT = ["ziyadah", "murojaah", "wirid"] as const;

export function RencanaQuranSantri({ q, i, label, alurTasmi, onIsi, onTarget, onPekan, onRincian, onMode }: Props) {
  const mode: ModeQuran = q.mode ?? "ziyadah";
  const tasmi = alurTasmi && mode !== "ziyadah";
  const katKetiga = alurTasmi ? "wirid" : "baghdadiyah";
  const kotak = { background: "#FFF", border: `1px solid ${C.line}` } as const;

  const Bagian = ({ j, kat, judul, angkaPekan, putaranPekan, tanpaPekan }: { j: number; kat: string; judul: string; angkaPekan?: boolean; putaranPekan?: boolean; tanpaPekan?: boolean }) => (
    <div className="rounded-lg p-2.5" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
      <div className="text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: C.green }}>{judul}</div>
      <span className="block text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>
        Target keseluruhan bulan ini
      </span>
      <AutoTextarea
        value={q.rencana[j] ?? ""}
        onChange={(e) => onIsi(i, j, e.target.value)}
        placeholder={`Target ${judul.toLowerCase()} bulan ini`}
        rows={1}
        className="block w-full text-xs outline-none px-2.5 py-1.5 rounded-md"
        style={{ background: C.leaf, border: `1px solid ${C.line}` }}
      />
      {angkaPekan && (
        <label className="mt-2 flex items-center gap-1.5 text-[11px]" style={{ color: C.muted }}>
          Target {judul.toLowerCase()} per pertemuan
          <input
            value={q.target ?? ""}
            onChange={(e) => onTarget(i, e.target.value.replace(/[^0-9.,]/g, ""))}
            inputMode="decimal"
            placeholder="0"
            aria-label={`Target ${judul} ${q.nama} (baris per pertemuan)`}
            className="w-14 text-xs text-center outline-none px-2 py-1 rounded-md"
            style={kotak}
          />
          baris
        </label>
      )}
      {!tanpaPekan && (
        <div className="mt-2">
          <span className="block text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>
            Rincian per pekan{angkaPekan ? " (isi + target baris)" : putaranPekan ? " (isi + target putaran)" : ""}
          </span>
          {Array.from({ length: PEKAN_TARGET_QURAN }, (_, p) => (
            <div key={p} className="flex items-center gap-1.5 mb-1">
              <span className="w-6 text-[11px] shrink-0" style={{ color: C.muted }}>P{p + 1}</span>
              <input
                value={q.rincian?.[kat]?.isi?.[p] ?? ""}
                onChange={(e) => onRincian(i, kat, "isi", p, e.target.value)}
                placeholder={`${judul} pekan ${p + 1}`}
                aria-label={`${judul} pekan ${p + 1} ${q.nama}`}
                className="flex-1 min-w-0 text-xs outline-none px-2 py-1 rounded-md"
                style={{ background: C.leaf, border: `1px solid ${C.line}` }}
              />
              {angkaPekan && (
                <input
                  value={q.targetPekan?.[p] ?? ""}
                  onChange={(e) => onPekan(i, p, e.target.value.replace(/[^0-9.,]/g, ""))}
                  inputMode="decimal"
                  placeholder="baris"
                  aria-label={`Target baris pekan ${p + 1} ${q.nama}`}
                  className="w-14 text-xs text-center outline-none px-1.5 py-1 rounded-md"
                  style={kotak}
                />
              )}
              {putaranPekan && (
                <input
                  value={q.rincian?.[kat]?.target?.[p] ?? ""}
                  onChange={(e) => onRincian(i, kat, "target", p, e.target.value.replace(/[^0-9.,]/g, ""))}
                  inputMode="decimal"
                  placeholder="putaran"
                  aria-label={`Target putaran wirid pekan ${p + 1} ${q.nama}`}
                  className="w-16 text-xs text-center outline-none px-1.5 py-1 rounded-md"
                  style={kotak}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-2">
      {alurTasmi && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Fase ${q.nama}`}>
          {(["ziyadah", "persiapan_tasmi", "tasmi"] as ModeQuran[]).map((m) => {
            const on = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => onMode(i, m)}
                aria-pressed={on}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                style={{ background: on ? C.green : "#FFF", color: on ? "#FFF" : C.ink, border: `1px solid ${on ? C.green : C.line}` }}
              >
                {LABEL_MODE[m]}
              </button>
            );
          })}
        </div>
      )}
      {tasmi && (
        <p className="text-[11px] leading-relaxed" style={{ color: C.muted }}>
          Bulan ini {LABEL_MODE[mode].toLowerCase()}: ziyadah tidak diisi dan tidak dinilai. Isi murojaah (persiapannya per pekan) dan target wirid satu bulan (mengulang seluruh hafalan).
        </p>
      )}

      {!tasmi && <Bagian j={0} kat="ziyadah" judul={label[0] ?? (alurTasmi ? "Ziyadah" : "Talaqqi")} angkaPekan />}
      <Bagian j={1} kat="murojaah" judul={label[1] ?? "Murojaah"} />
      <Bagian j={2} kat={katKetiga} judul={label[2] ?? (alurTasmi ? "Wirid" : "Baghdadiyah")} putaranPekan={alurTasmi && !tasmi} tanpaPekan={tasmi} />
    </div>
  );
}

export { KAT };
