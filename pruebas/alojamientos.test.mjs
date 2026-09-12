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

test("el SQL lleva sus propias pruebas de precios dentro", () => {
  /* Aquí no hay Postgres para probar contra él, así que el fichero
     se prueba a sí mismo al aplicarlo. Esta prueba existe para que
     nadie borre esas aserciones "porque molestan". */
  assert.match(sql, /create\s+or\s+replace\s+function\s+precio_noche/i);
  assert.match(sql, /do \$\$[\s\S]*?assert precio_noche/i,
    "el fichero tiene que comprobarse a sí mismo al aplicarse");
});

test("las pruebas del precio cubren los casos que importan", () => {
  const casos = [
    [/precio_noche\('2026-08-11','normal'\)\s*=\s*15/, "un día entre semana"],
    [/precio_noche\('2026-08-08','normal'\)\s*=\s*18/, "un sábado"],
    [/precio_noche\('2026-12-24','normal'\)\s*=\s*25/, "Nochebuena"],
    [/precio_noche\('2027-01-01','normal'\)\s*=\s*25/, "Año Nuevo"],
    [/precio_noche\('2026-12-25','especial'\)\s*=\s*35/, "que el especial no sube en Navidad"],
    [/la víspera de un festivo/, "la víspera de un festivo"],
  ];
  for (const [re, que] of casos)
    assert.match(sql, re, `falta comprobar ${que}`);
});

test("la escalera de precios respeta el orden del diseño", () => {
  /* Navidad antes que festivo, festivo antes que finde. Si se
     invierte, el 25 de diciembre pasaría a cobrarse a 18. */
  const f = sql.slice(sql.indexOf("function precio_noche"));
  const navidad = f.indexOf("base_navidad");
  const festivo = f.indexOf("base_festivo");
  const finde   = f.indexOf("base_finde");
  const semana  = f.indexOf("base_entre_semana");
  assert.ok(navidad < festivo, "Navidad se comprueba antes que festivo");
  assert.ok(festivo < finde,   "festivo antes que fin de semana");
  assert.ok(finde < semana,    "fin de semana antes que el resto");
});
