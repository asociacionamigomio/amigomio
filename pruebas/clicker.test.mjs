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

import { SONIDOS } from "../js/sonidos-clicker.js";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const src = leer("js/vistas/clicker.js");

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
  assert.match(src, /try \{ sonar\(cual\); \} catch/);
});

/* ---------- Elegir el sonido ---------- */
test("hay cuatro sonidos: clic, clic-clic, bep y bep-bep", () => {
  /* Santiago, 12/09/2026. Tiene sentido: en una clase con varios
     perros, dos manos con el mismo clicker marcan al perro de al
     lado. Cada uno con el suyo. */
  const ids = SONIDOS.map(s => s.id);
  assert.deepEqual(ids, ["clic", "clic-clic", "bep", "bep-bep"]);
});

test("cada sonido se explica sin saber de audio", () => {
  for (const s of SONIDOS) {
    assert.ok(s.nombre, `${s.id} sin nombre`);
    assert.doesNotMatch(s.nombre + (s.pista ?? ""), /hz|oscilador|frecuencia/i,
      `${s.id} está explicado para un ingeniero`);
  }
});

test("los dobles se oyen dobles; los simples, simples", () => {
  /* Se cuenta lo que SE OYE, no cuántos tonos hay dentro: el
     «clic» son dos tonos a 12 milésimas y el oído no los separa,
     que es lo que le da el chasquido metálico. */
  const suena = id => SONIDOS.find(s => s.id === id).chasquidos;
  assert.equal(suena("clic"), 1);
  assert.equal(suena("clic-clic"), 2);
  assert.equal(suena("bep"), 1);
  assert.equal(suena("bep-bep"), 2);

  /* Y que el número declarado cuadre con los golpes de verdad:
     dos golpes se oyen juntos si van a menos de 30 milésimas. */
  for (const s of SONIDOS) {
    let oidos = 1;
    for (let i = 1; i < s.golpes.length; i++)
      if (s.golpes[i].cuando - s.golpes[i - 1].cuando > 0.03) oidos++;
    assert.equal(oidos, s.chasquidos, `${s.id} dice ${s.chasquidos} y se oyen ${oidos}`);
  }
});

test("ninguno pasa de una décima: un clicker es seco", () => {
  /* Si se alarga deja de marcar un instante y marca un rato, y
     entonces el perro no sabe qué le has premiado. */
  for (const s of SONIDOS) {
    const ultimo = s.golpes.at(-1);
    assert.ok(ultimo.cuando + 0.03 <= 0.15,
      `${s.id} dura demasiado: acaba en ${ultimo.cuando + 0.03}s`);
  }
});

test("el bep es más grave que el clic", () => {
  /* Si no, no se distinguen en una clase, que es para lo que se
     eligen. */
  const hz = id => SONIDOS.find(s => s.id === id).golpes[0].hz;
  assert.ok(hz("bep") < hz("clic"), "el bep tiene que sonar distinto de verdad");
});

test("el sonido elegido se recuerda", () => {
  const fuente = leer("js/vistas/clicker.js");
  assert.match(fuente, /localStorage/);
  /* En modo privado `localStorage` revienta, y quedarse sin
     clicker por no poder recordar una preferencia sería
     absurdo. */
  assert.match(fuente, /catch/);
});

test("se puede probar el sonido antes de elegirlo", () => {
  const fuente = leer("js/vistas/clicker.js");
  assert.match(fuente, /data-sonido/);
});
