import { supabase } from "./supabaseClient";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export type CapaianQuranStudent = { row: number; nama: string; values: string[] };

export type CapaianQuranSection = {
  name: string;
  type: "pertemuan" | "pekan";
  slotCount: number;
  firstDataRow: number;
  notesRow: number;
  students: CapaianQuranStudent[];
};

export type CapaianQuranData = {
  namaGuru: string;
  kelas: string;
  level: string;
  bulan: string;
  sections: CapaianQuranSection[];
};

/** Nama depan doang, lowercase, huruf dobel dirapetin ("Tsurayya"->"tsuraya", "Utrujjah"->"utrujah")
 *  — dipakai buat nyocokin santri ANTAR section/roster BY NAMA, bukan posisi baris. Tiap section
 *  (Talaqqi/Baghdadiyah/Tilawah/dst) di sheet asli bisa aja ditulis guru dalam urutan baris yang
 *  beda-beda (gak selalu sama urutan kayak SANTRI_LIST) — kalau dicocokin by posisi index doang,
 *  data 1 santri bisa ketuker sama santri lain (persis ini yang bikin diagram/rekap salah nunjuk
 *  punya siapa). Ejaan nama Arab-transliterasi sering beda dikit antar guru/section (huruf dobel,
 *  nama belakang beda kepanjangan), jadi cukup cocokin nama depan aja + rapetin huruf dobel biar
 *  toleran ke variasi ejaan kayak gitu. */
function normFirstName(name: string): string {
  const first = (name || "").trim().split(/\s+/)[0] || "";
  return first
    .toLowerCase()
    .replace(/['".,]/g, "")
    .replace(/(.)\1+/g, "$1");
}

/** Nama LENGKAP ternormalisasi (lowercase, tanda baca dibuang, spasi & huruf dobel dirapetin). */
function normFullName(name: string): string {
  return (name || "")
    .toLowerCase()
    .replace(/['".,\-’`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(.)\1+/g, "$1");
}

/** Petakan SETIAP santri di roster ke 1 baris di `section.students` — SATU LAWAN SATU: 1 baris
 *  sheet gak akan pernah dipakai 2 santri. Ini penting karena ada santri yang nama depannya sama
 *  dalam 1 kelas (mis. "Muhammad Fairuz" & "Muhammad Faqih...", "Fathimah Medina" & "Fathimah");
 *  kalau cuma cocokin nama depan, keduanya nunjuk ke baris yang sama dan data santri pertama
 *  muncul (lalu ke-simpan) di santri kedua.
 *  Urutan prioritas: (1) nama lengkap persis -> (2) nama depan sama TAPI cuma kalau di antara
 *  baris & santri yang belum kepetakan hanya ada 1 kandidat (gak ambigu) -> (3) baris di posisi
 *  yang sama, asal nama depannya sama & baris itu belum diambil. Sisanya -1 (belum ada baris). */
export function matchRosterToStudents(section: CapaianQuranSection, roster: string[]): number[] {
  const rows = section.students;
  const used = new Set<number>();
  const out: number[] = roster.map(() => -1);

  roster.forEach((r, i) => {
    const t = normFullName(r);
    if (!t) return;
    const j = rows.findIndex((st, k) => !used.has(k) && normFullName(st.nama) === t);
    if (j >= 0) { out[i] = j; used.add(j); }
  });

  roster.forEach((r, i) => {
    if (out[i] >= 0) return;
    const f = normFirstName(r);
    if (!f) return;
    const rosterSame = roster.filter((x, k) => out[k] < 0 && normFirstName(x) === f).length;
    const rowCands = rows.map((_, k) => k).filter((k) => !used.has(k) && normFirstName(rows[k].nama) === f);
    if (rosterSame === 1 && rowCands.length === 1) { out[i] = rowCands[0]; used.add(rowCands[0]); }
  });

  roster.forEach((r, i) => {
    if (out[i] >= 0) return;
    const f = normFirstName(r);
    if (f && i < rows.length && !used.has(i) && normFirstName(rows[i].nama) === f) { out[i] = i; used.add(i); }
  });

  return out;
}

const matchCache = new WeakMap<CapaianQuranSection, { roster: string[]; map: number[] }>();

/** Index baris sheet buat santri ke-`rosterIndex` di roster (-1 kalau belum ada barisnya).
 *  Hasil pemetaan di-cache per (section, roster) supaya konsisten & murah dipanggil per santri. */
export function studentIndexFor(section: CapaianQuranSection, roster: string[], rosterIndex: number): number {
  let c = matchCache.get(section);
  if (!c || c.roster !== roster) {
    c = { roster, map: matchRosterToStudents(section, roster) };
    matchCache.set(section, c);
  }
  return c.map[rosterIndex] ?? -1;
}

async function authHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${session?.access_token ?? SUPABASE_ANON_KEY}`,
  };
}

export async function readCapaianQuran(fileId: string, tab: string): Promise<CapaianQuranData> {
  const headers = await authHeaders();
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/sheet-capaian-quran?fileId=${encodeURIComponent(fileId)}&tab=${encodeURIComponent(tab)}`,
    { headers }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || `Gagal memuat Capaian Al-Qur'an (${res.status})`);
  return json.result as CapaianQuranData;
}

/** Tulis 1 slot (pertemuan/pekan ke-`slotIndex`, 1-based) untuk 1 section. */
export async function writeCapaianQuranSlot(params: {
  fileId: string;
  tab: string;
  sectionName: string;
  slotIndex: number;
  roster: string[];
  values: string[];
}): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/sheet-capaian-quran`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || `Gagal menyimpan Capaian Al-Qur'an (${res.status})`);
}
