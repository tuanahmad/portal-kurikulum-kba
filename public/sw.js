// Service worker minimal — cuma buat nerima Web Push & nampilin notifikasi. Gak nge-cache apa-apa
// (bukan buat offline support), jadi gak perlu install/activate handler khusus.

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
