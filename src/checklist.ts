import { supabase } from "./supabaseClient";

export type ChecklistSection = "rpb" | "refleksi";

/** Peta status checklist milik satu guru: key `${section}:${fileId}` -> checked */
export async function getMyChecklist(userId: string): Promise<Map<string, boolean>> {
  const { data, error } = await supabase
    .from("fill_checklist")
    .select("file_id, section, checked")
    .eq("user_id", userId);
  if (error) throw error;

  const map = new Map<string, boolean>();
  for (const row of data || []) map.set(`${row.section}:${row.file_id}`, row.checked);
  return map;
}

export async function setChecked(
  userId: string,
  fileId: string,
  section: ChecklistSection,
  checked: boolean
): Promise<void> {
  const { error } = await supabase.from("fill_checklist").upsert(
    {
      user_id: userId,
      file_id: fileId,
      section,
      checked,
      checked_at: checked ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,file_id" }
  );
  if (error) throw error;
}

/** Ubah local-part email jadi nama panggilan yang lebih enak dibaca, mis. "budi.ashari01" -> "Budi Ashari" */
function prettifyEmail(email: string): string {
  const local = email.split("@")[0];
  const cleaned = local.replace(/[0-9]+$/g, "").replace(/[._-]+/g, " ").trim();
  if (!cleaned) return local;
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export interface GuruChecklistRow {
  userId: string;
  fullName: string;
  entries: Map<string, boolean>; // key `${section}:${fileId}`
}

/** Rekap checklist semua guru — hanya bisa dipanggil oleh akun management (dijaga RLS). */
export async function getAllChecklist(): Promise<GuruChecklistRow[]> {
  const { data: guruList, error: guruErr } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "guru");
  if (guruErr) throw guruErr;

  const { data: rows, error: rowsErr } = await supabase
    .from("fill_checklist")
    .select("user_id, file_id, section, checked");
  if (rowsErr) throw rowsErr;

  return (guruList || []).map((g) => {
    const entries = new Map<string, boolean>();
    for (const row of rows || []) {
      if (row.user_id === g.id) entries.set(`${row.section}:${row.file_id}`, row.checked);
    }
    const fallback = g.email ? prettifyEmail(g.email) : "(belum ada nama)";
    return { userId: g.id, fullName: g.full_name || fallback, entries };
  });
}

/** Ambil nama profil sendiri (buat ditampilkan/diedit di halaman guru) */
export async function getMyName(userId: string): Promise<string> {
  const { data, error } = await supabase.from("profiles").select("full_name").eq("id", userId).single();
  if (error) throw error;
  return data?.full_name || "";
}

/** Guru ganti nama sendiri lewat fungsi database (cuma bisa ubah nama, bukan role) */
export async function updateMyName(newName: string): Promise<void> {
  const { error } = await supabase.rpc("update_my_name", { new_name: newName });
  if (error) throw error;
}
