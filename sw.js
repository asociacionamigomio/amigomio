/* ============================================================
   Service worker.

   Hace dos cosas:

   1. Permite que la app se pueda INSTALAR en el móvil. Chrome no
      ofrece instalar una web cuyo service worker no intercepta
      peticiones, aunque tenga manifiesto e iconos. Por eso existe
      el `fetch` de abajo: sin él, el botón de instalar no aparece
      nunca y no hay forma de saber por qué.

   2. Guarda lo justo para que la app abra sin cobertura. Lo que
      viene de Supabase NO se guarda: enseñar una disponibilidad
      vieja sería peor que no enseñar nada.
   ============================================================ */
/* La VERSIÓN. Cámbiala cuando haya que forzar que todo el mundo
   se traiga lo nuevo.

   Con esto el caché entero cambia de nombre, el viejo se tira en
   `activate`, y la página se entera de que hay versión nueva y
   se lo dice al usuario.

   Hizo falta el 13/09/2026: en el móvil de Santiago, con la
   aplicación instalada, seguía corriendo el JavaScript de dos
   días antes y le enseñaba perros de otros clientes. Una
   aplicación que se actualiza en el escritorio y no en el móvil
   miente en el móvil. */
const VERSION = "2026-09-13-c";
const CACHE = `amigomio-${VERSION}`;

const LO_BASICO = [
  "./", "./index.html", "./css/estilo.css",
  "./js/config.js", "./js/app.js",
  "./assets/logo.png", "./manifest.webmanifest",
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(LO_BASICO))
      .catch(() => {})          // si algo no está, se instala igual
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      /* Y se lo decimos a las pestañas que ya estaban abiertas:
         ellas deciden qué hacer, que pueden estar a media
         ficha. */
      .then(() => self.clients.matchAll({ type: "window" }))
      .then(cs => cs.forEach(c => c.postMessage({ version: VERSION })))
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  /* Nada de Supabase se guarda. Una disponibilidad de ayer
     enseñada como si fuera de hoy vende plazas que no existen. */
  if (url.hostname.endsWith("supabase.co") || e.request.method !== "GET") return;

  e.respondWith(
    fetch(e.request)
      .then(r => {
        if (r.ok && url.origin === location.origin) {
          const copia = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copia));
        }
        return r;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match("./index.html")))
  );
});
