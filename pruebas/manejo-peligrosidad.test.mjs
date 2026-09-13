/* ============================================================
   Manejo de peligrosidad: cambia el MANEJO, no el alojamiento.

   Santiago, 13/09/2026: «usamos esos alojamientos normales para
   los perros de manejo peligroso, lo que varía es el manejo y las
   demandas de esos perros pero no la ubicación física. Y no es
   especial, es "manejo peligrosidad"».

   Hasta hoy `crear_reserva` los mandaba a un alojamiento de tipo
   `especial`, que además llevaba tarifa plana de 35 €. Eran dos
   cosas metidas en una sola palabra, y al quitar la tarifa
   especial se quedaron los perros con manejo de peligrosidad SIN
   PODER RESERVAR: no había ningún alojamiento de ese tipo.

   Lo que sí se mantiene, y no es negociable: VA SIEMPRE SOLO. No
   comparte alojamiento con nadie. Eso no es una tarifa, es
   seguridad.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const sinComentarios = s => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*--.*$/gm, "");

test("no se le fuerza un tipo de alojamiento distinto", () => {
  const sql = sinComentarios(leer("db/crear-reserva.sql"));
  assert.doesNotMatch(sql, /tipo := 'especial'/,
    "la ubicación física es la misma que la de cualquier perro");
});

test("pero sigue yendo SIEMPRE SOLO", () => {
  /* Esto no es una tarifa, es seguridad. */
  const sql = leer("db/crear-reserva.sql");
  assert.match(sql, /va siempre solo/i);
  assert.match(sql, /agresivo_con_personas/);
});

test("el navegador tampoco pide un tipo especial", () => {
  const js = sinComentarios(leer("js/vistas/reservar.js"));
  assert.doesNotMatch(js, /hayAgresivo \? "especial"/,
    "pediría un alojamiento que ya no existe y no encontraría sitio");
});

test("y no se le llama «especial» al cliente", () => {
  /* Se llama «manejo de peligrosidad», que es lo que es. */
  const ficha = leer("js/vistas/perros.js");
  const trozo = ficha.match(/manejo de peligrosidad[\s\S]{0,400}/i)[0];
  assert.doesNotMatch(trozo, /tarifa especial/i,
    "ya no hay tarifa especial: decirlo es cobrarle de mentira");
});

test("se le dice lo que SÍ cambia: el manejo", () => {
  const ficha = leer("js/vistas/perros.js");
  assert.match(ficha, /siempre solo/i);
});
