/* ============================================================
   El navegador se despliega ANTES que la base de datos.

   Fallo real del 12/09/2026, en producción y con gente
   probando: la pantalla de reservar empezó a pedir
   `presupuesto(..., el_cliente)` para aplicar el descuento, se
   subió a GitHub Pages —que publica al segundo— y la base
   todavía tenía la función sin ese parámetro. Postgres
   respondió «Could not find the function public.presupuesto(...)
   in the schema cache» y NADIE pudo reservar.

   Las dos mitades NUNCA se despliegan a la vez:

     git push  -> el navegador, en segundos
     el SQL    -> cuando una persona lo pega en Supabase

   Así que la regla es: LO NUEVO DEL NAVEGADOR TIENE QUE
   FUNCIONAR CONTRA LA BASE VIEJA. Si un parámetro nuevo no
   existe todavía, se reintenta sin él y el cliente no se entera
   de nada — como mucho, no ve su descuento hasta que se aplique
   el SQL.

   PGRST202 es el código que devuelve PostgREST cuando no
   encuentra una función con esa firma.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const aplanar = t => t.replace(/\s+/g, " ");
const crudo = leer("js/datos.js");
const datos = aplanar(crudo);

/* Sobre el fuente SIN aplanar: para recortar una función hace
   falta la llave al principio de línea, y aplanar se las come. */
const laFuncion = nombre =>
  crudo.match(new RegExp(`export async function ${nombre}[\\s\\S]*?\\n\\}`))?.[0] ?? "";

test("si la base no conoce el parámetro nuevo, se reintenta sin él", () => {
  assert.match(datos, /PGRST202/,
    "hay que reconocer «no existe esa función» y reintentar");
});

test("el presupuesto se pide otra vez sin el cliente", () => {
  /* Perder el descuento un rato es un mal menor. Que nadie
     pueda reservar, no. */
  const fn = laFuncion("presupuesto");
  assert.ok(fn, "no se ha encontrado presupuesto() en js/datos.js");
  assert.match(fn, /PGRST202/);
});

test("el reintento no se traga otros errores", () => {
  /* «No hay sitio» o «la reserva mínima son dos noches» tienen
     que seguir llegando al cliente tal cual. */
  const fn = laFuncion("presupuesto");
  assert.match(fn, /error\?\.code === "PGRST202"/,
    "sólo ese código se reintenta; el resto llega al cliente tal cual");
});

test("guardar mi ficha aguanta que falte una columna nueva", () => {
  /* Mismo caso: la casilla de «avisadme por correo» escribe en
     `cliente.quiere_correos`, y esa columna llega con el SQL. Si
     no está, PostgREST responde PGRST204 y el cliente no puede
     guardar NADA de su ficha, ni el teléfono. */
  const fn = laFuncion("guardarMiFicha");
  assert.match(fn, /PGRST204/);
});

test("lo que no existe todavía no rompe la ficha del perro", () => {
  /* `documento_perro` es una tabla nueva. Si no está, la ficha
     del perro tiene que seguir abriéndose sin los papeles. */
  const fn = laFuncion("documentosDe");
  assert.match(fn, /return \[\]/,
    "sin la tabla, la lista de papeles se queda vacía y ya");
});

test("al cambiar los parámetros de una función, se tira la vieja", () => {
  /* `create or replace function` NO reemplaza si cambia la
     lista de parámetros: SOBRECARGA. Al añadir `el_cliente`
     quedaron dos `presupuesto` y Postgres abortó la instalación
     con «function presupuesto(...) is not unique». */
  const sql = leer("db/tarifas.sql").replace(/^\s*--.*$/gm, "");
  assert.match(sql, /drop function if exists presupuesto\(/,
    "hay que tirar la firma vieja antes de crear la nueva");
  assert.ok(sql.indexOf("drop function if exists presupuesto(")
          < sql.indexOf("create or replace function presupuesto("),
    "y tirarla ANTES");
});

test("los checks se rehacen, porque `if not exists` no los toca", () => {
  /* `create table if not exists` no modifica NADA de una tabla
     que ya existe: ni columnas, ni índices, ni restricciones. El
     estado `revisando` entró en el check del CREATE TABLE y en
     la base real seguía el check viejo:

       23514: new row for relation "reserva" violates check
              constraint "reserva_estado_check" */
  const sql = leer("db/reservas.sql").replace(/^\s*--.*$/gm, "");
  assert.match(sql, /alter table reserva drop constraint if exists reserva_estado_check/);
  assert.match(sql, /add constraint reserva_estado_check[\s\S]*?'revisando'/);
});
