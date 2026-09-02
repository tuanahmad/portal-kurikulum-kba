// One-off admin script: rebuild Supabase Auth users for username+PIN login.
// Run with SUPABASE_SERVICE_ROLE_KEY set as an env var for this invocation only.
// Does NOT read/write the key to any file.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://mdircukjmvfdpbhynqfj.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY env var");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Existing accounts to remove (captured in .backup-before-auth-migration-2026-09-02.json)
const OLD_USER_IDS = [
  "f22fc04a-b720-42e2-8568-b67a4439aad8",
  "5fe80c2e-b85b-497c-9a0d-9a2d1e5344cb",
  "d3cdaa30-1f6f-4d78-b286-1ea7d9a7fe45",
  "241de58e-7d92-4576-adbc-41768ce5eb00",
  "f7056b27-2949-40ad-8ecc-40c6fadb0c11",
  "437f4efc-91b7-4fdf-9872-e1361dd74cc5",
  "752f3fda-49d1-427b-a729-5b405dc9238d",
  "5bf9290e-d793-46ae-8186-c8c45c29ff09",
  "0ca905f6-fdd4-410c-a410-9b257a2f2e0e",
  "90bb7cc7-6100-4e2f-b045-2a8588deaac4",
  "73da9e43-ee0f-4990-958c-5e2bbb90b033",
  "89d2c6f0-0b2c-4c92-94ea-20418b937111",
  "881d2ecd-af59-43ac-a230-452dc86db4ca",
  "0f345f4d-9a0e-4f93-9ee2-f798ee92f319",
  "b48730b9-d1cf-4173-9dcb-3e00ce7fe8b4",
  "8cf73a91-1de4-4604-94b4-ff9444b4c677",
  "68bbdaec-28e5-474b-9ef9-481cdf06f2d2",
  "0bd9c63a-3747-494e-ab77-028b77c8a362",
];

const DOMAIN = "kba.invalid"; // RFC 2606 reserved domain, guaranteed non-routable — never actually emailed
const GURU_PIN = "244342";
const MGMT_PIN = "244342";

const KELAS = [
  ["awalsatu", "Kuttab Awwal 1"],
  ["awaldua", "Kuttab Awwal 2"],
  ["awaltigaikhwan", "Kuttab Awwal 3 Ikhwan"],
  ["awaltigaakhwat", "Kuttab Awwal 3 Akhwat"],
  ["qonunisatuikhwan", "Qonuni 1 Ikhwan"],
  ["qonunisatuakhwat", "Qonuni 1 Akhwat"],
  ["qonuniduaikhwan", "Qonuni 2 Ikhwan"],
  ["qonuniduaakhwat", "Qonuni 2 Akhwat"],
  ["qonunitigaikhwan", "Qonuni 3 Ikhwan"],
  ["qonunitigaakhwat", "Qonuni 3 Akhwat"],
  ["qonuniempatikhwan", "Qonuni 4 Ikhwan"],
  ["qonuniempatakhwat", "Qonuni 4 Akhwat"],
];

async function main() {
  console.log("--- Deleting old users ---");
  for (const id of OLD_USER_IDS) {
    const { error } = await admin.auth.admin.deleteUser(id);
    console.log(id, error ? `FAILED: ${error.message}` : "deleted");
  }

  console.log("--- Creating guru accounts ---");
  const created = [];
  for (const [username, kelasName] of KELAS) {
    const email = `${username}@${DOMAIN}`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: GURU_PIN,
      email_confirm: true,
      user_metadata: { full_name: kelasName },
    });
    if (error) {
      console.log(username, "FAILED:", error.message);
      continue;
    }
    created.push({ username, email, id: data.user.id, kelas: kelasName });
    console.log(username, "-> created", data.user.id);
  }

  console.log("--- Creating management account ---");
  const mgmtEmail = `managementkba@${DOMAIN}`;
  const { data: mgmtData, error: mgmtErr } = await admin.auth.admin.createUser({
    email: mgmtEmail,
    password: MGMT_PIN,
    email_confirm: true,
    user_metadata: { full_name: "Management" },
  });
  if (mgmtErr) {
    console.log("management FAILED:", mgmtErr.message);
  } else {
    console.log("managementkba -> created", mgmtData.user.id);
  }

  console.log("\n=== SUMMARY (JSON) ===");
  console.log(JSON.stringify({ created, management: mgmtData?.user?.id ?? null }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
