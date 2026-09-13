import { useEffect, useState } from "react";
import { useNavigate, useParams, Navigate } from "react-router-dom";
import { C, RPB_FILES_DEV, jenjangOf, isMonthOpen } from "../data";
import { useAuth } from "../contexts/AuthContext";
import { readRpbTab, writeRpbTab, type RpbTabData } from "../lib/rpbSheet";
import { PageLoadingSkeleton } from "../components/Skeleton";

const TABLE_B_ROWS_DEFAULT = 5; // muncul dari awal
const TABLE_B_ROWS_MAX = 8; // batas atas — "+ Tambah Bidang Ilmu" bisa nambah sampai sini
const PEKAN_PER_BIDANG = 5;
const TABLE_C_ROWS = TABLE_B_ROWS_MAX * PEKAN_PER_BIDANG; // 40 — 8 Bidang Ilmu x 5 Pekan tetap

function emptyTableB(): string[][] {
  return Array.from({ length: TABLE_B_ROWS_MAX }, () => ["", "", ""]);
}
function emptyTableC(): string[][] {
  return Array.from({ length: TABLE_C_ROWS }, () => ["", "", "", ""]);
}
function padRows(rows: string[][] | undefined, count: number, cols: number): string[][] {
  const base = rows ?? [];
  return Array.from({ length: count }, (_, i) => {
    const row = base[i] ?? [];
    return Array.from({ length: cols }, (_, j) => row[j] ?? "");
  });
}

/** Halaman isi RPB — form-nya nulis ke file salinan uji coba (RPB_FILES_DEV) selama data
 *  asli belum dimigrasikan (biar aman, gak nyentuh sheet yang lagi aktif dipakai guru).
 *  Tiap baris tabel di sheet asli (kolom sempit) di sini dirender sebagai kartu bertumpuk —
 *  field-nya (Target Capaian, Metode Pengajaran, dst) isinya teks panjang, jadi gak muat
 *  dipaksa ke kolom tabel sempit. Layout persis ngikutin range sel di sheet-rpb edge function
 *  (C3:C7, B11:E15, B19:E35). */
export default function RpbFormPage() {
  const navigate = useNavigate();
  const { bulan } = useParams<{ bulan: string }>();
  const { kelas, fullName } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [editingInfo, setEditingInfo] = useState(false);

  // Field info umum — semuanya editable, isinya ngikutin apa yang ke-baca dari sheet (guru
  // bebas benerin kalau beda dari akun login-nya, misal Kelas ditulis "1A" bukan nama lengkap).
  const [namaGuru, setNamaGuru] = useState("");
  const [kelasField, setKelasField] = useState("");
  const [levelField, setLevelField] = useState("");
  const [bulanField, setBulanField] = useState("");
  const [jumlahPertemuan, setJumlahPertemuan] = useState("");
  const [tableB, setTableB] = useState<string[][]>(emptyTableB());
  const [tableC, setTableC] = useState<string[][]>(emptyTableC());
  const [bidangCount, setBidangCount] = useState(TABLE_B_ROWS_DEFAULT);

  const file = RPB_FILES_DEV.find((f) => f.name === bulan);

  useEffect(() => {
    if (!kelas || !file) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSaveMsg(null);
    readRpbTab(file.id, kelas)
      .then((data) => {
        if (cancelled) return;
        setNamaGuru(data.namaGuru || fullName || "");
        setKelasField(data.kelas || kelas || "");
        setLevelField(data.level || jenjangOf(kelas) || "");
        setBulanField(data.bulan || bulan || "");
        setJumlahPertemuan(data.jumlahPertemuan || "");
        const paddedB = padRows(data.tableB, TABLE_B_ROWS_MAX, 3);
        setTableB(paddedB);
        setTableC(padRows(data.tableC, TABLE_C_ROWS, 4));
        // Kalau slot Bidang Ilmu ke-6/7/8 udah ada isinya (dari sheet), langsung tampilin —
        // jangan sampai data yang udah diisi guru ke-sembunyi di belakang tombol "Tambah".
        let lastFilled = TABLE_B_ROWS_DEFAULT - 1;
        paddedB.forEach((row, i) => {
          if (i >= TABLE_B_ROWS_DEFAULT && row.some((c) => c.trim())) lastFilled = i;
        });
        setBidangCount(lastFilled + 1);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.id, kelas]);

  async function handleSave() {
    if (!kelas || !file) return;
    setSaving(true);
    setError(null);
    setSaveMsg(null);
    // Kolom Pekan & Bidang Ilmu di tableC gak pernah diketik manual lagi (slotnya udah tetap per
    // posisi), jadi diisi otomatis di sini pas mau nulis ke sheet — 4 baris pertama = Bidang Ilmu
    // #1 Pekan 1-4, 4 baris berikutnya = Bidang Ilmu #2, dst.
    const tableCForSave = tableC.map((r, idx) => {
      const bidangIndex = Math.floor(idx / PEKAN_PER_BIDANG);
      const pekanNum = (idx % PEKAN_PER_BIDANG) + 1;
      return [String(pekanNum), tableB[bidangIndex]?.[0] ?? "", r[2], r[3]];
    });
    const payload: RpbTabData = {
      namaGuru,
      kelas: kelasField,
      level: levelField,
      bulan: bulanField,
      jumlahPertemuan,
      tableB,
      tableC: tableCForSave,
    };
    try {
      await writeRpbTab(file.id, kelas, payload);
      setSaveMsg("Tersimpan ke sheet (salinan uji coba).");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function setBRow(i: number, col: number, val: string) {
    setTableB((prev) => prev.map((r, ri) => (ri === i ? r.map((c, ci) => (ci === col ? val : c)) : r)));
  }
  function setCRow(i: number, col: number, val: string) {
    setTableC((prev) => prev.map((r, ri) => (ri === i ? r.map((c, ci) => (ci === col ? val : c)) : r)));
  }

  /** 5 slot Pekan tetap buat 1 Bidang Ilmu di Section B, berdasarkan POSISI (bukan cocokin teks) —
   *  Bidang Ilmu ke-`bidangIndex` selalu punya baris tableC[bidangIndex*5 .. +4]. Kolom Pekan &
   *  Bidang Ilmu gak perlu disimpan di sini (otomatis diisi pas Simpan), guru cuma isi Sub-Ilmu &
   *  Metode Pengajaran. */
  function weeklySlotsFor(bidangIndex: number) {
    const start = bidangIndex * PEKAN_PER_BIDANG;
    return Array.from({ length: PEKAN_PER_BIDANG }, (_, w) => ({
      idx: start + w,
      pekan: w + 1,
      subIlmu: tableC[start + w]?.[2] ?? "",
      metode: tableC[start + w]?.[3] ?? "",
    }));
  }

  if (!bulan || !file || !isMonthOpen(bulan)) {
    return <Navigate to="/rpb" replace />;
  }

  if (!kelas) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: C.mist }}>
        <p className="text-sm" style={{ color: C.muted }}>Kelas belum diset untuk akun ini.</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh" style={{ background: C.mist, color: C.ink }}>
      <div className="max-w-2xl mx-auto px-4 pt-6 sm:pt-9 pb-28">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/rpb/${bulan}`)}
            aria-label="Kembali"
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "#FFF", border: `1px solid ${C.line}`, color: C.green }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="min-w-0">
            <h1
              className="text-lg sm:text-xl font-semibold truncate"
              style={{ color: C.green, fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              Rencana Pembelajaran Bulanan — {bulan}
            </h1>
          </div>
        </div>

        {loading ? (
          <div className="mt-6">
            <PageLoadingSkeleton />
          </div>
        ) : (
          <div className="mt-6 space-y-7">
            {error && (
              <div className="rounded-xl px-3.5 py-2.5 text-xs" style={{ background: "#FDEBEA", border: "1px solid #E8A6A0", color: "#8A2A20" }}>
                {error}
              </div>
            )}

            {/* Informasi umum — kartu ringkasan (read-only) by default, tombol Edit buat masuk mode form */}
            {editingInfo ? (
              <div className="rounded-2xl p-4 sm:p-5" style={{ background: "#FFF", border: `1px solid ${C.line}` }}>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.leaf }}>
                      <BookIcon color={C.green} />
                    </span>
                    <div className="text-sm font-bold uppercase tracking-[0.1em]" style={{ color: C.green }}>
                      Informasi RPB
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingInfo(false)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full shrink-0"
                    style={{ background: C.leaf, color: C.green }}
                  >
                    Selesai
                  </button>
                </div>
                <div className="space-y-3.5">
                  <Field label="Nama Guru">
                    <input
                      value={namaGuru}
                      onChange={(e) => setNamaGuru(e.target.value)}
                      className="w-full text-sm outline-none px-3.5 py-2.5 rounded-xl"
                      style={{ border: `1px solid ${C.line}` }}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Kelas">
                      <input
                        value={kelasField}
                        onChange={(e) => setKelasField(e.target.value)}
                        className="w-full text-sm outline-none px-3.5 py-2.5 rounded-xl"
                        style={{ border: `1px solid ${C.line}` }}
                      />
                    </Field>
                    <Field label="Level">
                      <input
                        value={levelField}
                        onChange={(e) => setLevelField(e.target.value)}
                        className="w-full text-sm outline-none px-3.5 py-2.5 rounded-xl"
                        style={{ border: `1px solid ${C.line}` }}
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Bulan">
                      <input
                        value={bulanField}
                        onChange={(e) => setBulanField(e.target.value)}
                        className="w-full text-sm outline-none px-3.5 py-2.5 rounded-xl"
                        style={{ border: `1px solid ${C.line}` }}
                      />
                    </Field>
                    <Field label="Jumlah Pertemuan">
                      <input
                        value={jumlahPertemuan}
                        onChange={(e) => setJumlahPertemuan(e.target.value)}
                        className="w-full text-sm outline-none px-3.5 py-2.5 rounded-xl"
                        style={{ border: `1px solid ${C.line}` }}
                        placeholder="mis. 20 hari"
                      />
                    </Field>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="relative rounded-2xl p-4 sm:p-5"
                style={{ background: `linear-gradient(135deg, ${C.green} 0%, ${C.greenDeep} 100%)`, boxShadow: "0 4px 14px rgba(28,74,51,0.14)" }}
              >
                {/* Lingkaran dekorasi di lapisan terpisah — biar overflow-hidden-nya gak ikut motong teks di atasnya */}
                <div className="absolute inset-0 overflow-hidden rounded-2xl" aria-hidden="true">
                  <span
                    className="absolute -right-6 -top-6 w-28 h-28 rounded-full"
                    style={{ background: "rgba(255,255,255,0.08)" }}
                  />
                </div>
                <div className="relative flex items-center gap-3 mb-4">
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.16)" }}>
                    <BookIcon />
                  </span>
                  <div className="text-sm font-bold uppercase tracking-[0.1em]" style={{ color: "#FFF" }}>
                    Informasi RPB
                  </div>
                </div>
                <div className="relative">
                  <InfoValue label="Nama Guru" value={namaGuru} large />
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <InfoValue label="Kelas" value={kelasField} />
                    <InfoValue label="Level" value={levelField} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <InfoValue label="Bulan" value={bulanField} />
                    <InfoValue label="Jumlah Pertemuan" value={jumlahPertemuan} />
                  </div>
                </div>
                <div className="relative flex justify-end mt-4">
                  <button
                    onClick={() => setEditingInfo(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-full transition-shadow hover:shadow-md"
                    style={{ background: "rgba(255,255,255,0.16)", color: "#FFF" }}
                  >
                    <PencilIcon />
                    Edit
                  </button>
                </div>
              </div>
            )}

            {/* Section B: Target Pembelajaran */}
            <SectionHeading
              no="B"
              title="Target Pembelajaran"
              subtitle={`${bidangCount} bidang ilmu yang ditargetkan bulan ini`}
            />
            <div className="space-y-3">
              {tableB.slice(0, bidangCount).map((row, i) => (
                <EntryCard
                  key={i}
                  badge={<span>{i + 1}</span>}
                  onRemove={
                    i === bidangCount - 1 && bidangCount > TABLE_B_ROWS_DEFAULT
                      ? () => {
                          setBRow(i, 0, "");
                          setBRow(i, 1, "");
                          setBRow(i, 2, "");
                          for (let w = 0; w < PEKAN_PER_BIDANG; w++) {
                            setCRow(i * PEKAN_PER_BIDANG + w, 2, "");
                            setCRow(i * PEKAN_PER_BIDANG + w, 3, "");
                          }
                          setBidangCount((c) => c - 1);
                        }
                      : undefined
                  }
                >
                  <Field label="Bidang Ilmu" compact>
                    <input
                      value={row[0]}
                      onChange={(e) => setBRow(i, 0, e.target.value)}
                      className="w-full text-sm outline-none px-3 py-2 rounded-lg"
                      style={{ border: `1px solid ${C.line}` }}
                    />
                  </Field>
                  <Field label="Target Capaian" compact>
                    <textarea
                      value={row[1]}
                      onChange={(e) => setBRow(i, 1, e.target.value)}
                      rows={2}
                      className="w-full text-sm outline-none px-3 py-2 rounded-lg resize-none"
                      style={{ border: `1px solid ${C.line}` }}
                    />
                  </Field>
                  <Field label="Indikator Keberhasilan" compact>
                    <textarea
                      value={row[2]}
                      onChange={(e) => setBRow(i, 2, e.target.value)}
                      rows={2}
                      className="w-full text-sm outline-none px-3 py-2 rounded-lg resize-none"
                      style={{ border: `1px solid ${C.line}` }}
                    />
                  </Field>
                  <WeeklyBreakdown items={weeklySlotsFor(i)} onChange={setCRow} />
                </EntryCard>
              ))}
              {bidangCount < TABLE_B_ROWS_MAX && (
                <button
                  onClick={() => setBidangCount((c) => Math.min(c + 1, TABLE_B_ROWS_MAX))}
                  className="w-full flex items-center justify-center gap-2 text-sm font-semibold py-3 rounded-2xl transition-colors"
                  style={{ background: C.leaf, color: C.green, border: `1.5px dashed ${C.green}` }}
                >
                  <PlusIcon />
                  Tambah Bidang Ilmu
                </button>
              )}
            </div>

            {saveMsg && (
              <div className="rounded-xl px-3.5 py-2.5 text-xs" style={{ background: C.leaf, border: `1px solid ${C.green}`, color: C.green }}>
                {saveMsg}
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full text-sm font-semibold py-3.5 rounded-xl transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: C.green, color: "#FFF" }}
            >
              {saving ? "Menyimpan…" : "Simpan"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, compact }: { label: string; children: React.ReactNode; compact?: boolean }) {
  return (
    <label className="block">
      <span
        className={`block font-semibold uppercase tracking-wide ${compact ? "text-[10px] mb-1" : "text-xs mb-1"}`}
        style={{ color: C.muted }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function SectionHeading({ no, title, subtitle }: { no: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 px-1">
      <span
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
        style={{ background: C.leaf, color: C.green, fontFamily: "Georgia, serif" }}
      >
        {no}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-bold uppercase tracking-[0.1em]" style={{ color: C.green }}>{title}</div>
        <div className="text-xs" style={{ color: C.muted }}>{subtitle}</div>
      </div>
    </div>
  );
}

function EntryCard({
  badge,
  badgeLabel,
  children,
  onRemove,
}: {
  badge: React.ReactNode;
  badgeLabel?: string;
  children: React.ReactNode;
  onRemove?: () => void;
}) {
  return (
    <div
      className="relative rounded-2xl p-3.5 sm:p-4 flex gap-3 transition-shadow hover:shadow-md"
      style={{ background: "#FFF", border: `1px solid ${C.line}` }}
    >
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label="Hapus Bidang Ilmu ini"
          className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center transition-colors hover:opacity-70"
          style={{ background: "#FDEBEA", color: "#B3441C" }}
        >
          <TrashIcon />
        </button>
      )}
      <div className="shrink-0 flex flex-col items-center">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold"
          style={{ background: C.leaf, color: C.green }}
        >
          {badge}
        </div>
        {badgeLabel && (
          <span className="text-[9px] mt-1 uppercase tracking-wide" style={{ color: C.muted }}>{badgeLabel}</span>
        )}
      </div>
      <div className="flex-1 min-w-0 space-y-2.5">{children}</div>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7m2 0v13a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 20V7h10Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/** Rincian per-pekan di dalam kartu Bidang Ilmu (Section B) — format tetap 4 Pekan per Bidang
 *  Ilmu, biar guru gampang "recall" target minggu ini tanpa scroll ke bagian lain. Nomor Pekan-nya
 *  tetap (posisi 1-4, gak diketik manual); Sub-Ilmu & Metode Pengajaran yang diedit langsung di
 *  sini nulis balik ke baris tableC yang sesuai lewat `onChange` (`setCRow` dari parent) — satu
 *  sumber data, cuma ini tampilan turunannya per Bidang Ilmu. */
function WeeklyBreakdown({
  items,
  onChange,
}: {
  items: { idx: number; pekan: number; subIlmu: string; metode: string }[];
  onChange: (i: number, col: number, val: string) => void;
}) {
  return (
    <div className="pt-1">
      <span className="block text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: C.muted }}>
        Rincian per Pekan
      </span>
      <div className="grid grid-cols-2 gap-2">
        {items.map((it) => (
          <div key={it.idx} className="rounded-xl p-2.5" style={{ background: C.leaf, border: `1px solid ${C.line}` }}>
            <span
              className="inline-block text-xs font-semibold text-center px-2 py-1 rounded-md mb-2"
              style={{ background: C.green, color: "#FFF" }}
            >
              Pekan {it.pekan}
            </span>
            <input
              value={it.subIlmu}
              onChange={(e) => onChange(it.idx, 2, e.target.value)}
              placeholder="Sub-Ilmu"
              className="w-full text-xs outline-none px-2.5 py-1.5 rounded-md mb-1.5"
              style={{ background: "#FFF", border: `1px solid ${C.line}` }}
            />
            <textarea
              value={it.metode}
              onChange={(e) => onChange(it.idx, 3, e.target.value)}
              placeholder="Metode Pengajaran"
              rows={2}
              className="w-full text-xs outline-none px-2.5 py-1.5 rounded-md resize-none"
              style={{ background: "#FFF", border: `1px solid ${C.line}` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoValue({ label, value, large }: { label: string; value: string; large?: boolean }) {
  return (
    <div className="min-w-0">
      <span className="block text-[10px] font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.65)" }}>
        {label}
      </span>
      <span
        className={`block truncate mt-0.5 text-white ${large ? "text-base font-semibold" : "text-sm font-medium"}`}
      >
        {value || "—"}
      </span>
    </div>
  );
}

function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M4 20h4L18.5 9.5a2 2 0 0 0 0-2.83l-1.17-1.17a2 2 0 0 0-2.83 0L4 15.5V20Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M13 6l4.5 4.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function BookIcon({ color = "#FFF" }: { color?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 5.5c2-1 5-1 8 .5 3-1.5 6-1.5 8-.5v13c-2-1-5-1-8 .5-3-1.5-6-1.5-8-.5v-13Z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M12 6v13" stroke={color} strokeWidth="1.7" />
    </svg>
  );
}
