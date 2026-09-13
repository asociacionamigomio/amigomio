/* ============================================================
   Que el botón de idioma HAGA algo.

   Santiago, 13/09/2026: «el idioma inglés no carga».

   Y no cargaba. Los botones de idioma se pintan en el menú
   lateral (`pintarMarco`) y el único `addEventListener` que los
   escuchaba estaba en `pintarSinConfirmar` — una pantalla que NO
   TIENE botones de idioma. Copiado al sitio equivocado. Encima
   llamaba a una variable `seccion` que en esa función no existe,
   así que si alguna vez hubiera habido un botón allí, habría
   reventado al pulsarlo.

   Resultado: la bandera EN estaba a la vista, se podía pulsar, y
   no pasaba nada. Un botón que no hace nada es peor que no tener
   botón: el cliente cree que la aplicación está rota.

   Esta prueba es general a propósito: quien pinte un botón, que
   lo enganche. Es el mismo tipo de fallo que se comió una entrada
   del menú hace dos días.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const sinComentarios = s => s.replace(/\/\*[\s\S]*?\*\//g, "");

test("quien pinta los botones de idioma, los engancha", () => {
  const app = sinComentarios(leer("js/app.js"));

  /* Se trocea por funciones y se mira función a función: tenerlo
     «en el fichero» no vale de nada si está en otra pantalla. */
  const funciones = app.split(/\nfunction |\nasync function /).slice(1);

  const pintan = funciones.filter(f => /data-idioma="/.test(f));
  assert.ok(pintan.length > 0, "alguien pintará los botones de idioma");

  for (const f of pintan) {
    const nombre = f.slice(0, f.indexOf("("));
    assert.match(f, /\[data-idioma\]/,
      `${nombre} pinta los botones de idioma y no los engancha: no hacen nada`);
  }
});

test("y nadie los engancha donde no los hay", () => {
  /* Un escuchador suelto en una pantalla sin botones no es
     inofensivo: es la señal de que está en el sitio equivocado, y
     el de verdad falta en otro. */
  const app = sinComentarios(leer("js/app.js"));
  const funciones = app.split(/\nfunction |\nasync function /).slice(1);

  for (const f of funciones) {
    if (!/\[data-idioma\]/.test(f)) continue;
    const nombre = f.slice(0, f.indexOf("("));
    assert.match(f, /data-idioma="/,
      `${nombre} engancha botones de idioma que no pinta`);
  }
});

test("cambiar de idioma repinta lo que hay, sin recargar", () => {
  /* Recargar la página perdería lo que estuviera a medias, y una
     ficha de perro a medio rellenar no se vuelve a rellenar. */
  const app = sinComentarios(leer("js/app.js"));
  const trozo = app.match(/\[data-idioma\][\s\S]{0,400}/)[0];
  assert.match(trozo, /ponerIdioma/);
  assert.doesNotMatch(trozo, /location\.reload/);
});

test("no se llama a variables que no existen en esa función", () => {
  /* `pintarSinConfirmar` usaba `seccion`, que sólo existe en
     `pintarMarco`. Un `const` no se puede usar antes de su línea,
     y una variable de otra función no se puede usar nunca. */
  const app = sinComentarios(leer("js/app.js"));
  const f = app.match(/function pintarSinConfirmar[\s\S]*?\n\}/)[0];
  assert.doesNotMatch(f, /\bseccion\b/,
    "esa variable no existe aquí: revienta al pulsar");
});
