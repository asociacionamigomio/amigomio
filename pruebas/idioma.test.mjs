/* ============================================================
   Español e inglés.

   Santiago: «que se pueda cambiar el idioma a ingles».

   Decisión, y conviene que esté escrita: se traduce LO QUE VE
   EL CLIENTE. El panel de administración se queda en español.

   No es pereza: el panel lo usan Santiago y Elena, que son de
   Puerto Real. Traducir el cuadrante, la hoja del día y el
   libro de registro sería mantener el doble de texto para que
   no lo lea nadie, y cada texto sin mantener acaba diciendo una
   cosa distinta de la otra versión.

   Reglas del traductor:
   - Si falta una traducción, sale el español. NUNCA una clave
     suelta tipo `inicio.saludo` en mitad de la pantalla.
   - El idioma se recuerda en el navegador, y si no hay nada
     guardado se mira el del teléfono.
   - El tono en inglés es el mismo: cercano y de tú. «We'll
     remind you», no «The user will be notified».
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { t, idiomaActual, ponerIdioma, IDIOMAS, DICCIONARIO } from "../js/idioma.js";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const aplanar = t => t.replace(/\s+/g, " ");

test("hay español e inglés, y el español es el de casa", () => {
  assert.deepEqual(IDIOMAS.map(i => i.id), ["es", "en"]);
  assert.equal(idiomaActual(), "es");
});

test("traduce cuando sabe", () => {
  ponerIdioma("en");
  assert.equal(t("Reservar"), "Book a stay");
  ponerIdioma("es");
  assert.equal(t("Reservar"), "Reservar");
});

test("si no sabe, deja el español: nunca una clave suelta", () => {
  /* Ver «inicio.saludo» en mitad de la pantalla es peor que
     verlo en español. */
  ponerIdioma("en");
  const raro = "Una frase que no está traducida todavía";
  assert.equal(t(raro), raro);
  ponerIdioma("es");
});

test("las piezas que cambian se rellenan", () => {
  ponerIdioma("en");
  assert.equal(t("Quedan {dias} días", { dias: 3 }), "3 days left");
  ponerIdioma("es");
  assert.equal(t("Quedan {dias} días", { dias: 3 }), "Quedan 3 días");
});

test("el inglés no deja huecos sin rellenar", () => {
  /* Un «{dias}» literal en pantalla es un fallo que se ve. */
  for (const [es, en] of Object.entries(DICCIONARIO.en)) {
    const huecosEs = (es.match(/\{(\w+)\}/g) || []).sort();
    const huecosEn = (en.match(/\{(\w+)\}/g) || []).sort();
    assert.deepEqual(huecosEn, huecosEs,
      `«${es}» y «${en}» no usan los mismos huecos`);
  }
});

test("nada se queda a medio traducir", () => {
  /* Una entrada que dice lo mismo en los dos idiomas casi
     siempre es un olvido. Las palabras que de verdad se
     escriben igual —«Clicker»— no hace falta ponerlas: sin
     traducción, sale el español, que es la misma palabra. */
  for (const [es, en] of Object.entries(DICCIONARIO.en)) {
    assert.ok(en.trim(), `«${es}» está sin traducir`);
    assert.notEqual(en, es,
      `«${es}» está igual que el español: o se traduce, o se quita del diccionario`);
  }
});

test("el inglés tutea igual que el español", () => {
  /* El tono no cambia con el idioma: «We'll remind you», no
     «The user will be notified». */
  const ingles = Object.values(DICCIONARIO.en).join(" ");
  assert.doesNotMatch(ingles, /\bthe user\b/i);
  assert.doesNotMatch(ingles, /\bplease be advised\b/i);
});

test("el idioma se recuerda de una visita a otra", () => {
  const fuente = leer("js/idioma.js");
  assert.match(fuente, /localStorage/);
  /* `globalThis.navigator` y no `navigator` a secas: este
     módulo también lo cargan las pruebas, donde no hay
     navegador. Es la misma maña que en js/sesion.js. */
  assert.match(fuente, /globalThis\.navigator\?\.language/,
    "y si no hay nada guardado, se mira el idioma del teléfono");
});

test("se puede cambiar desde la pantalla", () => {
  const app = aplanar(leer("js/app.js"));
  assert.match(app, /ponerIdioma/);
});

test("el panel de administración se queda en español, a propósito", () => {
  /* Y está escrito en el código para que dentro de un año nadie
     lo tome por un descuido. */
  const fuente = leer("js/idioma.js");
  assert.match(fuente, /administraci[oó]n/i);
});

test("Zapatilla contesta en el idioma en que le hablan", () => {
  const fn = aplanar(leer("supabase/functions/zapatilla/index.ts"));
  assert.match(fn, /idioma|English/i);
});
