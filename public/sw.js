const CACHE_NAME = "tbr-static-v1";

function isStaticAsset(requestUrl, request) {
  return (
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "font" ||
    request.destination === "image" ||
    requestUrl.pathname.startsWith("/_next/static/") ||
    requestUrl.pathname === "/favicon.ico" ||
    requestUrl.pathname === "/manifest.webmanifest"
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!isStaticAsset(url, request)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) {
        // Revalidate in background to keep assets fresh.
        event.waitUntil(
          fetch(request)
            .then((res) => {
              if (res && res.ok) {
                return cache.put(request, res.clone());
              }
              return null;
            })
            .catch(() => null)
        );
        return cached;
      }

      const network = await fetch(request);
      if (network && network.ok) {
        await cache.put(request, network.clone());
      }
      return network;
    })()
  );
});
