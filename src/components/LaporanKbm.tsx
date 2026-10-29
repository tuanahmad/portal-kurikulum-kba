import { useMemo, useState } from "react";
import { C } from "../data";
import { W, JAM_AKTIF } from "../lib/warnaLaporan";
import { toast } from "./Toast";
import { refleksiTerisi } from "../lib/laporanBulanan";
import { KELOMPOK_LABEL } from "../lib/olahraga";
import {
  SIMBOL,
  susunNarasi,
  bidangBelumTerbanyak,
  santriBelumBerulang,
  simpanKesimpulan,
  type NilaiBulan,
  type Periode,
  type Rasio,
  type Simbol,
  type GrafikKelas,
} from "../lib/penilaianKbm";

// Tampilan layar laporan KBM (Sajian Data). Susunannya sama dengan PDF: laporan utama (narasi + tabel + grafik +
// kesimpulan) lalu lampiran per bulan (checklist, grafik pekanan, refleksi, data pendukung, kualitas data, aturan).

const card = { background: "#FFF", border: `1px solid ${C.line}`, borderRadius: 16 } as const;
export const warnaPersen = (p: number | null) => (p == null ? C.muted : p >= 75 ? W.ok : p >= 40 ? W.warn : W.bad);
const bgPersen = (p: number | null) => (p == null ? undefined : p >= 75 ? C.leaf : p >= 40 ? W.krem : W.badBg);
const teksRasio = (r: Rasio | null | undefined, satuan = "") => (!r || r.p == null ? "–" : `${r.a} dari ${r.b}${satuan} (${r.p}%)`);
const warnaSimbol: Record<Simbol, string> = { ok: W.ok, belum: W.bad, kosong: C.muted, tanpa: C.muted };

export const ATURAN = [
  ["Sumber data", "Target diambil dari RPB bulanan. Capaian ilmu dari tanda Sudah/Belum yang diisi guru di Capaian Ilmu; capaian Al-Qur'an dari Capaian Al-Qur'an (angka baris per pertemuan dan surat); refleksi dari Laporan Refleksi Bulanan Guru."],
  ["Target ilmu", "Setiap target ilmu di RPB dinilai tersendiri: ✓ bila guru menandai Sudah tercapai, ✗ bila Belum tercapai (keterangan dari guru), ○ bila belum ditandai. Target Al-Qur'an tidak dinilai di bagian ilmu; Baghdadiyah tetap dinilai di bagian ilmu."],
  ["Persentase ilmu", "Jumlah target ✓ dibagi seluruh target ilmu di RPB, termasuk yang bertanda ○."],
  ["Ziyadah dan talaqqi", "Target per santri = angka target baris per pertemuan di RPB × jumlah pertemuan bulan itu (dari isian Jumlah Pertemuan RPB, atau jumlah hari sekolah). ✓ bila total baris sebulan sama atau melewati target. Santri tanpa angka target diberi – (capaian hanya dicatat)."],
  ["Muroja'ah", "✓ bila jumlah baris muroja'ah bulan itu lebih dari nol dan minimal sama dengan jumlah baris ziyadah bulan yang sama. ○ bila tidak ada catatan."],
  ["Wirid", "Minimal 1 putaran setiap pekan. ✓ bila setiap pekan yang tercatat bernilai 1 putaran atau lebih; ✗ bila ada pekan yang kurang dari 1 putaran atau bernilai 0; ○ bila tabel wirid kosong. Pekan berisi PT/TS (persiapan tasmi'/tasmi') tidak dinilai. Pekan yang kosong disebut di keterangan dan di catatan kualitas data. Bulan berjalan dinilai sampai pekan terakhir yang sudah selesai."],
  ["Persentase Al-Qur'an", "✓ dibagi (✓ + ✗). Tanda ○ dan – tidak dihitung."],
  ["Warna", "Hijau ≥ 75% tercapai, krem 40–74%, merah di bawah 40%."],
];

export function LaporanKbm({
  periode,
  data,
  kesimpulan,
  setKesimpulan,
  bisaUbah,
}: {
  periode: Periode;
  data: NilaiBulan[];
  kesimpulan: string;
  setKesimpulan: (t: string) => void;
  bisaUbah: boolean;
}) {
  const narasi = useMemo(() => susunNarasi(periode, data), [periode, data]);
  const bidang = useMemo(() => bidangBelumTerbanyak(data).filter(([, v]) => v.some((x) => x > 0)), [data]);
  const berulang = useMemo(() => santriBelumBerulang(data), [data]);
  const kelasList = data[0]?.lap.kelas.map((k) => k.kelas) ?? [];
  const multi = data.length > 1;
  const judul = periode.jenis === "bulan" ? "Laporan Bulanan" : "Laporan Triwulan";

  return (
    <div className="mt-6">
      {/* Sampul */}
      <div className="rounded-2xl p-5 text-center" style={{ background: C.green, color: "#FFF" }}>
        <div className="text-xs uppercase tracking-[0.18em] opacity-80">{judul}</div>
        <div className="text-lg sm:text-xl font-semibold mt-1" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>Kegiatan Belajar dan Mengajar</div>
        <div className="text-sm mt-0.5">{periode.label}</div>
        <div className="text-[11px] mt-2 opacity-80">
          Kuttab Budi Ashari · data per {data[data.length - 1]?.lap.dimuat.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
          {periode.jenis === "triwulan" && data.length < 3 ? ` · baru ${data.length} dari 3 bulan` : ""}
        </div>
      </div>

      <Bab no="1" judul="Ringkasan Umum">
        {narasi.ringkasan.map((p, i) => <Para key={i}>{p}</Para>)}
        <Tabel
          judul="Tabel 1. Ringkasan ketercapaian target"
          kepala={["Ukuran", ...data.map((d) => d.bulan)]}
          baris={[
            ["Target ilmu tercapai", ...data.map((d) => ({ teks: teksRasio(d.ringkas.ilmu), p: d.ringkas.ilmu.p }))],
            ["Santri mencapai target ziyadah/talaqqi", ...data.map((d) => ({ teks: teksRasio(d.ringkas.ziyadah), p: d.ringkas.ziyadah.p }))],
            ["Santri mencapai target muroja'ah", ...data.map((d) => ({ teks: teksRasio(d.ringkas.muroja), p: d.ringkas.muroja.p }))],
            ["Santri mencapai target wirid", ...data.map((d) => ({ teks: teksRasio(d.ringkas.wirid), p: d.ringkas.wirid.p }))],
          ]}
          catatan="Target ilmu dihitung dari seluruh target RPB di luar Al-Qur'an, termasuk yang belum ditandai. Al-Qur'an dihitung dari santri yang datanya bisa dinilai; santri tanpa data atau tanpa angka target tidak dihitung."
        />
        <GrafikTren data={data} />
      </Bab>

      <Bab no="2" judul="Capaian Ilmu">
        {narasi.ilmu.map((p, i) => <Para key={i}>{p}</Para>)}
        <Tabel
          judul="Tabel 2. Rekap target ilmu"
          kepala={["Bulan", "Direncanakan", "Tercapai", "Belum tercapai", "Tidak tercatat", "Ketercapaian"]}
          baris={data.map((d) => [
            d.bulan,
            String(d.ringkas.ilmu.rencana),
            String(d.ringkas.ilmu.a),
            String(d.ringkas.ilmu.belum),
            String(d.ringkas.ilmu.kosong),
            { teks: d.ringkas.ilmu.p == null ? "–" : `${d.ringkas.ilmu.p}%`, p: d.ringkas.ilmu.p },
          ])}
        />
        {bidang.length > 0 && (
          <Tabel
            judul="Tabel 3. Jumlah target yang belum tercapai per bidang"
            kepala={["Bidang", ...data.map((d) => d.bulan)]}
            baris={[...bidang.map(([k, v]) => [k, ...v.map(String)]), ["Jumlah", ...data.map((d) => String(d.ringkas.ilmu.belum))]]}
          />
        )}
        <Tabel
          judul="Tabel 4. Target ilmu tercapai per kelas"
          kepala={["Kelas", ...data.map((d) => d.bulan)]}
          baris={kelasList.map((k) => [k, ...data.map((d) => ({ teks: d.ringkas.ilmuPerKelas[k] ? `${d.ringkas.ilmuPerKelas[k]!.a} dari ${d.ringkas.ilmuPerKelas[k]!.b}` : "–", p: d.ringkas.ilmuPerKelas[k]?.p ?? null }))])}
          catatan={`Hijau ≥ 75% tercapai, krem 40–74%, merah <40%. "–" berarti RPB belum berisi target ilmu.`}
        />
      </Bab>

      <Bab no="3" judul="Capaian Al-Qur'an">
        {narasi.quran.map((p, i) => <Para key={i}>{p}</Para>)}
        <Tabel
          judul="Tabel 5. Rekap ketercapaian target Al-Qur'an (jumlah santri)"
          kepala={["Kategori", ...data.map((d) => d.bulan)]}
          baris={[
            ["Ziyadah dan talaqqi", ...data.map((d) => ({ teks: teksRasio(d.ringkas.ziyadah), p: d.ringkas.ziyadah.p }))],
            ["Muroja'ah", ...data.map((d) => ({ teks: teksRasio(d.ringkas.muroja), p: d.ringkas.muroja.p }))],
            ["Wirid", ...data.map((d) => ({ teks: teksRasio(d.ringkas.wirid), p: d.ringkas.wirid.p }))],
          ]}
        />
        <Tabel
          judul="Tabel 6. Santri yang mencapai target ziyadah/talaqqi per kelas"
          kepala={["Kelas", ...data.map((d) => d.bulan)]}
          baris={kelasList.map((k) => [k, ...data.map((d) => ({ teks: d.ringkas.ziyadahPerKelas[k] ? `${d.ringkas.ziyadahPerKelas[k]!.a} dari ${d.ringkas.ziyadahPerKelas[k]!.b}` : "–", p: d.ringkas.ziyadahPerKelas[k]?.p ?? null }))])}
          catatan={`"–" berarti belum ada angka target di RPB atau datanya belum bisa dinilai.`}
        />
        {multi ? (
          berulang.length > 0 && (
            <Tabel
              judul="Tabel 7. Santri yang belum mencapai target ziyadah/talaqqi dua bulan atau lebih"
              kepala={["Kelas", "Santri", "Bulan belum tercapai"]}
              baris={berulang.map((s) => [s.kelas, s.nama, s.bulan.join(", ")])}
            />
          )
        ) : (
          data[0].ringkas.santriBelumZ.length > 0 && (
            <Tabel
              judul="Tabel 7. Santri yang belum mencapai target ziyadah/talaqqi"
              kepala={["Kelas", "Santri"]}
              baris={Object.entries(
                data[0].ringkas.santriBelumZ.reduce<Record<string, string[]>>((a, s) => ((a[s.kelas] ??= []).push(s.nama), a), {})
              ).map(([k, v]) => [k, v.join(", ")])}
            />
          )
        )}
      </Bab>

      <Bab no="4" judul="Kesimpulan dan Evaluasi">
        <KesimpulanEditor kunci={periode.kunci} teks={kesimpulan} setTeks={setKesimpulan} bisaUbah={bisaUbah} />
        <div className="mt-5 grid grid-cols-2 gap-4 text-xs text-center" style={{ color: C.ink }}>
          <div>
            <div>Disusun oleh,</div>
            <div className="mt-10 font-semibold">Tim Kurikulum</div>
          </div>
          <div>
            <div>Mengetahui,</div>
            <div className="mt-10 font-semibold">Kepala Kuttab</div>
          </div>
        </div>
      </Bab>

      {/* ───────── Lampiran ───────── */}
      <div className="mt-10 rounded-2xl p-4 text-center" style={{ background: C.leaf, border: `1px solid ${C.line}` }}>
        <div className="text-sm font-bold" style={{ color: C.green }}>Lampiran</div>
        <div className="text-xs mt-0.5" style={{ color: C.muted }}>Checklist per kelas dan per santri, grafik pekanan Al-Qur'an, refleksi guru, data pendukung, catatan kualitas data, dan aturan penilaian.</div>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2 text-[11px]" style={{ color: C.muted }}>
          <span><b style={{ color: W.ok }}>✓</b> sesuai/melebihi target</span>
          <span><b style={{ color: W.bad }}>✗</b> belum sampai target</span>
          <span><b>○</b> tidak tercatat</span>
          <span><b>–</b> tidak ada target</span>
        </div>
      </div>
      {data.map((d, i) => (
        <LampiranBulan key={d.bulan} d={d} romawi={["I", "II", "III"][i] ?? String(i + 1)} />
      ))}
      <Akordeon judul="Catatan Kualitas Data" sub={`${data.reduce((a, d) => a + d.kualitas.length, 0)} catatan`}>
        {data.every((d) => d.kualitas.length === 0) ? (
          <Kosong>Tidak ada catatan.</Kosong>
        ) : (
          <Tabel kepala={["Bulan", "Kelas", "Masalah", "Usulan perbaikan"]} baris={data.flatMap((d) => d.kualitas.map((q) => [d.bulan, q.kelas, q.masalah, q.usulan]))} />
        )}
      </Akordeon>
      <Akordeon judul="Aturan Penilaian">
        <ol className="space-y-2 text-xs leading-relaxed list-decimal pl-4" style={{ color: C.ink }}>
          {ATURAN.map(([j, t]) => (
            <li key={j}><b>{j}.</b> {t}</li>
          ))}
        </ol>
      </Akordeon>
    </div>
  );
}

/* ───────── lampiran per bulan ───────── */

function LampiranBulan({ d, romawi }: { d: NilaiBulan; romawi: string }) {
  return (
    <div className="mt-5">
      <div className="text-sm font-bold px-1" style={{ color: C.green }}>
        Bagian {romawi} · {d.bulan} {d.year}{d.berjalan ? " (bulan berjalan)" : ""}
      </div>
      <Akordeon judul={`${romawi}.A Checklist RPB dan Capaian Ilmu`} sub={teksRasio(d.ringkas.ilmu, " target")}>
        {d.ilmu.map((k) => (
          <div key={k.kelas} className="mt-3 first:mt-0">
            <SubJudul>{k.kelas}{k.guru ? ` — ${k.guru}` : ""}</SubJudul>
            {k.items.length === 0 ? (
              <Kosong>{k.adaRpb ? "RPB belum berisi target ilmu." : "RPB belum bisa dibaca."}</Kosong>
            ) : (
              <Tabel
                kepala={["No", "Bidang", "Target RPB", "", "Keterangan"]}
                baris={k.items.map((it, i) => [String(i + 1), it.bidang, it.target, { simbol: it.simbol }, it.ket])}
              />
            )}
          </div>
        ))}
      </Akordeon>
      <Akordeon judul={`${romawi}.B Checklist Capaian Al-Qur'an per Santri`} sub={`Ziyadah/talaqqi ${teksRasio(d.ringkas.ziyadah)}`}>
        {d.quran.map((k) => (
          <div key={k.kelas} className="mt-3 first:mt-0">
            <SubJudul>{k.kelas}{k.guru ? ` — ${k.guru}` : ""}</SubJudul>
            <p className="text-[11px] -mt-1 mb-1.5" style={{ color: C.muted }}>{k.pertemuan} pertemuan</p>
            {k.items.length === 0 ? (
              <Kosong>{k.adaData ? "Belum ada bagian ziyadah/talaqqi, muroja'ah, atau wirid." : "Capaian Al-Qur'an belum diisi."}</Kosong>
            ) : (
              <Tabel
                kepala={["Santri", "Kategori", "Target", "Capaian", "", "Keterangan"]}
                baris={k.items.map((it) => [it.nama, it.label, it.target, it.capaian, { simbol: it.simbol }, it.ket])}
              />
            )}
          </div>
        ))}
      </Akordeon>
      <Akordeon judul={`${romawi}.C Grafik Al-Qur'an Pekanan`} sub={`${d.grafik.length} kelas`}>
        <p className="text-[11px] mb-2" style={{ color: C.muted }}>
          Setiap kotak satu santri; batang = baris per pekan. <b style={{ color: C.green }}>Hijau</b>: ziyadah/talaqqi; <b style={{ color: W.emas }}>emas</b>: muroja'ah.
        </p>
        {d.grafik.length === 0 ? <Kosong>Belum ada data pekanan.</Kosong> : d.grafik.map((g) => <GrafikPekanan key={g.kelas} g={g} />)}
      </Akordeon>
      <Akordeon judul={`${romawi}.D Refleksi Guru`} sub={`${d.lap.kelas.filter((k) => refleksiTerisi(k.refleksi)).length} dari ${d.lap.kelas.length} kelas terisi`}>
        {d.lap.kelas.filter((k) => refleksiTerisi(k.refleksi)).length === 0 ? (
          <Kosong>Lembar refleksi bulan ini belum diisi.</Kosong>
        ) : (
          d.lap.kelas.filter((k) => refleksiTerisi(k.refleksi)).map((k) => <RefleksiRingkas key={k.kelas} kelas={k.kelas} guru={k.guru} r={k.refleksi!} />)
        )}
      </Akordeon>
      <Akordeon judul={`${romawi}.E Data Pendukung`} sub="Kelengkapan, kehadiran guru, tasmi', olahraga">
        <DataPendukung d={d} />
      </Akordeon>
    </div>
  );
}

function RefleksiRingkas({ kelas, guru, r }: { kelas: string; guru: string; r: NonNullable<NilaiBulan["lap"]["kelas"][number]["refleksi"]> }) {
  const isi = (s?: string) => (s ?? "").trim();
  const capaian = r.capaianTarget.map((c) => isi(c[3])).filter(Boolean).join(" ");
  const pasangan: [string, string][] = [
    ["Capaian target", capaian],
    ["Strategi paling berhasil", isi(r.keberhasilan[0])],
    ["Faktor keberhasilan", isi(r.keberhasilan[1])],
    ["Yang paling disyukuri", isi(r.refleksiGuru[0])],
    ["Kesalahan yang tidak ingin diulang", isi(r.refleksiGuru[1])],
    ["Kemampuan yang akan ditingkatkan", isi(r.refleksiGuru[2])],
  ];
  const kendala = r.kendala.filter((x) => x.some((c) => isi(c)));
  const rencana = r.rencanaPerbaikan.filter((x) => x.some((c) => isi(c)));
  const murid = r.perkembanganMurid.filter((x) => isi(x[0]) && x.slice(1).some((c) => isi(c)));
  return (
    <div className="mt-3 first:mt-0">
      <SubJudul>{kelas}{guru ? ` — ${guru}` : ""}</SubJudul>
      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5">
        {pasangan.map(([l, v]) => (
          <div key={l} className="text-xs">
            <span className="font-semibold" style={{ color: C.green }}>{l}: </span>
            <span style={{ color: v ? C.ink : C.muted }}>{v || "—"}</span>
          </div>
        ))}
      </div>
      {kendala.length > 0 && <Tabel kepala={["Kendala", "Dampak", "Penyebab"]} baris={kendala.map((x) => x.slice(0, 3).map((c) => isi(c)))} />}
      {rencana.length > 0 && <Tabel kepala={["Rencana perbaikan", "Solusi", "Target waktu"]} baris={rencana.map((x) => x.slice(0, 3).map((c) => isi(c)))} />}
      {murid.length > 0 && <Tabel kepala={["Murid", "Perkembangan positif", "Tantangan", "Rencana pendampingan"]} baris={murid.map((x) => x.slice(0, 4).map((c) => isi(c)))} />}
    </div>
  );
}

function DataPendukung({ d }: { d: NilaiBulan }) {
  const lap = d.lap;
  const persen = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
  return (
    <>
      <SubJudul>Kelengkapan pengisian per kelas</SubJudul>
      <Tabel
        kepala={["Kelas", "Jurnal (hari)", "Absen santri", "Tasmi'"]}
        baris={lap.kelas.map((k) => [
          k.kelas,
          { teks: `${k.jurnal.terisi}/${k.jurnal.total}`, p: persen(k.jurnal.terisi, k.jurnal.total) },
          k.absenSantri ? { teks: `${persen(k.absenSantri.hadir, k.absenSantri.total)}% hadir`, p: null } : "–",
          String(k.tasmi.length),
        ])}
      />
      <SubJudul>Kehadiran dan kedisiplinan guru (per sesi)</SubJudul>
      <Tabel
        kepala={["Guru", "Hadir", "Izin", "Sakit", "Cuti", ...(JAM_AKTIF ? ["Telat", "Pulang awal"] : []), "% hadir"]}
        baris={lap.guruSummary.map((g) => [
          `${g.guru.nama} (${g.guru.kelas})`,
          String(g.hadir),
          String(g.izin),
          String(g.sakit),
          String(g.cuti),
          ...(JAM_AKTIF ? [String(g.telat), String(g.awal)] : []),
          { teks: g.persenHadir == null ? "–" : `${g.persenHadir}%`, p: g.persenHadir },
        ])}
      />
      {lap.kelas.some((k) => k.tasmi.length) && (
        <>
          <SubJudul>Tasmi' bulan ini</SubJudul>
          <Tabel
            kepala={["Tanggal", "Kelas", "Santri", "Juz", "Salah"]}
            baris={lap.kelas.flatMap((k) => k.tasmi.map((t) => [t.tanggal, k.kelas, t.nama_santri, t.juz || "—", String(t.jumlah_kesalahan)]))}
          />
        </>
      )}
      <SubJudul>Olahraga</SubJudul>
      <Tabel
        kepala={["Bagian", "Isi"]}
        baris={[
          ...lap.olahraga.evaluasi.map((e) => [`Evaluasi ${e.tingkat}`, { teks: `${e.terisi}/${e.total} santri`, p: persen(e.terisi, e.total) }]),
          ...lap.olahraga.rencana.map((r) => [`Rencana ${KELOMPOK_LABEL[r.kelompok]} ${r.tingkat}`, r.entry ? "Terisi" : "Belum"]),
          ...lap.olahraga.absen.map((a) => [`Kehadiran guru ${KELOMPOK_LABEL[a.kelompok]}`, `hadir ${a.hadir}, izin ${a.izin}, sakit ${a.sakit}, cuti ${a.cuti}`]),
        ]}
      />
    </>
  );
}

/* ───────── grafik ───────── */

function GrafikTren({ data }: { data: NilaiBulan[] }) {
  const seri: [string, (d: NilaiBulan) => number | null, string][] = [
    ["Ilmu", (d) => d.ringkas.ilmu.p, C.green],
    ["Ziyadah/talaqqi", (d) => d.ringkas.ziyadah.p, W.ok],
    ["Muroja'ah", (d) => d.ringkas.muroja.p, W.emas],
    ["Wirid", (d) => d.ringkas.wirid.p, W.warn],
  ];
  return (
    <div className="mt-4 p-4" style={card}>
      <div className="text-xs font-semibold" style={{ color: C.green }}>Grafik 1. {data.length > 1 ? "Tren ketercapaian target" : "Ketercapaian target"}</div>
      <div className="mt-3 space-y-3">
        {seri.map(([nama, f, warna]) => (
          <div key={nama}>
            <div className="text-[11px] font-semibold" style={{ color: C.ink }}>{nama}</div>
            <div className="mt-1 space-y-1">
              {data.map((d) => {
                const p = f(d);
                return (
                  <div key={d.bulan} className="grid items-center gap-2 text-[11px]" style={{ gridTemplateColumns: "72px minmax(0,1fr) 40px" }}>
                    <span style={{ color: C.muted }}>{d.bulan}</span>
                    <div className="h-3 rounded" style={{ background: "#EDEBE2" }}>
                      <div className="h-3 rounded" style={{ width: `${p ?? 0}%`, background: warna }} />
                    </div>
                    <span className="text-right tabular-nums font-semibold" style={{ color: warnaPersen(p) }}>{p == null ? "–" : `${p}%`}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GrafikPekanan({ g }: { g: GrafikKelas }) {
  const maks = Math.max(1, ...g.santri.flatMap((s) => [...s.z, ...s.m]));
  return (
    <div className="mt-3 first:mt-0">
      <SubJudul>{g.kelas} · {g.labelZ}</SubJudul>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {g.santri.map((s) => (
          <div key={s.nama} className="rounded-xl p-2" style={{ background: C.mist, border: `1px solid ${C.line}` }}>
            <div className="text-[11px] font-semibold truncate" title={s.nama}>{s.nama}</div>
            <div className="flex items-end gap-1 h-16 mt-1.5">
              {Array.from({ length: g.pekan }, (_, w) => (
                <div key={w} className="flex-1 flex items-end gap-px h-full" title={`P${w + 1}: ${s.z[w]} baris${s.m.length ? `, muroja'ah ${s.m[w]}` : ""}`}>
                  <div className="flex-1 rounded-t" style={{ height: `${(s.z[w] / maks) * 100}%`, minHeight: s.z[w] ? 2 : 0, background: C.green }} />
                  {s.m.length > 0 && <div className="flex-1 rounded-t" style={{ height: `${(s.m[w] / maks) * 100}%`, minHeight: s.m[w] ? 2 : 0, background: W.emas }} />}
                </div>
              ))}
            </div>
            <div className="flex gap-1 mt-0.5">
              {Array.from({ length: g.pekan }, (_, w) => (
                <span key={w} className="flex-1 text-center text-[9px]" style={{ color: C.muted }}>P{w + 1}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────── kesimpulan ───────── */

function KesimpulanEditor({ kunci, teks, setTeks, bisaUbah }: { kunci: string; teks: string; setTeks: (t: string) => void; bisaUbah: boolean }) {
  const [draf, setDraf] = useState(teks);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const berubah = draf !== teks;
  if (!bisaUbah) return teks ? <Para>{teks}</Para> : <Kosong>Belum ada kesimpulan.</Kosong>;
  return (
    <div>
      <p className="text-xs mb-2" style={{ color: C.muted }}>
        Diisi tim kurikulum setelah membaca data di atas: kesimpulan, evaluasi, dan solusi yang akan dijalankan. Ikut tercetak di PDF.
      </p>
      <textarea
        value={draf}
        onChange={(e) => setDraf(e.target.value)}
        rows={8}
        placeholder={"Setelah membaca dan menganalisis data KBM, tim kurikulum menyimpulkan dan mengevaluasi beberapa hal berikut:\n1. ...\n\nSolusi yang akan dijalankan:\n1. ..."}
        className="w-full text-sm outline-none px-3.5 py-3 rounded-xl leading-relaxed"
        style={{ border: `1px solid ${C.line}`, background: "#FFF" }}
      />
      {error && <div className="mt-2 rounded-xl px-3.5 py-2.5 text-xs" style={{ background: W.badBg, color: "#8A2A20" }}>{error}</div>}
      <button
        type="button"
        disabled={!berubah || saving}
        onClick={async () => {
          setSaving(true);
          setError(null);
          try {
            await simpanKesimpulan(kunci, draf);
            setTeks(draf);
            toast.sukses("Kesimpulan tersimpan");
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          } finally {
            setSaving(false);
          }
        }}
        className="mt-2 w-full text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50"
        style={{ background: C.green, color: "#FFF" }}
      >
        {saving ? "Menyimpan…" : berubah ? "Simpan kesimpulan" : "Kesimpulan tersimpan"}
      </button>
    </div>
  );
}

/* ───────── kepingan tampilan ───────── */

function Bab({ no, judul, children }: { no: string; judul: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-base sm:text-lg font-semibold" style={{ color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}>
        {no}. {judul}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
function Para({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed mt-2 whitespace-pre-wrap" style={{ color: C.ink, textAlign: "justify" }}>{children}</p>;
}
function SubJudul({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-bold mb-1.5 mt-3" style={{ color: C.green }}>{children}</div>;
}
function Kosong({ children }: { children: React.ReactNode }) {
  return <p className="text-xs" style={{ color: C.muted }}>{children}</p>;
}

function Akordeon({ judul, sub, children }: { judul: string; sub?: string; children: React.ReactNode }) {
  const [buka, setBuka] = useState(false);
  return (
    <div className="mt-2 overflow-hidden" style={card}>
      <button type="button" onClick={() => setBuka((b) => !b)} className="w-full flex items-center gap-3 px-4 py-3 text-left" aria-expanded={buka} style={{ background: buka ? C.leaf : "#FFF" }}>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold" style={{ color: C.ink }}>{judul}</div>
          {sub && <div className="text-xs truncate" style={{ color: C.muted }}>{sub}</div>}
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: C.muted, transform: buka ? "rotate(180deg)" : "none", transition: "transform .2s" }}>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {buka && <div className="px-4 pb-4 pt-2" style={{ borderTop: `1px solid ${C.line}` }}>{children}</div>}
    </div>
  );
}

type Sel = string | { teks: string; p: number | null } | { simbol: Simbol };
function Tabel({ judul, kepala, baris, catatan }: { judul?: string; kepala: string[]; baris: Sel[][]; catatan?: string }) {
  return (
    <div className="mt-3">
      {judul && <div className="text-xs font-semibold mb-1.5" style={{ color: C.green }}>{judul}</div>}
      <div className="overflow-x-auto" style={card}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: C.leaf, color: C.muted }}>
              {kepala.map((h, i) => (
                <th key={i} className={`font-semibold px-2.5 py-2 ${i === 0 ? "text-left" : "text-center"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {baris.map((r, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${C.line}` }} className="align-top">
                {r.map((c, j) => {
                  if (typeof c === "string")
                    return <td key={j} className={`px-2.5 py-2 whitespace-pre-wrap ${j === 0 ? "font-medium" : c.length > 24 ? "text-left" : "text-center"}`}>{c}</td>;
                  if ("simbol" in c)
                    return <td key={j} className="px-2 py-2 text-center font-bold text-sm" style={{ color: warnaSimbol[c.simbol] }}>{SIMBOL[c.simbol]}</td>;
                  return <td key={j} className="px-2.5 py-2 text-center font-semibold" style={{ color: warnaPersen(c.p), background: bgPersen(c.p) }}>{c.teks}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {catatan && <p className="text-[11px] mt-1" style={{ color: C.muted }}>{catatan}</p>}
    </div>
  );
}
