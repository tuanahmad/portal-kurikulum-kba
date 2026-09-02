// One-off: pecah akun "awalsatu" (Kuttab Awwal 1) jadi 2 rombel terpisah — 1A & 1B,
// masing-masing guru beda, PIN sama. Run dengan SUPABASE_SERVICE_ROLE_KEY di env var.
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

const OLD_AWALSATU_ID = "c0892fd6-56cb-4244-9943-f0408c70ca71";
const DOMAIN = "kba.invalid";
const PIN = "244342";

const NEW_ACCOUNTS = [
  ["awalsatua", "Kuttab Awwal 1A"],
  ["awalsatub", "Kuttab Awwal 1B"],
];

async function main() {
  console.log("--- Deleting old awalsatu account ---");
  const { error: delErr } = await admin.auth.admin.deleteUser(OLD_AWALSATU_ID);
  console.log(OLD_AWALSATU_ID, delErr ? `FAILED: ${delErr.message}` : "deleted");

  console.log("--- Creating 1A & 1B accounts ---");
  const created = [];
  for (const [username, kelasName] of NEW_ACCOUNTS) {
    const email = `${username}@${DOMAIN}`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: PIN,
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

  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify(created, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
