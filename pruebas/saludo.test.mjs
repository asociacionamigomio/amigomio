/* ============================================================
   El saludo de la entrada.

   Santiago, 13/09/2026: «da un mensaje de bienvenida adaptado a
   la hora del día, debe ser gracioso y familiar».

   Es lo primero que ve el cliente cada vez que abre. Un «¡Hola,
   Santiago!» a secas no está mal, pero tampoco dice nada, y esta
   aplicación es de una residencia canina de pueblo, no de un
   banco.

   Tres reglas:

   1. LA HORA MANDA. A las siete de la mañana no se saluda igual
      que a medianoche, y dar los «buenos días» a las once de la
      noche es lo que hace que una aplicación parezca una máquina.
   2. VARÍA, PERO NO EN CADA PARPADEO. Si cambiara cada vez que se
      repinta la pantalla, marearía. Cambia por día.
   3. GRACIOSO SIN PASARSE. Se lee todos los días: un chiste que
      se repite mucho deja de tener gracia y empieza a estorbar.
      Frases cortas, de andar por casa, y ninguna que se ría del
      cliente.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { saludo, FRANJAS } from "../js/saludo.js";

const a = (h, dia = 15) => new Date(2026, 8, dia, h, 0, 0);

test("saluda distinto según la hora", () => {
  const horas = [3, 8, 11, 14, 18, 22];
  const dichos = horas.map(h => saludo("Santiago", a(h)));
  assert.equal(new Set(dichos).size, horas.length,
    "cada franja del día tiene lo suyo");
});

test("nunca da los buenos días de noche", () => {
  for (const h of [22, 23, 0, 2, 4]) {
    const s = saludo("Santiago", a(h)).toLowerCase();
    assert.doesNotMatch(s, /buenos días/, `a las ${h} no son los buenos días`);
  }
});

test("ni las buenas noches por la mañana", () => {
  for (const h of [7, 9, 11]) {
    const s = saludo("Santiago", a(h)).toLowerCase();
    assert.doesNotMatch(s, /buenas noches/, `a las ${h} no son las buenas noches`);
  }
});

test("dice el nombre", () => {
  assert.match(saludo("Elena", a(10)), /Elena/);
});

test("y aguanta que no haya nombre", () => {
  /* Un cliente recién dado de alta todavía no lo ha puesto. */
  for (const sin of [null, undefined, "", "   "]) {
    const s = saludo(sin, a(10));
    assert.ok(s && s.length > 3, "tiene que salir algo, no un hueco");
    assert.doesNotMatch(s, /null|undefined|,\s*!/);
  }
});

test("cambia de un día a otro, pero no dentro del mismo día", () => {
  /* Si cambiara en cada repintado marearía. */
  const hoy = saludo("Santiago", a(10, 15));
  assert.equal(hoy, saludo("Santiago", new Date(2026, 8, 15, 10, 45)),
    "a la misma hora y el mismo día, lo mismo");

  const siete = [...Array(7)].map((_, i) => saludo("Santiago", a(10, 15 + i)));
  assert.ok(new Set(siete).size > 1, "en una semana tiene que cambiar");
});

test("hay varias frases por franja, no una sola", () => {
  for (const f of FRANJAS)
    assert.ok(f.frases.length >= 2, `${f.id} tiene una sola frase y cansa`);
});

test("ninguna frase se ríe del cliente ni le da órdenes", () => {
  /* El tono de AmigoMío: cercano y de tú, nunca a costa de nadie. */
  for (const f of FRANJAS)
    for (const frase of f.frases) {
      assert.doesNotMatch(frase, /tonto|vago|pesad|otra vez tú/i);
      assert.ok(frase.length <= 90, `demasiado larga: «${frase}»`);
    }
});

test("habla de perros, que es de lo que va esto", () => {
  const todas = FRANJAS.flatMap(f => f.frases).join(" ").toLowerCase();
  assert.match(todas, /perr|cola|siesta|paseo|croqueta|pelo/);
});

test("la imagen que se da es de PAZ, no de jaleo", () => {
  /* Santiago, 13/09/2026: «no me gusta eso de colas y barullo,
     prefiero dar una imagen de paz, nos acabamos de despertar de
     la siesta... cosas así».

     Y no es sólo cuestión de gusto: quien deja aquí a su perro se
     está imaginando dónde está. Si lo que le contamos es jaleo,
     se lo imagina agobiado. */
  const todas = FRANJAS.flatMap(f => f.frases).join(" ").toLowerCase();
  for (const jaleo of ["barullo", "hora punta", "jaleo", "lío", "follón", "alboroto"])
    assert.ok(!todas.includes(jaleo), `«${jaleo}» da imagen de agobio`);
});

test("y se nota la calma, no sólo se evita el ruido", () => {
  /* Quitar las palabras feas no basta: tiene que decir algo
     tranquilo. */
  const todas = FRANJAS.flatMap(f => f.frases).join(" ").toLowerCase();
  const calma = ["calma", "tranquil", "siesta", "sin prisa", "despacio", "sol", "sombra"];
  const cuantas = calma.filter(x => todas.includes(x)).length;
  assert.ok(cuantas >= 4, "faltan imágenes de tranquilidad");
});
