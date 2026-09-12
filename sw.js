/* De momento no cachea nada. Está para que la PWA sea instalable;
   la caché llega en la fase 2, cuando haya pantallas que merezca
   la pena tener disponibles sin cobertura. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
