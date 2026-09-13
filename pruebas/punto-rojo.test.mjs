/* ============================================================
   El punto rojo, y que las cancelaciones se vean.

   Santiago, 13/09/2026: «he hecho una cancelación y no me avisa,
   creo que esa notificación debe salir en el menú de
   validaciones, puedes hacer que aparezca un punto rojo en los
   iconos del menú cuando tenga algo pendiente que resolver».

   Lo del aviso tiene explicación: la cancelación la hizo ÉL, que
   es administración, y el disparador se salta el correo a
   propósito —no se avisa a alguien de lo que acaba de hacer—.
   Pero ver que un box ha quedado libre es otra cosa, y tiene que
   estar en el panel.

   Y el punto rojo es la diferencia entre una aplicación que hay
   que ir a mirar y una que te dice cuándo mirarla. Sin él, «Por
   validar» sólo funciona si te acuerdas de entrar.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const sinComentarios = s => s.replace(/\/\*[\s\S]*?\*\//g, "");

const app = leer("js/app.js");
const datos = leer("js/datos.js");
const validar = leer("js/vistas/admin-validar.js");
const sql = leer("db/avisos-reserva.sql");

/* ---------- Las cancelaciones, a la vista ---------- */
test("una cancelación queda marcada como no vista", () => {
  assert.match(sql, /cancelacion_vista/);
  assert.match(sql, /add column if not exists cancelacion_vista/);
});

test("pero no si la has hecho tú", () => {
  /* Cancelas desde «Por validar» y te aparecería ahí mismo como
     algo pendiente de mirar. Absurdo. */
  const fn = sql.match(/function marcar_cancelacion_sin_ver[\s\S]*?\bend \$\$;/)[0];
  assert.match(fn, /es_admin\(\)/);
});

test("y sale en «Por validar»", () => {
  assert.match(datos, /cancelacion_vista/);
  assert.match(validar, /cancelad/i);
});

test("con un botón para darla por vista", () => {
  assert.match(validar, /data-visto/);
});

test("dice que el alojamiento ha quedado libre", () => {
  /* Es la única razón por la que corre: se puede volver a vender. */
  assert.match(validar, /libre/i);
});

/* ---------- El punto rojo ---------- */
test("el menú lleva punto en lo que tiene algo pendiente", () => {
  assert.match(app, /punto-pendiente|data-punto/);
  assert.match(datos, /export async function pendientes/);
});

test("el punto se pone DESPUÉS de pintar, no antes", () => {
  /* Si el menú esperara a contar lo pendiente para dibujarse, una
     consulta lenta dejaría la aplicación en blanco. Que es
     exactamente el fallo que nos costó dos días hoy. */
  const f = sinComentarios(app);
  const marco = f.match(/function pintarMarco[\s\S]*?\n\}/)[0];
  const pinta = marco.indexOf("app.innerHTML");
  const cuenta = marco.indexOf("ponerPuntos");
  assert.ok(pinta > -1 && cuenta > pinta,
    "primero se pinta el menú, y luego se le ponen los puntos");
});

test("y si no se pueden contar, el menú sale igual", () => {
  const f = sinComentarios(app);
  const fn = f.match(/async function ponerPuntos[\s\S]*?\n\}/)[0];
  assert.match(fn, /catch/,
    "un fallo contando no puede dejar sin menú a nadie");
});

test("contar lo pendiente aguanta una base vieja", () => {
  /* EL NAVEGADOR SE DESPLIEGA ANTES QUE LA BASE. SIEMPRE. */
  const fn = sinComentarios(datos)
    .match(/export async function pendientes[\s\S]*?\n\}/)[0];
  assert.match(fn, /catch|allSettled/);
});

test("el punto no sale en el menú del cliente por lo de administración", () => {
  /* Un cliente viendo un punto rojo en «Inicio» porque hay
     justificantes que validar sería desconcertante. */
  const f = sinComentarios(app);
  const fn = f.match(/async function ponerPuntos[\s\S]*?\n\}/)[0];
  assert.match(fn, /es_admin|ficha\?\.es_admin/);
});
