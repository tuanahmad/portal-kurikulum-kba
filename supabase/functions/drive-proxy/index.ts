// DINONAKTIFKAN 2026-10-05 -- proxy unduh file Drive lama. Tidak ada kode aplikasi yang memanggilnya,
// dan fungsi ini mengunduh file Drive APA PUN lewat GOOGLE_API_KEY untuk siapa saja yang memegang anon key.
// Sengaja tidak dihapus total supaya ada jejak kenapa dimatikan.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(() =>
  new Response(JSON.stringify({ error: "dinonaktifkan - lihat komentar di source" }), {
    status: 410,
    headers: { "Content-Type": "application/json" },
  })
);
