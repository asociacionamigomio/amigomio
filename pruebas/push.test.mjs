/* ============================================================
   Avisos en el móvil.

   Santiago, 13/09/2026: notificaciones push, primero para los
   clientes.

   Por qué hacen falta: el correo del recordatorio de la víspera
   se lee a veces; una notificación en el móvil se ve siempre. Y
   el aviso que más dinero salva —«tu reserva se suelta en unas
   horas»— es justo el que llega tarde por correo.

   CÓMO FUNCIONA, en cristiano:

   1. El navegador pide permiso al usuario. Si dice que no, se
      acabó: no hay vuelta atrás ni forma de insistir.
   2. Si dice que sí, el navegador da una DIRECCIÓN suya —un
      «endpoint»— y dos claves. Eso se guarda en la base.
   3. El servidor manda el aviso a esa dirección, firmado con
      una clave que sólo él tiene (VAPID). Sin la firma, el
      navegador lo rechaza.

   Tres cosas que no son evidentes:

   - EL PERMISO NO SE PIDE AL ENTRAR. Un permiso pedido sin
     contexto se deniega, y una vez denegado no se puede volver
     a pedir. Se pide cuando el cliente dice que lo quiere.
   - LAS SUSCRIPCIONES CADUCAN SOLAS. El navegador las tira
     cuando le parece. Una que falla con 404 o 410 se borra: no
     es un error, es que ese móvil ya no está.
   - EN IPHONE SÓLO FUNCIONAN CON LA APP INSTALADA en la
     pantalla de inicio. En Safari normal, Apple no las permite.
     Eso hay que decirlo, no dejar que lo descubran.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const sinComentarios = t => t.replace(/^\s*--.*$/gm, "");
const aplanar = t => sinComentarios(t).replace(/\s+/g, " ");

const sql = aplanar(leer("db/push.sql"));
const push = leer("js/push.js");
const sw = leer("sw.js");

test("las suscripciones se guardan, con RLS", () => {
  assert.match(sql, /create table if not exists suscripcion_push/);
  assert.match(sql, /alter table suscripcion_push enable row level security/);
});

test("cada uno sólo toca las suyas", () => {
  /* La dirección de un navegador es un dato personal: con ella
     se le puede mandar lo que sea a ese móvil. */
  assert.match(sql, /cliente_id = auth\.uid\(\)/);
});

test("el mismo navegador no se guarda dos veces", () => {
  /* Entrar otra vez no puede duplicar la suscripción: llegarían
     dos avisos iguales. */
  assert.match(sql, /unique/);
});

test("el permiso NO se pide al entrar", () => {
  /* Un permiso pedido sin contexto se deniega, y denegado no se
     puede volver a pedir: se pierde para siempre. */
  assert.doesNotMatch(leer("js/app.js"), /Notification\.requestPermission/);
  assert.match(push, /requestPermission/);
});

test("se avisa de lo del iPhone antes de que lo descubran", () => {
  const ficha = leer("js/vistas/mi-ficha.js");
  assert.match(ficha, /iPhone|iOS/);
  assert.match(ficha, /instalad|pantalla de inicio/i);
});

test("si el usuario ya dijo que no, se explica qué hacer", () => {
  /* «Denegado» no se puede revertir desde la página: hay que
     ir a los ajustes del navegador. Si no se dice, el botón
     parece roto. */
  assert.match(push, /denied/);
  assert.match(push, /ajustes|Ajustes/);
});

test("el service worker sabe enseñar la notificación", () => {
  assert.match(sw, /addEventListener\("push"/);
  assert.match(sw, /showNotification/);
});

test("y al tocarla, lleva a donde toca", () => {
  /* Una notificación que abre la aplicación por el principio
     obliga a buscar de qué hablaba. */
  assert.match(sw, /notificationclick/);
  assert.match(sw, /clients\.openWindow|\.focus\(\)/);
});

test("una suscripción muerta se borra sola", () => {
  /* Los navegadores las tiran cuando les parece. Un 404 o un
     410 no es un error: es que ese móvil ya no está. */
  const fn = leer("supabase/functions/avisos/index.ts");
  assert.match(fn, /404|410/);
});

test("la clave privada no está en el repositorio", () => {
  /* La pública sí: va en el navegador y para eso está. La
     privada vive en los secretos de Edge Functions. */
  /* Sin comentarios: uno de ellos NOMBRA la privada para decir
     dónde vive, que es justo lo que hay que documentar. Lo que
     no puede estar es un valor. */
  const config = leer("js/config.js").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(config, /VAPID_PRIVAD|PRIVATE_KEY/i,
    "la clave privada no puede estar en el repositorio: es público");
  assert.match(config, /VAPID_PUBLICA/, "la pública sí, que va al navegador");
  const fn = leer("supabase/functions/avisos/index.ts");
  assert.match(fn, /Deno\.env\.get\("VAPID_PRIVADA"\)|VAPID_PRIVADA/);
});

test("el cliente puede apagarlas", () => {
  /* Si no se puede parar, es spam. Igual que los correos. */
  assert.match(push, /desuscribir|quitarPush|unsubscribe/i);
});
