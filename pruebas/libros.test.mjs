/* ============================================================
   El libro de entradas y salidas, y lo que entra al mes.

   Santiago: «dejame tb sacar libros de estancias para cuando
   vengan las inspecciones» y «calcula lo que se gana por mes».

   Son dos cosas muy distintas:

   - EL LIBRO es una obligación legal del núcleo zoológico. Lo
     que lleva dentro no lo decidimos nosotros: lo dice el
     programa sanitario, y está en la §14.1 del diseño. Se
     alimenta SOLO de las reservas: nada se teclea dos veces.
   - LAS CUENTAS son para Santiago. Cuánto ha entrado, cuánto
     está comprometido y cuánto se ha quedado sin pagar.

   Y una regla que vale para los dos: llevan DNI y domicilio.
   Eso no lo ve nadie que no sea administración, y la puerta la
   vigila la base de datos.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const sinComentarios = t => t.replace(/^\s*--.*$/gm, "");
const aplanar = t => sinComentarios(t).replace(/\s+/g, " ");

const sql = aplanar(leer("db/libros.sql"));

/* ---------- El libro ---------- */
test("el libro existe y sólo lo abre administración", () => {
  assert.match(sql, /create or replace function libro_entradas_salidas/);
  assert.match(sql, /es_admin\(\)/);
  assert.match(sql, /security definer/,
    "tiene que cruzar reserva, perro y cliente: se salta RLS y vigila ella la puerta");
});

test("lleva lo que exige el registro, no lo que nos apetece", () => {
  /* §14.1 del diseño, sacado del programa sanitario del núcleo.
     Si falta un campo, la inspección lo va a echar en falta. */
  for (const campo of ["chip", "raza", "sexo", "capa", "fecha_nacimiento",
                       "estado_reproductivo", "dni", "domicilio", "telefono",
                       "recoge_nombre", "entrada", "salida"])
    assert.match(sql, new RegExp(campo), `al libro le falta ${campo}`);
});

test("lleva el estado sanitario del ingreso", () => {
  /* «Estado sanitario en el ingreso y fechas de últimas
     vacunaciones y desparasitaciones». */
  assert.match(sql, /sanidad/);
});

test("y las incidencias de la estancia", () => {
  assert.match(sql, /incidencia/);
});

test("no salen las reservas que nunca llegaron a ser estancia", () => {
  /* Una caducada sin pagar no es una entrada al núcleo: meterla
     en el libro sería declarar un animal que no estuvo. */
  assert.match(sql, /'en_curso','finalizada'/);
});

/* ---------- Las cuentas ---------- */
test("se puede saber lo que entra cada mes", () => {
  assert.match(sql, /create or replace function ingresos_por_mes/);
});

test("cobrado, comprometido y perdido se cuentan aparte", () => {
  /* Sumarlo todo junto daría un número que no es dinero: lo
     confirmado todavía puede cancelarse y lo caducado no llegó
     nunca. */
  assert.match(sql, /confirmado|comprometido/);
  assert.match(sql, /caducad/);
});

test("el mes se cuenta por la ENTRADA, no por cuándo se reservó", () => {
  /* Una reserva de agosto hecha en febrero es facturación de
     agosto: es cuando ocupa el box. */
  assert.match(sql, /date_trunc\('month', *r\.entrada\)/);
});

test("las cuentas tampoco las ve el cliente", () => {
  const cuentas = sql.match(/function ingresos_por_mes.*?end \$\$;/s)[0];
  assert.match(cuentas, /es_admin\(\)/);
});

/* ---------- Las pantallas ---------- */
test("el libro se puede imprimir", () => {
  /* La inspección pide papel o PDF. Con `@media print` basta:
     Cmd+P y «guardar como PDF». */
  const css = leer("css/estilo.css");
  assert.match(css, /@media print[^}]*\{[\s\S]*?\.libro/);
});

test("hay pantalla de libro y pantalla de cuentas", () => {
  const app = aplanar(leer("js/app.js"));
  assert.match(app, /admin-libro/);
  assert.match(app, /admin-cuentas/);
});

test("el libro dice de qué fechas es", () => {
  /* Un libro sin el periodo impreso no vale para enseñarlo. */
  const vista = aplanar(leer("js/vistas/admin-libro.js"));
  assert.match(vista, /desde/);
  assert.match(vista, /hasta/);
});

test("el libro se puede sacar a Excel, no sólo a papel", () => {
  /* La inspección a veces lo pide en papel y a veces lo quiere
     en un fichero. CSV lo abre Excel de doble clic. */
  const vista = aplanar(leer("js/vistas/admin-libro.js"));
  assert.match(vista, /Blob/);
  assert.match(vista, /download/);
  assert.match(vista, /csv/i);
});

test("el CSV lleva el punto y coma, no la coma", () => {
  /* El Excel español parte por punto y coma. Con comas, todo el
     libro cae en la primera columna y hay que explicarlo por
     teléfono. */
  const vista = leer("js/vistas/admin-libro.js");
  assert.match(vista, /";"/);
});

test("y lleva la marca del principio para que no se rompan las tildes", () => {
  /* Sin el BOM, Excel abre el CSV en Latin-1 y «Desparasitación»
     sale «DesparasitaciÃ³n». */
  const vista = leer("js/vistas/admin-libro.js");
  assert.match(vista, /\\uFEFF|\uFEFF/);
});
