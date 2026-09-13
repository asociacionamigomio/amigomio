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
const VERSION = "2026-09-13-o";
const CACHE = `amigomio-${VERSION}`;

const LO_BASICO = [
  "./", "./index.html", "./css/estilo.css",
  "./js/config.js", "./js/app.js",
  "./assets/logo.png", "./manifest.webmanifest",
];

self.addEventListener("install", e => {
  /* Si no se puede llenar el caché, la instalación FALLA a
     propósito.
     
     Antes esto llevaba un `.catch(() => {})`: se instalaba igual
     con el caché a medias, y acto seguido `activate` borraba el
     viejo. Un móvil con mala cobertura en el momento justo se
     quedaba sin el caché viejo y sin el nuevo — y si abría la
     aplicación instalada, que arranca del caché, no abría nada.
     Le pasó a Santiago el 13/09/2026.

     Más vale seguir con la versión vieja, que funciona, que
     quedarse sin ninguna. */
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(LO_BASICO))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const todas = await caches.keys();

    /* ¿HABÍA algo antes? Sin ninguna caché vieja, esto es la
       primera instalación, no una actualización.

       Santiago entró por primera vez en un móvil y le salió «hay
       una versión nueva». Tenía razón en que no tenía sentido:
       la primera instalación TAMBIÉN es una activación, y se
       avisaba igual. Decirle eso a alguien que acaba de entrar
       es mentira, y de las que hacen dudar del resto. */
    const viejas = todas.filter(k => k !== CACHE);
    const primera = viejas.length === 0;

    await Promise.all(viejas.map(k => caches.delete(k)));
    await self.clients.claim();

    if (primera) return;   // nada que avisar

    /* Y se lo decimos a las pestañas que ya estaban abiertas:
       ellas deciden qué hacer, que pueden estar a media ficha. */
    const ventanas = await self.clients.matchAll({ type: "window" });
    for (const v of ventanas) v.postMessage({ version: VERSION, primera: false });
  })());
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  /* Nada de Supabase se guarda. Una disponibilidad de ayer
     enseñada como si fuera de hoy vende plazas que no existen. */
  if (url.hostname.endsWith("supabase.co") || e.request.method !== "GET") return;

  /* Y la página de rescate NUNCA pasa por aquí: sería el colmo
     que la página que arregla el service worker la sirviera el
     service worker roto. */
  if (url.pathname.endsWith("/reiniciar.html")) return;

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

/* ============================================================
   Los avisos en el móvil.

   El servidor manda un empujón y esto lo enseña. Va aquí y no
   en la página porque llega también con la aplicación cerrada:
   es lo que los hace útiles.
   ============================================================ */
self.addEventListener("push", e => {
  let datos = { titulo: "AmigoMío", cuerpo: "", ir: "/" };
  try {
    if (e.data) datos = { ...datos, ...e.data.json() };
  } catch {
    /* Sin datos legibles se enseña algo igual: una notificación
       vacía es mejor que ninguna, porque el navegador exige
       enseñar ALGO si se ha dado permiso. */
    datos.cuerpo = e.data?.text?.() || "Tienes un aviso.";
  }

  e.waitUntil(self.registration.showNotification(datos.titulo, {
    body: datos.cuerpo,
    icon: "./assets/icono-192.png",
    badge: "./assets/icono-192.png",
    /* Con la misma etiqueta, un aviso nuevo SUSTITUYE al viejo
       en vez de amontonarse. Tres avisos de la misma reserva en
       la pantalla de bloqueo es lo que hace que se apaguen. */
    tag: datos.tag || "amigomio",
    data: { ir: datos.ir || "/" },
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();

  /* Abrir la aplicación por el principio obliga a buscar de qué
     hablaba el aviso. Se abre donde toca, y si ya hay una
     ventana abierta se usa esa. */
  const destino = new URL(e.notification.data?.ir || "./", self.location.origin
    + self.location.pathname.replace(/sw\.js$/, "")).href;

  e.waitUntil((async () => {
    const abiertas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of abiertas) {
      if (c.url.startsWith(self.location.origin) && "focus" in c) {
        c.navigate?.(destino);
        return c.focus();
      }
    }
    return self.clients.openWindow(destino);
  })());
});
