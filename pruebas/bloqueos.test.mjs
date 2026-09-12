/* ============================================================
   Bloquear fechas.

   Santiago: «me tiene que dejar bloquear fechas de reserva en
   uno, en varios o en todos los box que esten disponibles».

   Para qué sirve, más allá de lo evidente (obras, desinfección,
   vacaciones): es lo que permite CONVIVIR CON WIX sin vender
   dos veces la misma noche. Los boxes que se dejan a Wix se
   bloquean aquí y la aplicación no los toca.

   Tres reglas:

   1. UN BLOQUEO SIN ALOJAMIENTO SON TODOS. Es lo que se quiere
      decir con «cerramos del 24 al 26»: no se elige box por box.
   2. NO SE PUEDE BLOQUEAR LO QUE YA ESTÁ RESERVADO. Si no, se
      le vende a alguien y luego se le quita, y eso es una
      llamada muy desagradable.
   3. LO IMPIDE LA BASE, NO LA PANTALLA. Un bloqueo que sólo
      comprueba el navegador no bloquea nada: Zapatilla y el
      panel entran por otra puerta.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const sinComentarios = t => t.replace(/^\s*--.*$/gm, "");
const aplanar = t => sinComentarios(t).replace(/\s+/g, " ");

/* La tabla vive en reservas.sql y lo que se hace con ella en
   bloqueos.sql: una función no puede hablar de una tabla que se
   crea en un fichero posterior. */
const sql = aplanar(leer("db/bloqueos.sql") + "\n" + leer("db/reservas.sql"));

test("los bloqueos viven en su tabla, con RLS", () => {
  assert.match(sql, /create table if not exists bloqueo/);
  assert.match(sql, /alter table bloqueo enable row level security/);
});

test("un bloqueo sin alojamiento vale para todos", () => {
  /* «Cerramos del 24 al 26» no se dice box por box. */
  assert.match(sql, /alojamiento_id integer references alojamiento/,
    "tiene que poder quedarse vacío, y eso significa «todos»");
  assert.match(sql, /b\.alojamiento_id is null or b\.alojamiento_id/,
    "y al consultarlo, un bloqueo sin alojamiento tiene que valer para todos");
});

test("el cliente los ve, pero sólo administración los pone", () => {
  /* Verlos hace falta para explicarle por qué no hay sitio.
     Ponerlos, no. */
  assert.match(sql, /create policy bloqueo_lo_ve_cualquiera/);
  assert.match(sql, /create policy bloqueo_solo_admin/);
});

test("no se bloquea lo que ya está reservado", () => {
  /* Vendérselo a alguien y luego quitárselo es una llamada muy
     desagradable. */
  assert.match(sql, /create or replace function bloquear_fechas/);
  assert.match(sql, /ya (hay|está|tiene)|reservad/i);
});

test("la disponibilidad los tiene en cuenta", () => {
  const reservas = aplanar(leer("db/reservas.sql"));
  assert.match(reservas, /bloqueo/,
    "hay_sitio tiene que descartar lo bloqueado");
});

test("y la base impide crear una reserva encima, no sólo la pantalla", () => {
  /* Un bloqueo que sólo comprueba el navegador no bloquea nada:
     Zapatilla y el panel entran por otra puerta. */
  assert.match(sql, /create or replace function reserva_no_pisa_bloqueo/);
  assert.match(sql, /create trigger reserva_no_pisa_bloqueo/);
});

test("el último día del bloqueo está cerrado, y el siguiente no", () => {
  /* `hasta` es inclusive: es el último día CERRADO. Con las
     reservas, que van [entrada, salida), esto cuadra: un perro
     que se va el 24 no choca con un bloqueo que empieza el 24,
     porque esa noche ya no duerme aquí. */
  assert.match(sql, /la_noche >= b\.desde/);
  assert.match(sql, /la_noche <= b\.hasta/);
});

test("se puede quitar un bloqueo", () => {
  assert.match(sql, /bloqueo_solo_admin on bloqueo for all/);
});

/* ---------- La pantalla ---------- */
test("hay pantalla para ponerlos y quitarlos", () => {
  const app = aplanar(leer("js/app.js"));
  assert.match(app, /admin-bloqueos/);
  const vista = aplanar(leer("js/vistas/admin-bloqueos.js"));
  assert.match(vista, /bloquearFechas/);
  assert.match(vista, /quitarBloqueo/);
});

test("se puede elegir uno, varios o todos", () => {
  const vista = aplanar(leer("js/vistas/admin-bloqueos.js"));
  assert.match(vista, /todos/i);
  assert.match(vista, /checkbox|data-aloj/,
    "para elegir varios hace falta poder marcarlos");
});

test("la pantalla explica para qué sirve con Wix", () => {
  /* Es la razón por la que se hizo ahora, y el que lo lea dentro
     de un año tiene que saberlo. */
  const vista = leer("js/vistas/admin-bloqueos.js");
  assert.match(vista, /Wix/);
});
