// Proxy baca-list isi folder Google Drive (rekursif) — dipakai biar guru gak perlu
// buka Drive langsung buat cari file. API key disimpan sebagai Supabase secret
// (Project Settings -> Edge Functions -> Secrets -> GOOGLE_API_KEY), BUKAN hardcode
// di source ini — supaya gak ke-expose walau repo-nya public.
//
// Bisa terima beberapa folderId sekaligus (dipisah koma) biar klien cuma perlu
// 1 request buat semua folder Instrumen Ilmu, dan tiap level sub-folder di-fetch
// PARALEL (bukan satu-satu) biar folder yang berlapis (kayak Qonuni) gak lambat.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
const FOLDER_MIME = "application/vnd.google-apps.folder";
const MAX_DEPTH = 4; // top folder yang diminta + sampai 3 level sub-folder di bawahnya

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DriveItem = { id: string; name: string; mimeType: string };
type Node =
  | { type: "file"; id: string; name: string; mimeType: string }
  | { type: "folder"; id: string; name: string; children: Node[] };

async function listChildren(folderId: string): Promise<DriveItem[]> {
  const fields = "files(id,name,mimeType)";
  const q = `'${folderId}' in parents and trashed = false`;
  const url =
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}` +
    `&fields=${encodeURIComponent(fields)}&pageSize=200&key=${GOOGLE_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Drive API error ${res.status}`);
  const json = await res.json();
  return json.files ?? [];
}

async function buildTree(folderId: string, depth: number): Promise<Node[]> {
  const items = await listChildren(folderId);

  // Semua item di level ini di-proses BARENGAN — sub-folder gak nunggu sub-folder
  // sebelah selesai dulu.
  const nodes = await Promise.all(
    items.map(async (item): Promise<Node> => {
      if (item.mimeType === FOLDER_MIME) {
        const children = depth < MAX_DEPTH ? await buildTree(item.id, depth + 1) : [];
        return { type: "folder", id: item.id, name: item.name, children };
      }
      return { type: "file", id: item.id, name: item.name, mimeType: item.mimeType };
    })
  );

  nodes.sort((a, b) => (a.type !== b.type ? (a.type === "folder" ? -1 : 1) : a.name.localeCompare(b.name, "id")));
  return nodes;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!GOOGLE_API_KEY) {
    return new Response(JSON.stringify({ error: "GOOGLE_API_KEY belum di-set di Supabase secrets" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const raw = url.searchParams.get("folderIds") || url.searchParams.get("folderId");
  if (!raw) {
    return new Response(JSON.stringify({ error: "folderIds wajib diisi" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const folderIds = raw.split(",").map((s) => s.trim()).filter(Boolean);

  try {
    // Tiap folder top-level juga di-fetch paralel, bukan satu-satu.
    const entries = await Promise.all(
      folderIds.map(async (id) => [id, await buildTree(id, 1)] as const)
    );
    const result: Record<string, Node[]> = Object.fromEntries(entries);
    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
