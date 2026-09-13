/* ============================================================
   Que la aplicación se actualice sola.

   Santiago, 13/09/2026, por tercera vez en el día: «no me deja
   cambiar el IBAN, el mensaje de bienvenida sigue siendo colas y
   barullo y el inglés sigue sin ir bien».

   Y las tres cosas estaban arregladas y publicadas. Lo que veía
   era una versión vieja guardada en su móvil.

   Ahí el fallo es mío, y de diseño: cuando llegaba una versión
   nueva se enseñaba una barra con un botón de «Actualizar». Una
   barra que hay que pulsar es una barra que no se pulsa — y
   mientras tanto la persona está mirando una aplicación con
   fallos que ya no existen, y contándomelos.

   Dos cosas, entonces:

   1. QUE SE ACTUALICE SOLA en cuanto puede, sin preguntar.
      Guardando lo único que importa: si está escribiendo algo, se
      espera. Perderle a alguien media ficha de un perro sería
      peor que el problema que arregla.

   2. QUE SE VEA QUÉ VERSIÓN ESTÁ CORRIENDO. Sin eso, «no me
      funciona» y «tienes lo de antes» son indistinguibles, y se
      buscan durante horas fallos que ya están arreglados.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const sinComentarios = s => s.replace(/\/\*[\s\S]*?\*\//g, "");

const app = leer("js/app.js");
const sw = leer("sw.js");

test("cuando entra una versión nueva, la página se recarga sola", () => {
  const f = sinComentarios(app);
  assert.match(f, /controllerchange/,
    "es el aviso de que un service worker nuevo ha tomado el mando");
  assert.match(f, /location\.reload/);
});

test("pero NO mientras está escribiendo algo", () => {
  /* Perderle media ficha de un perro sería peor que el problema
     que arregla. */
  const f = sinComentarios(app);
  const trozo = f.match(/controllerchange[\s\S]{0,900}/)[0];
  assert.match(trozo, /estaEscribiendo|input|textarea/,
    "hay que mirar si tiene algo a medias antes de recargar");
});

test("y no se recarga en bucle", () => {
  /* Una recarga que vuelve a disparar la recarga deja el móvil
     dando vueltas para siempre. */
  const f = sinComentarios(app);
  const trozo = f.match(/controllerchange[\s\S]{0,900}/)[0];
  assert.match(trozo, /yaRecargando|recargado|\breload\w*\s*=/,
    "hace falta un cerrojo");
});

test("se puede saber qué versión está corriendo", () => {
  /* Sin esto, «no me funciona» y «tienes lo de antes» son
     indistinguibles. */
  assert.match(sw, /addEventListener\("message"/,
    "el service worker tiene que poder decir su versión");
  assert.match(sw, /version: VERSION/);
  assert.match(sinComentarios(app), /queVersion|pedirVersion|version-puesta/);
});

test("y se ve en la pantalla, no sólo en la consola", () => {
  const f = sinComentarios(app);
  assert.match(f, /lateral-version|id="version"/,
    "tiene que salir en el menú, donde se puede leer y contar");
});

test("la versión que se enseña es la que CORRE, no una escrita a mano", () => {
  /* Dos sitios donde escribir la versión son dos sitios donde se
     puede quedar vieja, y entonces la pantalla miente justo
     cuando más falta hace que diga la verdad. */
  const f = sinComentarios(app);
  assert.doesNotMatch(f, /const VERSION\s*=\s*"20\d\d/,
    "la versión sale del service worker, que es quien la sabe");
});
