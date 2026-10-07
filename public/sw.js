// Service worker: deja la app instalable, la abre sin conexión y muestra los
// avisos que llegan con la app cerrada.
const CACHE = 'haxmatch-v1'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add('/')).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  // Lo que atiende el servidor (/api/) nunca se guarda.
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return
  // Navegación: primero la red, y si no hay conexión, la app guardada.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/')))
    return
  }
  // Archivos de la app (tienen hash en el nombre): caché primero.
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) {
        const copia = res.clone()
        caches.open(CACHE).then((c) => c.put(req, copia))
      }
      return res
    })),
  )
})

// Llegó un aviso: se muestra como notificación del celular. Si la app está
// abierta y a la vista no hace falta, porque el aviso ya aparece adentro.
// (En iPhone se muestra siempre: Apple exige una notificación por cada aviso.)
const ES_IPHONE = /iphone|ipad|ipod/i.test(self.navigator.userAgent) ||
  (/macintosh/i.test(self.navigator.userAgent) && self.navigator.maxTouchPoints > 1)

self.addEventListener('push', (e) => {
  let aviso = {}
  try {
    aviso = e.data ? e.data.json() : {}
  } catch {
    aviso = {}
  }
  const mostrar = () => self.registration.showNotification(aviso.titulo || 'HaxMatch', {
    body: aviso.cuerpo || '',
    // Un aviso nuevo del mismo tipo reemplaza al anterior y vuelve a sonar.
    tag: aviso.tag || 'haxmatch',
    renotify: true,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: typeof aviso.url === 'string' && aviso.url.startsWith('/') ? aviso.url : '/' },
  })
  // El aviso de prueba se muestra siempre: es para comprobar que llega.
  if (ES_IPHONE || aviso.tag === 'prueba') {
    e.waitUntil(mostrar())
    return
  }
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then((ventanas) => (ventanas.some((v) => v.visibilityState === 'visible') ? undefined : mostrar()))
    .catch(mostrar))
})

// Tocaron la notificación: se abre la app en la pantalla que corresponde.
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const ruta = (e.notification.data && e.notification.data.url) || '/'
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
    const abierta = ventanas.find((v) => 'focus' in v)
    if (abierta) {
      abierta.postMessage({ tipo: 'abrir', ruta })
      return abierta.focus()
    }
    return self.clients.openWindow(ruta)
  }))
})
