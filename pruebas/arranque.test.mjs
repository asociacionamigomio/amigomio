/* ============================================================
   Que la aplicación ARRANQUE, y que si no arranca lo diga.

   Santiago, 13/09/2026, en su móvil: «aparece cargando, pero no
   carga». Y en el ordenador, perfecta.

   «Cargando…» es el texto que trae `index.html` de fábrica,
   antes de que corra nada. Que se quede ahí significa que el
   arranque se atascó — y la pantalla no lo dice, así que no hay
   forma de saber en qué.

   Tres fallos de diseño míos, cada uno capaz de dejar esa
   pantalla clavada para siempre:

   1. **El service worker devolvía `index.html` cuando fallaba
      CUALQUIER petición.** Si lo que se pedía era un módulo de
      JavaScript, el navegador recibía una página HTML donde
      esperaba código: error de sintaxis, y la aplicación entera
      no arranca. Con mala cobertura pasa a la primera.

   2. **Sólo se guardaban 7 ficheros.** Los otros 34 se pedían a
      la red en cada arranque. Treinta y cuatro oportunidades de
      fallar, y basta una.

   3. **La librería de Supabase venía de un CDN de internet.** Si
      ese CDN va lento o no contesta, la aplicación no arranca, y
      no es nuestro y no se puede guardar.

   Y por encima de las tres: si algo se atasca, hay que DECIRLO.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const sinComentarios = s => s.replace(/\/\*[\s\S]*?\*\//g, "");

const sw = leer("sw.js");
const indice = leer("index.html");
const app = leer("js/app.js");

/* ---------- 1. Un módulo tiene que fallar como módulo ---------- */
test("index.html NO se devuelve en lugar de un módulo de JavaScript", () => {
  /* Devolver la página entera cuando lo que se pedía era
     `js/app.js` le da al navegador HTML donde espera código. La
     aplicación no arranca y la pantalla se queda en «Cargando…»
     sin decir por qué. Sólo una NAVEGACIÓN puede caer ahí. */
  const f = sinComentarios(sw);

  /* Se busca dónde se SIRVE la portada como recambio, no dónde se
     guarda: en la lista de lo que se guarda sale también. */
  const recambio = /(.{0,300})(?:cache|caches)\.match\(\s*"\.\/index\.html"\s*\)/s.exec(f);
  assert.ok(recambio, "el service worker tiene que poder servir la portada");
  assert.match(recambio[1], /navigate/,
    "la portada sólo vale como recambio de una NAVEGACIÓN, nunca de un módulo");
});

/* ---------- 2. Se guarda TODO lo que hace falta para abrir ---------- */
test("se guarda todo el JavaScript de la aplicación, no una parte", () => {
  /* Lo que no está guardado se pide a la red cada vez que se
     abre. Un fichero que no llega es una aplicación que no
     arranca. */
  const modulos = [
    ...readdirSync(new URL("../js", import.meta.url))
      .filter(f => f.endsWith(".js")).map(f => "js/" + f),
    ...readdirSync(new URL("../js/vistas", import.meta.url))
      .filter(f => f.endsWith(".js")).map(f => "js/vistas/" + f),
  ];

  for (const m of modulos)
    assert.ok(sw.includes(`"./${m}"`),
      `${m} no está en LO_BASICO: sin él la aplicación no abre sin cobertura`);
});

test("se guardan también el estilo, el logo y el manifiesto", () => {
  for (const f of ["./index.html", "./css/estilo.css", "./manifest.webmanifest",
                   "./assets/logo.png"])
    assert.ok(sw.includes(`"${f}"`), `falta ${f}`);
});

/* ---------- 3. Nada de fuera para arrancar ---------- */
test("la aplicación no depende de ningún CDN para arrancar", () => {
  /* Un CDN que va lento es una aplicación que no abre, y no es
     nuestro: no se puede guardar ni arreglar. La librería de
     Supabase vive en el repositorio, con su versión clavada. */
  const guiones = [...indice.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1]);
  for (const g of guiones)
    assert.doesNotMatch(g, /^https?:\/\//,
      `${g} viene de internet: si no contesta, la aplicación no arranca`);
});

test("la librería de Supabase está en el repositorio", () => {
  assert.ok(existsSync(new URL("../js/vendor/supabase.js", import.meta.url)),
    "falta js/vendor/supabase.js");
  assert.ok(indice.includes("js/vendor/supabase.js"));
});

/* ---------- 4. Si se atasca, que lo diga ---------- */
test("hay un vigía que avisa si el arranque se atasca", () => {
  /* Y es JavaScript normal, no un módulo: si lo que falla es
     justamente la carga de los módulos, el vigía tiene que
     seguir vivo para poder contarlo. */
  const sueltos = [...indice.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)];
  const vigia = sueltos.find(s => /setTimeout/.test(s[2]));
  assert.ok(vigia, "index.html no lleva ningún vigía del arranque");
  assert.doesNotMatch(vigia[1], /type="module"/,
    "como módulo no correría justo cuando más falta hace");
});

test("el aviso de atasco lleva a la página de rescate", () => {
  assert.match(indice, /reiniciar\.html/,
    "quedarse atascado sin salida es quedarse atascado");
});

test("el arranque no puede romperse en silencio", () => {
  /* `arrancar()` es una promesa: si revienta por dentro y nadie
     la recoge, no pasa absolutamente nada en la pantalla. */
  const f = sinComentarios(app);
  assert.match(f, /arrancar\(\)[\s\S]{0,200}?\.catch\(/,
    "arrancar() tiene que recoger su propio error y pintarlo");
});

test("cuando arranca bien, el vigía se calla", () => {
  const f = sinComentarios(app);
  assert.match(f, /arrancoBien/,
    "si no se avisa de que fue bien, el aviso de atasco sale igual");
  assert.match(indice, /arrancoBien/);
});

test("el mensaje de atasco está escrito para una persona", () => {
  const sueltos = [...indice.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map(s => s[1]).join("\n");
  assert.doesNotMatch(sueltos, /error 500|stack|undefined is not/i);
  assert.match(sueltos, /tardando|atascad|no acaba de abrir/i,
    "hay que decir qué pasa, no sólo que pasa algo");
});
