// Service worker:
// 1) Web Push: nerima & nampilin notifikasi.
// 2) Kerangka aplikasi disimpan di HP (index.html + berkas /assets/ ber-hash), supaya aplikasi langsung terbuka
//    tanpa menunggu internet -- layar logo diam bawaan Android cuma sekejap, animasi pembuka langsung jalan.
//    Halaman selalu dicek ulang ke server di belakang layar; kalau ada versi baru, berkasnya disiapkan dulu lalu
//    halaman diberi tahu ("versi-baru") supaya muat ulang sekali (lihat src/lib/versiBaru.ts).
//    Permintaan ke Supabase / Google (beda domain) tidak disentuh sama sekali.

const SHELL = "portal-shell-v1";
const ASET = "portal-aset-v1";
const KUNCI_SHELL = "/index.html";
const MAKS_ASET = 250;
const POLA_UTAMA = /\/assets\/index-[A-Za-z0-9_-]+\.js/;
const POLA_ASET = /\/assets\/[A-Za-z0-9_.-]+\.(?:js|css)/g;

// Di localhost (pengembangan) tidak menyimpan apa-apa, biar perubahan kode langsung kelihatan.
const LOKAL = ["localhost", "127.0.0.1"].includes(self.location.hostname);

const bukanHtml = (res) => !(res.headers.get("content-type") || "").includes("text/html");

/** Simpan berkas /assets/ yang dirujuk HTML (kalau belum ada). Gagal satu tidak apa-apa. */
async function simpanAsetDari(html) {
  const aset = await caches.open(ASET);
  const urls = [...new Set(html.match(POLA_ASET) || [])];
  await Promise.all(
    urls.map(async (u) => {
      if (await aset.match(u)) return;
      try {
        const res = await fetch(u);
        if (res.ok && bukanHtml(res)) await aset.put(u, res);
      } catch {
        /* abaikan */
      }
    })
  );
}

async function rapikanAset(aset) {
  const keys = await aset.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - MAKS_ASET))) await aset.delete(k);
}

async function beriTahuVersiBaru() {
  const list = await self.clients.matchAll({ type: "window" });
  for (const c of list) c.postMessage({ type: "versi-baru" });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      if (!LOKAL) {
        try {
          const res = await fetch("/", { cache: "no-store" });
          if (res.ok && !bukanHtml(res)) {
            const html = await res.clone().text();
            await (await caches.open(SHELL)).put(KUNCI_SHELL, res);
            await simpanAsetDari(html);
          }
        } catch {
          /* offline saat pasang: nanti tersimpan di pembukaan berikutnya */
        }
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== SHELL && k !== ASET).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

/** Buka halaman: pakai kerangka yang tersimpan (instan), sambil ambil yang terbaru dari server di belakang layar. */
async function bukaHalaman(event) {
  const shell = await caches.open(SHELL);
  const lama = await shell.match(KUNCI_SHELL);
  const teksLama = lama ? await lama.clone().text() : null;

  const terbaru = (async () => {
    try {
      const res = await fetch("/", { cache: "no-store" });
      if (!res.ok || bukanHtml(res)) return null;
      const teksBaru = await res.clone().text();
      await shell.put(KUNCI_SHELL, res.clone());
      const utamaLama = teksLama?.match(POLA_UTAMA)?.[0];
      const utamaBaru = teksBaru.match(POLA_UTAMA)?.[0];
      if (utamaLama && utamaBaru && utamaLama !== utamaBaru) {
        await simpanAsetDari(teksBaru); // siapkan dulu supaya muat ulang juga cepat
        await beriTahuVersiBaru();
      }
      return res;
    } catch {
      return null;
    }
  })();

  if (lama) {
    event.waitUntil(terbaru);
    return lama;
  }
  return (await terbaru) || fetch(event.request);
}

/** Berkas /assets/ ber-hash tidak pernah berubah isinya: ambil dari HP kalau ada, kalau tidak dari server lalu simpan. */
async function asetTetap(req) {
  const aset = await caches.open(ASET);
  const ada = await aset.match(req);
  if (ada) return ada;
  const res = await fetch(req);
  // Berkas lama yang sudah hilang dari server dijawab index.html (rewrite) -- jangan disimpan sebagai aset.
  if (res.ok && bukanHtml(res)) aset.put(req, res.clone()).then(() => rapikanAset(aset));
  return res;
}

self.addEventListener("fetch", (event) => {
  if (LOKAL) return;
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    // Buka berkas langsung (mis. /manifest.json, gambar) biarkan ke server; selain itu halaman aplikasi.
    if (/\.[a-z0-9]+$/i.test(url.pathname)) return;
    event.respondWith(bukaHalaman(event));
    return;
  }
  if (url.pathname.startsWith("/assets/")) event.respondWith(asetTetap(req));
});

self.addEventListener("push", (event) => {
  let data = { title: "Portal Guru", body: "Ada pengingat baru.", url: "/home" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // biarkan default kalau payload bukan JSON valid
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/home" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/home";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
