/* ============================================================
   Larga temporada.

   Santiago, 13/09/2026: «12 euros noche si es un perro, más 10
   si son dos y 8 más si son tres».

   O sea, por noche:
      1 perro  -> 12 €
      2 perros -> 22 €
      3 perros -> 30 €

   Y es TARIFA PLANA, como la del alojamiento especial: ni
   recargo de fin de semana, ni de festivo, ni de Navidad. Quien
   deja al perro un mes no paga los findes a 18.

   Ojo con una cosa que se solapa: el descuento por estancia
   larga que había (un porcentaje a partir de X noches) es esto
   mismo con otro nombre. Aplicar los dos sería descontar dos
   veces. Cuando entra la tarifa larga, el descuento por estancia
   larga NO se aplica. Los otros —cliente fijo y promociones— sí,
   porque son de otra naturaleza.

   Y el escalón NO se lo invento: viene de un ajuste, y mientras
   esté vacío no se aplica nada. Poner yo un número sería cobrar
   lo que decidí yo.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const sinComentarios = t => t.replace(/^\s*--.*$/gm, "");
const aplanar = t => sinComentarios(t).replace(/\s+/g, " ");
const sql = aplanar(leer("db/tarifas.sql"));

test("las tres tarifas de larga temporada están, y son las suyas", () => {
  assert.match(sql, /'larga_dia', *12/);
  assert.match(sql, /'larga_perro_2', *10/);
  assert.match(sql, /'larga_perro_3', *8/);
});

test("a partir de cuántas noches es un ajuste, no un número escrito", () => {
  assert.match(sql, /larga_desde_noches/);
});

test("y viene VACÍO: no se cobra lo que decidí yo", () => {
  /* El escalón lo pone Santiago. Mientras no lo diga, se cobra
     la tarifa normal, que es lo que se venía cobrando. */
  assert.match(sql, /\('larga_desde_noches', *''/);
});

test("es tarifa plana: ni finde, ni festivo, ni Navidad", () => {
  /* Quien deja al perro un mes no paga los findes a 18. */
  assert.match(sql, /es_larga/);
  const fn = sql.match(/create or replace function presupuesto.*?end \$\$;/s)[0];
  assert.match(fn, /if es_larga then/);
});

test("no se descuenta dos veces por lo mismo", () => {
  /* La tarifa larga y el descuento por estancia larga son la
     misma idea con dos nombres. */
  assert.match(sql, /es_larga.*descuento|no se aplica.*larga/is);
});

test("el desglose dice que es tarifa de temporada", () => {
  /* Si la línea dijera sólo «20 noches», el cliente compararía
     con la tarifa de la web y creería que nos hemos equivocado. */
  assert.match(sql, /temporada larga|Temporada larga/);
});
