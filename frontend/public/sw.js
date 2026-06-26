// Catarot service worker — minimal & update-safe.
// Strategy: network-first for navigations (always fresh when online),
// cache-first for hashed /assets/, stale-while-revalidate for other same-origin GETs.
// Cross-origin (backend API, Google, fonts) is never intercepted.
const CACHE = "catarot-v2";
const APP_SHELL = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

// CHỈ cache phản hồi same-origin THÀNH CÔNG. Nếu không, khi 1 file hash cũ bị xoá sau deploy,
// SPA fallback trả index.html (HTTP 200) → ta lỡ lưu HTML dưới URL .js/.css và (vì cache-first)
// app nạp HTML như script MÃI MÃI. Trong app đã cài (TWA) người dùng khó xoá dữ liệu → kẹt cứng.
const isCacheable = (res) => res && res.ok && res.type === "basic";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  // add() từng mục (allSettled) thay vì addAll() nguyên tử: 1 mục lỗi không làm rớt cả shell.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => Promise.allSettled(APP_SHELL.map((u) => c.add(u))))
      .catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Only same-origin: let API / Google / fonts pass straight through.
  if (url.origin !== self.location.origin) return;

  // Navigations → network-first: làm tươi shell "/" khi online, fallback shell khi offline.
  // Bọc fallback để respondWith KHÔNG bao giờ nhận undefined (gây TypeError → trang lỗi cứng).
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (isCacheable(res)) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put("/", copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match("/").then((r) => r || Response.error()))
    );
    return;
  }

  // Hashed build assets → cache-first (filenames change on every build).
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            if (isCacheable(res)) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
      )
    );
    return;
  }

  // Other same-origin GET (icons, etc.) → stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (isCacheable(res)) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
