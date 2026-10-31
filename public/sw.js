/*
 * MoodReel's service worker: lets the home-screen app open without a connection.
 *
 * - Pages: network first. Saved, History and the start screens are kept from
 *   your last visit, so they open offline; anything else falls back to /offline.
 * - Next's built files (/_next/static, hashed, never change): cache first.
 * - Posters and covers: kept as they're seen, so offline pages have pictures.
 * - Never touched: POSTs (Server Actions), /api, and Next's own data requests,
 *   which Next retries itself when the connection returns.
 *
 * Everything lives on this device only. Signing out deletes the kept pages.
 */

const VERSION = "v2";
const STATIC = `moodreel-static-${VERSION}`;
const PAGES = "moodreel-pages";
const IMAGES = "moodreel-images";
const OFFLINE_URL = "/offline";
const KEEP_PAGES = new Set(["/saved", "/history", "/movies", "/series", "/books", "/settings"]);
const IMAGE_HOSTS = new Set(["image.tmdb.org", "covers.openlibrary.org"]);
const MAX_IMAGES = 400;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC)
      .then(async (cache) => {
        await cache.addAll(["/icons/icon-192.png", "/manifest.webmanifest"]);
        await keepOfflinePage(cache);
      })
      .then(() => self.skipWaiting()),
  );
});

/**
 * The offline page, and every script and stylesheet it loads: with only its
 * HTML kept, it showed for a moment and then broke into an error screen when
 * its scripts couldn't load.
 */
async function keepOfflinePage(cache) {
  const response = await fetch(OFFLINE_URL, { cache: "reload" });
  if (!response.ok) throw new Error(`/offline answered ${response.status}`);
  const html = await response.clone().text();
  await cache.put(OFFLINE_URL, response);
  const assets = new Set(html.match(/\/_next\/static\/[^"'\\\s)>]+/g) ?? []);
  await cache.addAll([...assets]);
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("moodreel-static-") && k !== STATIC).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  // Sent on sign-out: nothing personal stays on the device.
  if (event.data === "forget-pages") event.waitUntil(caches.delete(PAGES));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith("/api/") || request.headers.get("RSC")) return;
    if (request.mode === "navigate") {
      event.respondWith(page(request, url));
      return;
    }
    if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
      event.respondWith(cacheFirst(request));
    }
    return;
  }

  if (IMAGE_HOSTS.has(url.hostname) && request.destination === "image") {
    event.respondWith(image(request));
  }
});

async function page(request, url) {
  try {
    const response = await fetch(request);
    if (response.ok && !response.redirected && KEEP_PAGES.has(url.pathname)) {
      const cache = await caches.open(PAGES);
      await cache.put(url.pathname, response.clone());
    }
    return response;
  } catch {
    const kept = await caches.match(url.pathname, { cacheName: PAGES });
    return kept ?? (await caches.match(OFFLINE_URL, { cacheName: STATIC })) ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request, { cacheName: STATIC });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC);
    await cache.put(request, response.clone());
  }
  return response;
}

async function image(request) {
  const cache = await caches.open(IMAGES);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok || response.type === "opaque") {
      await cache.put(request, response.clone());
      const keys = await cache.keys();
      if (keys.length > MAX_IMAGES) await Promise.all(keys.slice(0, keys.length - MAX_IMAGES).map((k) => cache.delete(k)));
    }
    return response;
  } catch {
    return Response.error();
  }
}
