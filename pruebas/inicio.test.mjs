/* ============================================================
   La pantalla de inicio, y los perros de los clientes.

   Santiago, 13/09/2026: «en la pantalla de inicio me dice que
   ahi aparecerean mis estancias, pero no aparece mi reserva».

   Tenía razón y era literal: el texto decía «Aquí irán tus
   estancias» y no había ninguna estancia. Una promesa escrita
   que no se cumple es peor que no prometer nada, porque el
   cliente se queda mirando la pantalla pensando que su reserva
   se ha perdido.

   Y lo otro que pidió: en «Mis perros» sólo los suyos —que ya
   era así—, y los de los clientes en su propio sitio, dentro de
   administración.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const aplanar = t => t.replace(/\s+/g, " ");
const app = aplanar(leer("js/app.js"));

test("el inicio enseña las estancias que vienen", () => {
  assert.match(app, /misReservas/);
});

test("y ya no promete algo que no enseña", () => {
  /* El texto viejo decía «Aquí irán tus estancias» sin enseñar
     ninguna. */
  const crudo = leer("js/app.js").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(crudo, /Aquí irán tus estancias/);
});

test("sin reservas, se dice y se ofrece reservar", () => {
  /* Una pantalla vacía sin salida es un callejón. */
  assert.match(app, /data-ir="reservar"/);
});

test("las pasadas no salen en el inicio", () => {
  /* El inicio es «qué tengo por delante», no el historial. */
  assert.match(app, /salida.*>=|>= *hoy|futuras/i);
});

/* ---------- Los perros de los clientes ---------- */
test("«Mis perros» sigue enseñando sólo los suyos", () => {
  /* Aunque administración pueda verlos todos por RLS, esta
     pantalla es la de sus perros. Mezclarlos ensucia además los
     avisos de vacunas del inicio. */
  const datos = leer("js/datos.js");
  const fn = datos.match(/export async function misPerros[\s\S]*?\n\}/)[0];
  assert.match(fn, /eq\("cliente_id", user\.id\)/);
});

test("hay una pantalla de administración con todos los perros", () => {
  assert.match(app, /admin-perros\.js/);
  const vista = aplanar(leer("js/vistas/admin-perros.js"));
  assert.match(vista, /perrosBuscando/);
});

test("se pueden buscar por nombre, chip o dueño", () => {
  /* Con doscientos perros, una lista sin buscador no sirve. */
  const datos = aplanar(leer("js/datos.js"));
  assert.match(datos, /export async function todosLosPerros/);
  assert.match(datos, /chip\.ilike|nombre\.ilike/);
});

test("desde ahí se ve de quién es cada perro", () => {
  /* Es lo que se viene a mirar: «este chip, ¿de quién es?». */
  const vista = aplanar(leer("js/vistas/admin-perros.js"));
  assert.match(vista, /cliente/);
});
