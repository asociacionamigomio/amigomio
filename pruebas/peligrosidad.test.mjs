/* ============================================================
   Quién decide que un perro necesita manejo de peligrosidad.

   Si lo decide el dueño marcando una casilla, no lo marca nadie:
   nadie quiere pagar 35 € al día ni que le digan que su perro es
   un problema. El cliente cuenta lo que ha pasado; AmigoMío
   clasifica.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lee = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const sql = lee("db/peligrosidad.sql");

test("la clasificación la protege un trigger, no la pantalla", () => {
  assert.match(sql, /create\s+(or\s+replace\s+)?function\s+perro_peligrosidad_la_marca_admin/i);
  assert.match(sql, /before insert or update on perro/i,
    "tiene que valer tanto al dar de alta como al editar");
});

test("un cliente no puede declarar peligroso a su propio perro", () => {
  assert.match(sql, /new\.agresivo_con_personas\s*:=\s*false/,
    "al dar de alta se fuerza a falso");
  assert.match(sql, /new\.agresivo_con_personas\s*:=\s*old\.agresivo_con_personas/,
    "al editar se deja como estaba");
});

test("el cliente sí puede contar lo que ha pasado", () => {
  assert.match(sql, /incidentes_con_personas/);
  assert.match(sql, /ha_mordido/);
});

test("lo que declara el cliente NO decide la tarifa", () => {
  assert.match(sql, /NO decide la tarifa/);
});

test("la raza no entra en la decisión", () => {
  /* Un PPP puede ser un trozo de pan y un mestizo de 12 kilos
     puede necesitar manejo especial. */
  assert.match(sql, /La raza da igual/);
  assert.doesNotMatch(sql, /es_ppp[\s\S]{0,120}agresivo_con_personas/,
    "ser PPP no puede implicar manejo de peligrosidad");
});

test("las pruebas del SQL limpian lo que crean", () => {
  assert.match(sql, /delete from perro where id = p/);
});

test("el formulario del cliente ya no lleva la casilla de peligrosidad", () => {
  /* Le preguntamos qué ha pasado, no si su perro es peligroso.
     Nadie marca esa casilla si marcarla cuesta 35 euros al día. */
  const vista = readFileSync(new URL("../js/vistas/perros.js", import.meta.url), "utf8");
  assert.doesNotMatch(vista, /data-campo="agresivo_con_personas"/,
    "el cliente no puede marcar esa casilla");
  assert.match(vista, /data-campo="ha_mordido"/, "pero sí declarar si ha mordido");
  assert.match(vista, /data-campo="incidentes_con_personas"/, "y contarlo con sus palabras");
  assert.match(vista, /Lo decidimos nosotros/,
    "y hay que decírselo claro: la clasificación no es suya");
});
