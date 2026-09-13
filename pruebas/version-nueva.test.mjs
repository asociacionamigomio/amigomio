/* ============================================================
   Que no se quede con una versión vieja.

   Santiago, 13/09/2026: «a mi me salen todos los perros, me
   tienen que salir solo los mios».

   El código estaba bien: comprobado en su ordenador,
   `misPerros()` le devolvía sólo el suyo. Donde los veía todos
   era en el MÓVIL, con la aplicación instalada y el JavaScript
   de hace dos días cargado en memoria.

   Eso ya no es una molestia de desarrollo: le estaba enseñando
   perros de otros clientes. Una aplicación que se actualiza
   sola en el escritorio y no en el móvil miente en el móvil.

   Cómo se arregla:

   - El service worker lleva VERSIÓN en el nombre del caché. Al
     cambiar, la vieja se tira entera.
   - Cuando entra una versión nueva, la página lo sabe y se lo
     dice al usuario con una barra. NO se recarga sola: podría
     estar rellenando la ficha de un perro y perderlo todo.
   - Y se comprueba al abrir y cada rato, porque una aplicación
     instalada puede estar semanas sin cerrarse.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const sw = leer("sw.js");
const app = leer("js/app.js");

test("el caché lleva versión, para poder tirarlo entero", () => {
  assert.match(sw, /const CACHE = `amigomio-\$\{VERSION\}`/);
  assert.match(sw, /const VERSION = "/);
});

test("la versión nueva echa a la vieja sin esperar", () => {
  /* `skipWaiting` sin `clients.claim` deja la página vieja
     mandando hasta que se cierre, que en una PWA instalada
     puede ser nunca. */
  assert.match(sw, /skipWaiting/);
  assert.match(sw, /clients\.claim/);
});

test("la página se entera de que hay una versión nueva", () => {
  assert.match(app, /updatefound|controllerchange/);
});

test("no se recarga sola: avisa", () => {
  /* Recargar por su cuenta a media ficha del perro le borraría
     lo escrito, y eso enfada más que el fallo que arregla. */
  assert.match(app, /hay-version-nueva|barra-version/);
  assert.match(app, /location\.reload/);
});

test("se comprueba cada rato, no sólo al abrir", () => {
  /* Una aplicación instalada en el móvil puede pasarse semanas
     sin cerrarse del todo. */
  assert.match(app, /registro\.update\(\)/);
  assert.match(app, /setInterval/);
});

test("lo que viene de Supabase sigue sin cachearse", () => {
  /* Enseñar una disponibilidad de ayer vende plazas que ya no
     existen. */
  assert.match(sw, /supabase\.co/);
});
