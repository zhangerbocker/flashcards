// Offline support: built assets are cached once fetched; pages load from the network when
// possible and fall back to the last copy offline (progress lives in local storage, so
// flashcards keep working). API responses are never cached.
const CACHE = "hsk-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

function cacheable(response) {
  return response.ok && !response.redirected && response.type === "basic";
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (cacheable(response)) await cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (cacheable(response)) await cache.put(request, response.clone());
    return response;
  } catch (err) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/_next/static/") || /\.(png|ico|webmanifest)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  } else if (request.mode === "navigate" || url.searchParams.has("_rsc")) {
    event.respondWith(networkFirst(request));
  }
});
