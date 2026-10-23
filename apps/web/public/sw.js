/*
 * Swasthya offline support. All user data lives in localStorage, so caching the app shell and
 * static media is enough for the app to open and work without a connection.
 * - Pages: network first, falling back to the cached shell.
 * - Scripts, styles, fonts, images, voice clips: cache first (their URLs are hashed or versioned).
 * - Never cached: /api (AI needs the network) and videos (range requests; posters show offline).
 */
const VERSION = "swasthya-v1";
const SHELL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.add(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

const STATIC = /^\/(_next\/static|images|audio|brand|models)\//;

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.endsWith(".mp4")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(VERSION).then((cache) => cache.put(SHELL, response.clone()));
          return response;
        })
        .catch(() => caches.match(SHELL).then((cached) => cached || Response.error())),
    );
    return;
  }

  if (STATIC.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok && response.status === 200) {
              const copy = response.clone();
              caches.open(VERSION).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});

// The wind-down reminder opens (or focuses) the app.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => "focus" in w);
      return open ? open.focus() : self.clients.openWindow("/");
    }),
  );
});
