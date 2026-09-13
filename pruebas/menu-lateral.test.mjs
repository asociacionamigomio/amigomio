/* ============================================================
   El menú de la izquierda.

   Santiago, 13/09/2026: «en la parte del menú de administración
   donde pone administración no se ve bien».

   Eran dos cosas, y las dos son de bulto una vez vistas:

   1. EL BOTÓN DE INSTALAR TAPABA EL MENÚ. Está fijo abajo a la
      izquierda, flotando por encima de todo — y justo ahí, en la
      esquina inferior izquierda, está el final del menú de
      administración, que es el más largo (nueve opciones). Se
      comía las últimas.

      Un botón que flota encima de otro botón no es un adorno mal
      puesto: es una opción a la que no se puede llegar.

   2. EL RÓTULO «ADMINISTRACIÓN» no se leía: 0,68 rem, en el gris
      flojo de los textos secundarios y con las letras separadas.
      Tres cosas que restan legibilidad, las tres a la vez, y
      encima en mayúsculas.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const css = leer("css/estilo.css");
const app = leer("js/app.js");

test("el botón de instalar no flota encima del menú", () => {
  /* Con menú lateral va DENTRO del menú, con los demás. Sin
     menú —la pantalla de entrada— puede seguir flotando, que
     ahí no tapa nada. */
  assert.match(app, /lateral-instalar|#hueco-instalar/,
    "el botón tiene que tener su sitio dentro del menú");
});

test("el rótulo de grupo se lee", () => {
  const bloque = css.match(/\.lateral-grupo \{[^}]*\}/)[0];

  /* Nada de 0,6x rem para un texto en mayúsculas y espaciado. */
  const tam = bloque.match(/font-size: *([\d.]+)rem/);
  assert.ok(tam && Number(tam[1]) >= 0.72,
    `el rótulo mide ${tam?.[1]}rem: demasiado pequeño para leerse en mayúsculas`);

  /* Y con un color que contraste, no el gris de los textos
     secundarios. */
  assert.doesNotMatch(bloque, /color: *var\(--texto-flojo\)/,
    "el gris flojo sobre fondo claro no da contraste suficiente");
});

test("el grupo se separa con una línea, no sólo con aire", () => {
  /* Que se vea dónde empieza lo de administración aunque el
     rótulo pase desapercibido. */
  const bloque = css.match(/\.lateral-grupo \{[^}]*\}/)[0];
  assert.match(bloque, /border-top/);
});

test("el menú sigue cabiendo cuando hay muchas opciones", () => {
  /* Administración tiene nueve. Si no se desplaza, las últimas
     quedan fuera de la pantalla. */
  const bloque = css.match(/\.lateral \{[^}]*\}/)[0];
  assert.match(bloque, /overflow-y: auto/);
});

test("el botón de instalar nunca flota encima de nada", () => {
  /* Visto en la pantalla de entrada: el botón flotaba abajo a
     la izquierda y la barra de «hay una versión nueva» —que
     también flota— se le echaba encima. Dos cosas flotando en la
     misma esquina se tapan la una a la otra, y la que pierde es
     siempre la de abajo.

     Así que el botón tiene su hueco en las DOS pantallas donde
     puede aparecer: dentro del menú, y dentro de la tarjeta de
     entrada. La única que flota es la barra de versión, que es
     momentánea y en ese momento es lo más importante. */
  const entrada = leer("js/vistas/entrada.js");
  assert.match(entrada, /hueco-instalar/,
    "la pantalla de entrada también necesita su hueco");

  const css2 = leer("css/estilo.css");
  assert.doesNotMatch(css2, /\.boton\.instalar \{[^}]*position: fixed/,
    "ya no hay ningún botón de instalar flotando");
});

test("cada sección tiene un icono que existe", () => {
  /* Un `icono:` con un nombre que no está en la tabla pinta un
     hueco en blanco en el menú y no avisa de nada. */
  const crudo = leer("js/app.js");
  const tabla = crudo.match(/const ICONOS = \{[\s\S]*?\n\};/)[0];
  const usados = [...crudo.matchAll(/icono: "(\w+)"/g)].map(m => m[1]);

  for (const i of [...new Set(usados)])
    assert.match(tabla, new RegExp(`\\b${i}:`), `el icono «${i}» no está dibujado`);
});

test("«Educación y deporte» no lleva el corazón de «Mis perros»", () => {
  /* Santiago: «tiene más sentido un maestro o algo relacionado
     con el deporte». Un silbato vale para las dos cosas sin
     decantarse por ninguna. */
  const crudo = leer("js/app.js");
  const lineas = crudo.split("\n").filter(l => l.includes("Educación y deporte"));
  assert.ok(lineas.length >= 2, "hay dos entradas: la del cliente y la de administración");
  for (const l of lineas)
    assert.doesNotMatch(l, /icono: "corazon"/);
});
