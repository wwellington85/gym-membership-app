const CACHE_NAME = "tbr-static-branded-cards-v2";

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

// Always display user-visible pushes; payloads contain no private member details.
self.addEventListener("push", event => {
  let data={};try{data=event.data?event.data.json():{};}catch{}
  const tag=typeof data.tag==="string"&&/^reward-[0-9a-f-]{36}$/i.test(data.tag)?data.tag:"travellers-reward";
  event.waitUntil(self.registration.showNotification("A little thank-you from Travellers",{
    body:"A new reward is waiting for you. Open the app to see your gift.",
    icon:"/icons/icon-192.png",badge:"/icons/icon-192.png",tag,
    data:{url:"/member/benefits#member-rewards"}
  }));
});
self.addEventListener("notificationclick", event => {
 event.notification.close();
 event.waitUntil((async()=>{
   const url=new URL("/member/benefits#member-rewards",self.location.origin).href;
   const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
   const existing=windows.find(client=>new URL(client.url).origin===self.location.origin);
   if(existing){await existing.navigate(url);return existing.focus();}
   return self.clients.openWindow(url);
 })());
});
