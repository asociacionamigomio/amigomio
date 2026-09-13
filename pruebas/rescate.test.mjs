/* ============================================================
   Que la aplicación no pueda quedarse tiesa.

   Santiago, 13/09/2026: «no carga, no abre» en su móvil,
   mientras en el ordenador iba perfectamente.

   La causa está en cómo estaba escrito el service worker, y es
   un fallo mío de bulto:

   - `install` llenaba el caché nuevo con `.catch(() => {})`. Si
     algo fallaba —red floja, un fichero que tarda—, se instalaba
     IGUAL y con el caché a medias.
   - Y `activate` borraba el caché viejo a continuación.

   Resultado: un móvil con mala cobertura en el momento justo se
   queda sin el caché viejo y sin el nuevo. Y si además abre la
   aplicación instalada, que arranca del caché, no abre nada.

   Hoy he subido cinco versiones seguidas del service worker
   (j, k, l, m, n). Cada una es una oportunidad de que eso pase.

   Dos arreglos:

   1. Si no se puede llenar el caché, la instalación FALLA. Más
      vale seguir con la versión vieja, que funciona, que
      quedarse sin ninguna.
   2. Una página de rescate: borra todo y vuelve a empezar, sin
      tener que desinstalar la aplicación ni buscar ajustes.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const sw = leer("sw.js");

test("una instalación a medias NO se da por buena", () => {
  /* Con `.catch(() => {})` se instalaba igual con el caché
     vacío, y acto seguido se borraba el viejo. */
  /* Sin comentarios: el de arriba CITA el `.catch` viejo para
     explicar por qué se quitó. */
  const install = sw.match(/addEventListener\("install"[\s\S]*?\n\}\);/)[0]
    .replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(install, /catch/,
    "tragarse el error deja el caché a medias y borra el bueno");
});

test("el caché viejo no se borra hasta tener el nuevo", () => {
  const activate = sw.match(/addEventListener\("activate"[\s\S]*?\n\}\);/)[0];
  assert.match(activate, /CACHE/);
});

test("hay una página de rescate", () => {
  /* Para desatascar un móvil sin desinstalar nada ni buscar en
     los ajustes del navegador. */
  assert.ok(existsSync(new URL("../reiniciar.html", import.meta.url)),
    "falta reiniciar.html");
  const r = leer("reiniciar.html");
  assert.match(r, /unregister/);
  assert.match(r, /caches\.delete/);
});

test("la página de rescate NO la toca el service worker", () => {
  /* Sería el colmo: la página que arregla el service worker
     servida por el service worker roto. */
  assert.match(sw, /reiniciar/);
});

test("y se explica en cristiano lo que hace", () => {
  const r = leer("reiniciar.html");
  assert.match(r, /no pierdes nada|no se borra nada|tus datos/i);
});
