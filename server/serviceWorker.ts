// Service worker for the web app: lets the installed app open without a
// connection. The app keeps its data on the device, so only the app
// shell and its static files need caching.
//
// - page navigations: network first (online users always get the
//   current version); the last good copy is used only when offline
// - /_expo/static/*: content-hashed build output, cached on first use
//   and served from cache; old builds are pruned
// - /assets/*, manifest: served from cache, refreshed in the background
// - /api/* and cross-origin requests: never touched
//
// Bump VERSION to drop every cache on the next activation.
const VERSION = "v2";

export const serviceWorkerSource = `
const VERSION = ${JSON.stringify(VERSION)};
const SHELL_CACHE = "gbolo-shell-" + VERSION;
const STATIC_CACHE = "gbolo-static-" + VERSION;
const SHELL_KEY = "/__shell";
const MAX_STATIC_ENTRIES = 80;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) =>
        fetch("/", { cache: "reload", credentials: "same-origin" }).then((res) => {
          if (res.ok) return cache.put(SHELL_KEY, res);
        }),
      )
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("gbolo-") && k !== SHELL_CACHE && k !== STATIC_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function trimStatic(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_STATIC_ENTRIES; i++) {
    await cache.delete(keys[i]);
  }
}

async function handleNavigation(request) {
  try {
    const res = await fetch(request);
    const type = res.headers.get("content-type") || "";
    if (res.ok && type.includes("text/html")) {
      const copy = res.clone();
      caches.open(SHELL_CACHE).then((c) => c.put(SHELL_KEY, copy)).catch(() => {});
    }
    return res;
  } catch (err) {
    const cached = await caches.match(SHELL_KEY, { cacheName: SHELL_CACHE });
    if (cached) return cached;
    throw err;
  }
}

async function handleHashed(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) {
    cache.put(request, res.clone()).then(() => trimStatic(cache)).catch(() => {});
  }
  return res;
}

async function handleRefreshing(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone()).catch(() => {});
      return res;
    })
    .catch(() => undefined);
  if (hit) return hit;
  const res = await network;
  if (res) return res;
  return Response.error();
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
  } else if (url.pathname.startsWith("/_expo/static/")) {
    event.respondWith(handleHashed(request));
  } else if (
    url.pathname.startsWith("/assets/") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(handleRefreshing(request));
  }
});
`;
