const SHARE_CACHE = "m4a-share-target-v1";
const SHARE_ROUTE_PREFIX = "/shared-audio/";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method === "POST" && url.pathname === "/share-target") {
    event.respondWith(handleShareTarget(request));
    return;
  }

  if (request.method === "GET" && url.pathname.startsWith(SHARE_ROUTE_PREFIX)) {
    event.respondWith(serveSharedAudio(request));
  }
});

async function handleShareTarget(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("audio");

    if (!file || !(file instanceof File)) {
      return Response.redirect("/grabar?shareError=missing-file", 303);
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const cacheKey = new Request(`${SHARE_ROUTE_PREFIX}${id}`);
    const cache = await caches.open(SHARE_CACHE);

    await cache.put(
      cacheKey,
      new Response(file, {
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "X-File-Name": encodeURIComponent(file.name || "audio-compartido"),
        },
      })
    );

    const redirectUrl = `/grabar?sharedAudio=${encodeURIComponent(id)}&sharedName=${encodeURIComponent(file.name || "audio-compartido")}`;
    return Response.redirect(redirectUrl, 303);
  } catch (error) {
    return Response.redirect("/grabar?shareError=invalid-request", 303);
  }
}

async function serveSharedAudio(request) {
  const cache = await caches.open(SHARE_CACHE);
  const match = await cache.match(request);

  if (!match) {
    return new Response("Not found", { status: 404 });
  }

  // One-time consume to avoid stale files in cache.
  await cache.delete(request);
  return match;
}
