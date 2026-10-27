/* Neerakshi service worker: offline fallback page, cached static assets and map data.
   API responses are never cached here (the app caches the last advisory itself). */
const VERSION = "nk-v1";
const SHELL = ["/offline", "/icon.svg", "/manifest.webmanifest", "/data/districts.topo.json", "/data/states.topo.json", "/data/india.topo.json", "/data/sky.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  // Navigations: network first, offline page as fallback
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("/offline")));
    return;
  }
  // Static assets and map data: cache first
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/data/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/vendor/")) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
