/// <reference lib="webworker" />

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<string | { revision: string | null; url: string }>
}

const SHARE_CACHE = 'm4a-share-target-v2'
const SHARE_ROUTE_PREFIX = '/shared-audio/'

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    void self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  if (request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith(handleShareTarget(request))
    return
  }

  if (request.method === 'GET' && url.pathname.startsWith(SHARE_ROUTE_PREFIX)) {
    event.respondWith(serveSharedAudio(request))
  }
})

async function handleShareTarget(request: Request) {
  try {
    const formData = await request.formData()
    const shared = formData.get('audio')

    if (!shared || !(shared instanceof File)) {
      return Response.redirect('/grabar?shareError=missing-file', 303)
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    const cacheKey = new Request(`${SHARE_ROUTE_PREFIX}${id}`)
    const cache = await caches.open(SHARE_CACHE)

    await cache.put(
      cacheKey,
      new Response(shared, {
        headers: {
          'Content-Type': shared.type || 'application/octet-stream',
          'X-File-Name': encodeURIComponent(shared.name || 'audio-compartido.m4a'),
        },
      })
    )

    const redirectUrl = `/grabar?sharedAudio=${encodeURIComponent(id)}&sharedName=${encodeURIComponent(shared.name || 'audio-compartido.m4a')}`
    return Response.redirect(redirectUrl, 303)
  } catch {
    return Response.redirect('/grabar?shareError=invalid-request', 303)
  }
}

async function serveSharedAudio(request: Request) {
  const cache = await caches.open(SHARE_CACHE)
  const match = await cache.match(request)

  if (!match) {
    return new Response('Not found', { status: 404 })
  }

  await cache.delete(request)
  return match
}
