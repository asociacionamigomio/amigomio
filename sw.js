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
const VERSION = "2026-09-13-z";
const CACHE = `amigomio-${VERSION}`;

/* TODO lo que hace falta para abrir. No una parte.

   Antes aquí había siete ficheros y los otros treinta y cuatro se
   pedían a la red cada vez que se abría la aplicación: treinta y
   cuatro oportunidades de que fallara una, y basta una. Con mala
   cobertura pasa a la primera.

   Hay una prueba (`pruebas/arranque.test.mjs`) que salta si se
   añade un módulo nuevo y no se apunta aquí. */
const LO_BASICO = [
  "./", "./index.html", "./css/estilo.css", "./manifest.webmanifest",

  /* La librería de Supabase, dentro de casa. Ver js/vendor/LEEME.md. */
  "./js/vendor/supabase.js",

  "./js/config.js",
  "./js/app.js",
  "./js/contacto.js",
  "./js/datos.js",
  "./js/documentos.js",
  "./js/ficha.js",
  "./js/formularios.js",
  "./js/idioma.js",
  "./js/perro.js",
  "./js/push.js",
  "./js/sanidad.js",
  "./js/sesion.js",
  "./js/sonidos-clicker.js",
  "./js/zapatilla.js",

  "./js/vistas/actividades.js",
  "./js/vistas/admin-bloqueos.js",
  "./js/vistas/admin-clientes.js",
  "./js/vistas/admin-cuadro.js",
  "./js/vistas/admin-cuentas.js",
  "./js/vistas/admin-estancia.js",
  "./js/vistas/admin-hoja.js",
  "./js/vistas/admin-intereses.js",
  "./js/vistas/admin-libro.js",
  "./js/vistas/admin-perros.js",
  "./js/vistas/admin-solicitudes.js",
  "./js/vistas/admin-tarifas.js",
  "./js/vistas/admin-validar.js",
  "./js/vistas/clicker.js",
  "./js/vistas/contrasena-nueva.js",
  "./js/vistas/entrada.js",
  "./js/vistas/mi-ficha.js",
  "./js/vistas/mis-reservas.js",
  "./js/vistas/perros.js",
  "./js/vistas/reserva-hecha.js",
  "./js/vistas/reservar.js",
  "./js/vistas/vecinos.js",

  "./assets/logo.png",
  "./assets/icono-192.png",
  "./assets/icono-512.png",
  "./assets/zapatilla.png",
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

/* Cuánto se espera a la red teniendo el fichero guardado. Pasado
   ese plazo se sirve lo guardado y en paz: una aplicación que
   abre con lo de ayer es infinitamente mejor que una que no
   abre. La copia buena se guarda igual, para la próxima vez. */
const MARGEN = 3000;

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  /* Nada de Supabase se guarda. Una disponibilidad de ayer
     enseñada como si fuera de hoy vende plazas que no existen. */
  if (url.hostname.endsWith("supabase.co") || e.request.method !== "GET") return;

  /* Y la página de rescate NUNCA pasa por aquí: sería el colmo
     que la página que arregla el service worker la sirviera el
     service worker roto. */
  if (url.pathname.endsWith("/reiniciar.html")) return;

  /* Y la de revisar, por lo mismo: es la que averigua qué falla. */
  if (url.pathname.endsWith("/revisar.html")) return;

  /* Lo de fuera va derecho a la red, sin pasar por aquí. */
  if (url.origin !== location.origin) return;

  e.respondWith(servir(e.request));
});

async function servir(peticion) {
  const cache = await caches.open(CACHE);
  const guardado = await cache.match(peticion);

  const red = fetch(peticion).then(r => {
    if (r.ok) cache.put(peticion, r.clone());
    return r;
  });

  if (guardado) {
    /* Se le da un margen a la red, para traer lo último, y si no
       contesta se sirve lo guardado. Así abre igual con mala
       cobertura, que es donde se atascaba. */
    const plazo = new Promise(listo => setTimeout(() => listo(null), MARGEN));
    const r = await Promise.race([red.catch(() => null), plazo]);
    return r || guardado;
  }

  try {
    return await red;
  } catch (fallo) {
    /* LA PORTADA SÓLO VALE COMO RECAMBIO DE UNA NAVEGACIÓN.

       Antes se devolvía `index.html` para cualquier cosa que
       fallara. Si lo que se pedía era un módulo de JavaScript, el
       navegador recibía una página HTML donde esperaba código:
       error de sintaxis, la aplicación no arranca, y la pantalla
       se queda en «Cargando…» para siempre sin decir por qué.
       Santiago, 13/09/2026: «aparece cargando, pero no carga».

       Un módulo que no llega tiene que fallar COMO UN MÓDULO, y
       entonces el vigía de `index.html` lo cuenta. */
    if (peticion.mode === "navigate") {
      const portada = await cache.match("./index.html");
      if (portada) return portada;
    }
    throw fallo;
  }
}

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
