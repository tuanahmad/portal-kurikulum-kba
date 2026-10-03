import { Fragment, useEffect, useMemo, useState } from "react";
import { C, KELAS_LIST } from "../data";
import { supabase } from "../lib/supabaseClient";
import { PageLoadingSkeleton } from "./Skeleton";
import { readAbsenRangeAll, ymd, labelHari, type AbsenBulanRow, type SesiEntry } from "../lib/absen";
import {
  DATANG_PAGI,
  DATANG_SIANG,
  PULANG_SIANG,
  pulangPagiIdeal,
  telatDatang,
  pulangAwal,
} from "../lib/absenAturan";

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const STATUS_TEKS: Record<string, string> = { izin: "Izin", sakit: "Sakit", cuti: "Cuti" };
const RED_BG = "#FDEBEA";
const RED_TX = "#B3261E";

type Guru = { kelas: string; nama: string };

function weekdaysOfMonth(year: number, month0: number): Date[] {
  const out: Date[] = [];
  const d = new Date(year, month0, 1);
  while (d.getMonth() === month0) {
    const w = d.getDay();
    if (w >= 1 && w <= 5) out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

const fmt = (jam: string | null) => (jam ? jam.replace(":", ".") : "—");

/** Rekap absen guru per BULAN (management): baris = guru, kolom = tanggal Senin–Jumat, tiap tanggal
 *  punya 4 jam (pagi datang/pulang, siang datang/pulang). Merah = datang terlambat atau pulang
 *  lebih awal dari batas (aturan di lib/absenAturan.ts); putih = tepat waktu. */
export function AbsenBulananTable() {
  const now = useMemo(() => new Date(), []);
  const [monthDate, setMonthDate] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const year = monthDate.getFullYear();
  const month0 = monthDate.getMonth();
  const atThisMonth = year === now.getFullYear() && month0 === now.getMonth();

  const [guru, setGuru] = useState<Guru[]>([]);
  const [rows, setRows] = useState<AbsenBulanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const days = useMemo(() => weekdaysOfMonth(year, month0), [year, month0]);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("kelas, full_name")
      .eq("role", "guru")
      .then(({ data, error }) => {
        if (error) return setError(error.message);
        const order = (k: string) => {
          const i = KELAS_LIST.findIndex((x) => x.name === k);
          return i === -1 ? 999 : i;
        };
        setGuru(
          (data ?? [])
            .filter((r) => r.kelas)
            .map((r) => ({ kelas: r.kelas as string, nama: (r.full_name as string) || (r.kelas as string) }))
            .sort((a, b) => order(a.kelas) - order(b.kelas))
        );
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const from = ymd(new Date(year, month0, 1));
    const to = ymd(new Date(year, month0 + 1, 0));
    readAbsenRangeAll(from, to)
      .then((r) => !cancelled && setRows(r))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [year, month0]);

  const byKey = useMemo(() => {
    const m = new Map<string, AbsenBulanRow>();
    for (const r of rows) m.set(`${r.kelas}|${r.tanggal}`, r);
    return m;
  }, [rows]);

  const border = `1px solid ${C.line}`;

  function shift(n: number) {
    setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + n, 1));
  }

  /** Nilai 1 sesi buat 1 guru-hari: 2 sel (datang, pulang), atau 1 sel status kalau izin/sakit/cuti. */
  function renderSesi(sesi: SesiEntry | undefined, datangIdeal: number, pulangIdeal: number, key: string, awalHari: boolean) {
    const base = { borderTop: border, borderLeft: awalHari ? border : undefined } as const;
    if (sesi && sesi.status !== "hadir") {
      const ket = sesi.keterangan.trim();
      return (
        <td key={key} colSpan={2} className="text-center px-1 py-1 align-top" style={{ ...base, color: C.muted, minWidth: 88 }}>
          <div className="font-semibold">{STATUS_TEKS[sesi.status] ?? sesi.status}</div>
          {ket && <div className="text-[10px] leading-tight" style={{ maxWidth: 88, wordBreak: "break-word" }}>{ket}</div>}
        </td>
      );
    }
    const telat = telatDatang(sesi?.jam_datang, datangIdeal);
    const awal = pulangAwal(sesi?.jam_pulang, pulangIdeal);
    return (
      <Fragment key={key}>
        <td className="text-center px-1 py-1 tabular-nums" style={telat ? { ...base, background: RED_BG, color: RED_TX, fontWeight: 700 } : { ...base, color: C.ink }}>
          {fmt(sesi?.jam_datang ?? null)}
        </td>
        <td className="text-center px-1 py-1 tabular-nums" style={awal ? { borderTop: border, background: RED_BG, color: RED_TX, fontWeight: 700 } : { borderTop: border, color: C.ink }}>
          {fmt(sesi?.jam_pulang ?? null)}
        </td>
      </Fragment>
    );
  }

  return (
    <>
      <div className="mt-5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => shift(-1)}
          aria-label="Bulan sebelumnya"
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "#FFF", border, color: C.green }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div className="flex-1 text-center rounded-xl px-3 py-2" style={{ background: "#FFF", border }}>
          <div className="text-sm font-semibold" style={{ color: C.ink }}>{BULAN[month0]} {year}</div>
          {atThisMonth && <div className="text-[11px]" style={{ color: C.green }}>Bulan ini</div>}
        </div>
        <button
          type="button"
          onClick={() => shift(1)}
          disabled={atThisMonth}
          aria-label="Bulan berikutnya"
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "#FFF", border, color: C.green, opacity: atThisMonth ? 0.35 : 1, cursor: atThisMonth ? "not-allowed" : "pointer" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ transform: "rotate(180deg)" }}><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed px-1" style={{ color: C.muted }}>
        Merah = datang terlambat (pagi lewat 06.30, siang lewat 14.00) atau pulang lebih awal (pagi: Kuttab Awwal 1A/1B
        sebelum 10.00, lainnya sebelum 10.30; siang sebelum 15.00). Putih = tepat waktu.
      </p>

      {error && (
        <div className="mt-4 rounded-xl px-3.5 py-2.5 text-xs" style={{ background: "#FDEBEA", border: "1px solid #E8A6A0", color: "#8A2A20" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-5"><PageLoadingSkeleton /></div>
      ) : (
        <div className="mt-4 rounded-2xl overflow-x-auto" style={{ background: "#FFF", border }}>
          <table className="text-[11px]" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr style={{ background: C.leaf }}>
                <th
                  rowSpan={3}
                  className="text-left px-2.5 py-2 font-semibold align-bottom"
                  style={{ position: "sticky", left: 0, zIndex: 2, background: C.leaf, color: C.muted, minWidth: 120, borderRight: border }}
                >
                  Guru
                </th>
                <th rowSpan={3} className="px-2 py-2 font-semibold align-bottom" style={{ color: C.muted, minWidth: 52, borderRight: border }}>
                  Telat<br />datang
                </th>
                <th rowSpan={3} className="px-2 py-2 font-semibold align-bottom" style={{ color: C.muted, minWidth: 52, borderRight: border }}>
                  Pulang<br />awal
                </th>
                {days.map((d) => (
                  <th key={ymd(d)} colSpan={4} className="px-1 py-1.5 font-semibold" style={{ color: C.ink, borderLeft: border }}>
                    {labelHari(d).slice(0, 3)} {d.getDate()}
                  </th>
                ))}
              </tr>
              <tr style={{ background: C.leaf }}>
                {days.map((d) => (
                  <Fragment key={ymd(d)}>
                    <th colSpan={2} className="px-1 py-1 font-medium" style={{ color: C.muted, borderLeft: border }}>Pagi</th>
                    <th colSpan={2} className="px-1 py-1 font-medium" style={{ color: C.muted }}>Siang</th>
                  </Fragment>
                ))}
              </tr>
              <tr style={{ background: C.leaf }}>
                {days.map((d) => (
                  <Fragment key={ymd(d)}>
                    <th className="px-1 py-1 font-normal" style={{ color: C.muted, borderLeft: border }}>Dtg</th>
                    <th className="px-1 py-1 font-normal" style={{ color: C.muted }}>Plg</th>
                    <th className="px-1 py-1 font-normal" style={{ color: C.muted }}>Dtg</th>
                    <th className="px-1 py-1 font-normal" style={{ color: C.muted }}>Plg</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {guru.map((g) => {
                const pulangPagi = pulangPagiIdeal(g.kelas);
                let telat = 0;
                let awal = 0;
                for (const d of days) {
                  const r = byKey.get(`${g.kelas}|${ymd(d)}`);
                  if (!r) continue;
                  if (r.pagi.status === "hadir") {
                    if (telatDatang(r.pagi.jam_datang, DATANG_PAGI)) telat++;
                    if (pulangAwal(r.pagi.jam_pulang, pulangPagi)) awal++;
                  }
                  if (r.siang.status === "hadir") {
                    if (telatDatang(r.siang.jam_datang, DATANG_SIANG)) telat++;
                    if (pulangAwal(r.siang.jam_pulang, PULANG_SIANG)) awal++;
                  }
                }
                return (
                  <tr key={g.kelas}>
                    <td
                      className="px-2.5 py-1.5 align-top"
                      style={{ position: "sticky", left: 0, zIndex: 1, background: "#FFF", borderTop: border, borderRight: border, minWidth: 120 }}
                    >
                      <div className="font-semibold truncate" style={{ color: C.ink, maxWidth: 130 }}>{g.nama}</div>
                      <div className="text-[10px] truncate" style={{ color: C.muted, maxWidth: 130 }}>{g.kelas}</div>
                    </td>
                    <td className="text-center font-bold tabular-nums" style={{ borderTop: border, borderRight: border, color: telat > 0 ? RED_TX : C.muted, background: telat > 0 ? RED_BG : undefined }}>
                      {telat}
                    </td>
                    <td className="text-center font-bold tabular-nums" style={{ borderTop: border, borderRight: border, color: awal > 0 ? RED_TX : C.muted, background: awal > 0 ? RED_BG : undefined }}>
                      {awal}
                    </td>
                    {days.map((d) => {
                      const r = byKey.get(`${g.kelas}|${ymd(d)}`);
                      return (
                        <Fragment key={ymd(d)}>
                          {renderSesi(r?.pagi, DATANG_PAGI, pulangPagi, "pg", true)}
                          {renderSesi(r?.siang, DATANG_SIANG, PULANG_SIANG, "sg", false)}
                        </Fragment>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
