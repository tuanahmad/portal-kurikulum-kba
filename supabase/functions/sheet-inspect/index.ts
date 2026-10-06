// DINONAKTIFKAN 2026-10-05 -- tool admin sementara (dump/copy/split tab sheet lewat service account).
// Fungsi lama ini verify_jwt:false dan TANPA pengecekan akses apa pun, padahal service account-nya punya
// hak ubah ke sheet produksi: siapa saja yang tahu URL + ID sheet (ID ada di kode aplikasi) bisa membaca
// isi sheet, menyalin file, atau menggandakan/menghapus tab. Tidak ada kode aplikasi yang memanggilnya.
// Sengaja tidak dihapus total supaya ada jejak kenapa dimatikan. Kalau perlu alat serupa lagi, buat baru
// dengan verify_jwt:true + cek role management di dalamnya.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(() =>
  new Response(JSON.stringify({ error: "dinonaktifkan - lihat komentar di source" }), {
    status: 410,
    headers: { "Content-Type": "application/json" },
  })
);
