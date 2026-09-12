/* ============================================================
   Las tres pantallas de administración: el cuadro, la hoja del
   día y la ficha de la estancia.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lee = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const aplanar = t => t.replace(/\s+/g, " ");

/* En SQL hay que quitar además los `--` que abren cada línea de
   comentario: al aplastar los espacios se quedan en medio de la
   frase y ninguna búsqueda encaja. */
const aplanarSql = t => t.replace(/^\s*--\s?/gm, "").replace(/\s+/g, " ");

const sql    = aplanarSql(lee("db/administracion.sql"));
const cuadro = aplanar(lee("js/vistas/admin-cuadro.js"));
const hoja   = aplanar(lee("js/vistas/admin-hoja.js"));
const ficha  = aplanar(lee("js/vistas/admin-estancia.js"));
const app    = aplanar(lee("js/app.js"));
const datos  = aplanar(lee("js/datos.js"));

/* ---------- El cuadro ---------- */
test("el cuadro trae alojamientos, reservas y ocupación de una vez", () => {
  /* Una llamada y no tres: con 32 alojamientos por 30 días, ir a
     buscar cada cosa por separado se nota. */
  assert.match(sql, /create or replace function cuadro/i);
  assert.match(sql, /'alojamientos'[\s\S]{0,600}'reservas'[\s\S]{0,900}'ocupacion'/);
  assert.match(datos, /rpc\("cuadro"/);
});

test("el cuadro separa lo que se reserva de lo que se asigna", () => {
  /* Aislamiento y cachorros no los elige el cliente. */
  assert.match(cuadro, /\["normal", "especial"\]\.includes\(a\.tipo\)/);
  assert.match(cuadro, /No se reservan, se asignan/);
});

test("una reserva de varios días es UNA barra, no varias celdas", () => {
  assert.match(cuadro, /grid-column: span \$\{largo\}/);
});

test("el cuadro marca los perros con manejo de peligrosidad", () => {
  assert.match(sql, /'atencion'[\s\S]{0,200}agresivo_con_personas/);
  assert.match(cuadro, /r\.atencion \? "ojo"/);
});

test("y cuenta los perros que hay cada noche", () => {
  assert.match(sql, /perros_dentro/);
  assert.match(cuadro, /cuenta-dia/);
});

/* ---------- La hoja del día ---------- */
test("la hoja del día se puede imprimir de verdad", () => {
  /* Está pensada para colgarla en la nave, no para el móvil. */
  assert.match(hoja, /window\.print\(\)/);
  const css = lee("css/estilo.css");
  assert.match(css, /@media print/);
  assert.match(aplanar(css), /@media print \{ \.lateral, \.no-imprimir/,
    "al imprimir hay que quitar el menú y los botones");
  assert.match(aplanar(css), /\.hoja-perro \{ break-inside: avoid/,
    "y que un perro no se parta entre dos páginas");
});

test("la hoja lleva las tres casillas de los paseos", () => {
  /* El programa sanitario exige tres salidas diarias y anotarlo. */
  assert.match(hoja, /hoja-casillas/);
  assert.match(hoja, /Las tres casillas son los tres paseos/);
});

test("la hoja saca las marcas de manejo de cada perro", () => {
  assert.match(sql, /comilón/);
  assert.match(sql, /bebe muchísima agua/);
  assert.match(sql, /destroza cosas/);
  assert.match(sql, /no sale con machos/);
});

test("el perro con manejo de peligrosidad destaca en la hoja", () => {
  assert.match(hoja, /Siempre solo/);
  assert.match(hoja, /Lo maneja Santi o Elena/);
});

/* ---------- La ficha de la estancia ---------- */
test("se llega a la ficha pinchando en el cuadro", () => {
  assert.match(cuadro, /window\.verEstancia/);
  assert.match(app, /window\.verEstancia = rid/);
  assert.match(app, /oculta: true/, "y no sale en el menú: se llega desde el cuadro");
});

test("la ficha dice quién puede recoger al perro", () => {
  assert.match(ficha, /recoge_nombre/);
  assert.match(ficha, /DNI \$\{esc\(r\.cliente\.recoge_dni\)\} · pedirlo/);
  assert.match(ficha, /Solo el propietario/);
});

test("mover de alojamiento se fía de la base de datos, no comprueba antes", () => {
  /* La restricción de exclusión rechaza el solape: basta con
     contar lo que responde. Comprobar antes deja un hueco. */
  assert.match(datos, /exclusion\|solap/);
  assert.match(datos, /Ese alojamiento ya está ocupado esas noches/);
  assert.match(ficha, /la base de datos lo rechaza/);
});

test("el diario de la estancia lo lee el dueño y lo escribe administración", () => {
  assert.match(sql, /incidencia_la_lee_el_dueno/);
  assert.match(sql, /incidencia_la_pone_admin/);
  assert.match(sql, /es su derecho y le ahorra llamar/);
});

test("el diario es el germen del parte diario que exige el programa", () => {
  assert.match(sql, /observación mínima dos veces al día/);
});
