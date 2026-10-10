// Service worker: deja la app instalable, la abre sin conexión y muestra los
// avisos que llegan con la app cerrada.
const CACHE = 'haxmatch-v2'

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
  // El resto (íconos, manifiesto, páginas fijas): primero la red, así un cambio se ve enseguida.
  if (!url.pathname.startsWith('/assets/')) {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) {
        const copia = res.clone()
        caches.open(CACHE).then((c) => c.put(req, copia))
      }
      return res
    }).catch(() => caches.match(req)))
    return
  }
  // Archivos de la app (tienen hash en el nombre, nunca cambian): caché primero.
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

// Llegó un aviso: se muestra como notificación del celular o de la computadora.
// Si la persona está usando la app en ese momento (la ventana tiene el foco) no hace
// falta, porque el aviso ya aparece adentro. En la computadora, una pestaña abierta
// pero tapada por otra ventana no cuenta: ahí sí se muestra, como un mensaje más.
// (En iPhone se muestra siempre: Apple exige una notificación por cada aviso.)
const ES_IPHONE = /iphone|ipad|ipod/i.test(self.navigator.userAgent) ||
  (/macintosh/i.test(self.navigator.userAgent) && self.navigator.maxTouchPoints > 1)
const ES_COMPU = !ES_IPHONE && !/android|mobile/i.test(self.navigator.userAgent)

// La app pregunta qué versión de este archivo está funcionando, para saber si ya
// puede confiar en que le va a contar cuando llegue el aviso de prueba.
const VERSION = 2
self.addEventListener('message', (e) => {
  if (e.data && e.data.tipo === 'version' && e.ports && e.ports[0]) e.ports[0].postMessage({ version: VERSION })
})

/** Le cuenta a la app abierta que el aviso de prueba llegó a este dispositivo, y si se pudo mostrar. */
const contarPrueba = (mostrado) => self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  .then((ventanas) => ventanas.forEach((v) => v.postMessage({ tipo: 'aviso-recibido', tag: 'prueba', mostrado })))
  .catch(() => {})

self.addEventListener('push', (e) => {
  let aviso = {}
  try {
    aviso = e.data ? e.data.json() : {}
  } catch {
    aviso = {}
  }
  const prueba = aviso.tag === 'prueba'
  const mostrar = () => self.registration.showNotification(aviso.titulo || 'HaxMatch', {
    // El de prueba dice dónde llegó, porque sale a la vez hacia todos los dispositivos de la cuenta.
    body: prueba
      ? `Si ves esto, los avisos de HaxMatch funcionan en ${ES_COMPU ? 'esta computadora' : 'este celular'}.`
      : aviso.cuerpo || '',
    // Un aviso nuevo del mismo tipo reemplaza al anterior y vuelve a sonar.
    tag: aviso.tag || 'haxmatch',
    renotify: true,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: typeof aviso.url === 'string' && aviso.url.startsWith('/') ? aviso.url : '/' },
  })
  // El aviso de prueba se muestra siempre: es para comprobar que llega. Y la app se
  // entera de que llegó hasta acá, así puede decir si el problema está antes o después.
  if (prueba) {
    e.waitUntil(mostrar().then(() => contarPrueba(true), () => contarPrueba(false)))
    return
  }
  if (ES_IPHONE) {
    e.waitUntil(mostrar())
    return
  }
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then((ventanas) => (ventanas.some((v) => v.focused) ? undefined : mostrar()))
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
