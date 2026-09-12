/* ============================================================
   El clicker no es un botón que hace ruido: es una herramienta
   de adiestramiento. Dos cosas no son negociables.

   1. Suena al APRETAR, no al soltar. En adiestramiento esa
      décima de segundo es la diferencia entre marcar el
      comportamiento correcto y marcar el siguiente.

   2. El sonido se genera, no se descarga. Un fichero de audio
      tarda en cargar la primera vez, y esa primera vez es justo
      la que estropea la sesión.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/vistas/clicker.js", import.meta.url), "utf8");

test("suena al apretar, no al soltar", () => {
  assert.match(src, /addEventListener\("pointerdown"/);
  assert.doesNotMatch(src, /addEventListener\("click"/,
    "click salta al soltar: llega tarde");
});

test("el sonido se genera, no se descarga", () => {
  assert.match(src, /AudioContext/);
  assert.doesNotMatch(src, /\.mp3|\.wav|\.ogg/,
    "un fichero tarda la primera vez, que es la que importa");
});

test("el clic es corto y seco", () => {
  /* Un clicker suena en milisegundos. Si dura más, deja de ser
     un marcador y pasa a ser un ruido. */
  const duraciones = [...src.matchAll(/\+ 0\.0(\d+)\)/g)].map(m => Number("0.0" + m[1]));
  assert.ok(duraciones.length > 0, "debería haber duraciones en el sintetizador");
  assert.ok(Math.max(...duraciones) <= 0.03, "ningún tramo puede pasar de 30 milésimas");
});

test("si el navegador no deja sonar, el botón responde igual", () => {
  assert.match(src, /try \{ clic\(\); \} catch/);
});

test("explica lo que casi todo el mundo hace mal", () => {
  /* El clic no premia: anuncia el premio. Sin cargarlo antes, el
     clicker no significa nada para el perro. */
  assert.match(src, /El clic no premia/);
  assert.match(src, /clic, y comida/i);
});
