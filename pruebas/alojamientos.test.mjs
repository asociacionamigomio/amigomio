/* ============================================================
   Las tarifas NO se escriben en el código. Viven en una tabla que
   Santiago edita desde su panel, porque el día que suba el precio
   de la noche no puede depender de que alguien le publique una
   versión nueva de la web.

   Lo mismo los alojamientos y los festivos.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lee = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const sql = lee("db/tarifas.sql");

test("están las cinco tablas del motor", () => {
  for (const t of ["alojamiento", "festivo", "tarifa", "extra", "ajuste"])
    assert.match(sql, new RegExp(`create\\s+table\\s+(if\\s+not\\s+exists\\s+)?${t}\\b`, "i"),
      `falta la tabla ${t}`);
});

test("los alojamientos tienen los cuatro tipos del diseño", () => {
  for (const tipo of ["normal", "especial", "aislamiento", "cachorros"])
    assert.match(sql, new RegExp(`'${tipo}'`), `falta el tipo ${tipo}`);
});

test("un alojamiento se puede sacar de servicio sin borrarlo", () => {
  /* El día que un box esté en obras hay que poder quitarlo del
     cuadro sin perder su historial. */
  assert.match(sql, /alojamiento[\s\S]{0,400}activo\s+boolean/i);
});

test("ningún precio está escrito a fuego en el código de la app", () => {
  const app = ["js/sanidad.js", "js/perro.js", "js/formularios.js", "js/datos.js"]
    .map(lee).join("\n");
  for (const importe of ["15", "18", "25", "35"]) {
    const re = new RegExp(`(precio|tarifa|importe|coste)[^\\n]{0,30}\\b${importe}\\b`, "i");
    assert.doesNotMatch(app, re, `el precio ${importe} no puede vivir en el código`);
  }
});

test("las tarifas son filas, y están todas las del diseño", () => {
  for (const clave of ["base_entre_semana", "base_finde", "base_festivo", "base_navidad",
                       "especial_dia", "segundo_perro", "tercer_perro", "curas_dia",
                       "fuera_horario_semana", "fuera_horario_finde", "fuera_horario_noche",
                       "minimo_noches"])
    assert.match(sql, new RegExp(`'${clave}'`), `falta la tarifa ${clave}`);
});

test("todo el mundo lee las tarifas, pero solo administración las cambia", () => {
  /* El cliente necesita leerlas para ver lo que va a pagar. */
  assert.match(sql, /create\s+policy[\s\S]{0,160}on\s+tarifa[\s\S]{0,80}for\s+select/i);
  assert.match(sql, /create\s+policy[\s\S]{0,160}on\s+tarifa[\s\S]{0,120}es_admin\(\)/i);
});

test("los extras distinguen quién cobra", () => {
  /* Los servicios de la veterinaria los factura ella, y no pueden
     entrar en el importe que se transfiere a AmigoMío. */
  assert.match(sql, /lo_cobra[\s\S]{0,80}'veterinaria'/i);
});

test("las cinco tablas llevan RLS", () => {
  for (const t of ["alojamiento", "festivo", "tarifa", "extra", "ajuste"])
    assert.match(sql, new RegExp(`alter\\s+table\\s+${t}\\s+enable\\s+row\\s+level\\s+security`, "i"),
      `${t} se ha quedado sin RLS`);
});
