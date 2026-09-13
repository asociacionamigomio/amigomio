/* ============================================================
   Que el inglés sea inglés de verdad.

   Santiago, 13/09/2026: «esfuérzate más en las traducciones, hay
   muchas cosas que no cambian de idioma».

   Y tenía razón: la bandera EN estaba puesta, el mecanismo
   funcionaba, y la mitad de las pantallas seguían en español.
   Media traducción es peor que ninguna — el cliente cambia de
   idioma, ve que algunas cosas cambian y otras no, y deja de
   fiarse de lo que lee.

   Esta prueba hace dos cosas:

   1. Que no se escape NINGUNA clave sin su inglés. Si alguien
      envuelve una frase en t() y se olvida del diccionario, salta.
   2. Que las pantallas de CLIENTE no se queden atrás. Cuenta el
      texto suelto sin traducir y no deja que crezca.

   El panel de administración se queda en español a propósito: lo
   usan Santiago y Elena, que son de Puerto Real, y mantener el
   doble de texto para que no lo lea nadie es cómo se consigue
   que al año las dos versiones digan cosas distintas.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DICCIONARIO } from "../js/idioma.js";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const sinComentarios = s => s.replace(/\/\*[\s\S]*?\*\//g, "");

/* Las pantallas que ve un cliente. El resto es administración. */
const DE_CLIENTE = [
  "js/vistas/entrada.js", "js/vistas/mi-ficha.js", "js/vistas/mis-reservas.js",
  "js/vistas/actividades.js", "js/vistas/vecinos.js", "js/vistas/reservar.js",
  "js/vistas/perros.js", "js/vistas/reserva-hecha.js", "js/vistas/clicker.js",
];

/* Una clave de verdad: tiene espacios o acentos, no es un selector
   de CSS ni un nombre de columna. */
const IGUAL_EN_INGLES = ["Clicker", "WhatsApp", "AmigoMío"];

const esFrase = k =>
  /[a-záéíóúñ]/i.test(k) && k.length > 2 &&
  !/^[a-z-]+$/.test(k) &&                         // "div", "button", "apikey"
  !/[(){}[\]<>=*]|^\.|^#|,\s|::/.test(k);         // selectores y consultas

test("toda frase envuelta en t() tiene su inglés", () => {
  const sinIngles = [];

  for (const f of DE_CLIENTE) {
    const src = sinComentarios(leer(f));
    for (const m of src.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)+)"/g)) {
      const clave = m[1];
      if (!esFrase(clave)) continue;
      /* Lo que se escribe igual en los dos idiomas NO va en el
         diccionario: sin traducción sale el español, que es la
         misma palabra. Es la regla de pruebas/idioma.test.mjs. */
      if (IGUAL_EN_INGLES.includes(clave)) continue;
      if (!DICCIONARIO.en[clave]) sinIngles.push(`${f}: «${clave}»`);
    }
  }

  assert.deepEqual(sinIngles, [],
    "hay frases marcadas para traducir que salen en español:\n  " +
    sinIngles.join("\n  "));
});

test("el inglés no es una copia del español", () => {
  /* Copiar la frase para que deje de saltar la prueba anterior es
     peor que no traducirla: parece hecho y no lo está. */
  const iguales = Object.entries(DICCIONARIO.en)
    .filter(([es, en]) => es === en && esFrase(es));
  assert.deepEqual(iguales.map(([es]) => es), []);
});

test("ninguna traducción se deja los huecos por el camino", () => {
  /* «Quedan {dias} días» -> «{dias} days left». Si en el inglés
     falta el hueco, sale un número que no aparece en ningún sitio. */
  for (const [es, en] of Object.entries(DICCIONARIO.en)) {
    const huecos = [...es.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
    for (const h of huecos)
      assert.ok(en.includes(`{${h}}`),
        `la traducción de «${es}» se ha dejado el hueco {${h}}`);
  }
});

/* ---------- Cuánto queda por hacer ---------- */
function sueltasEn(fichero) {
  /* Fuera la función `esc`, que lleva `<` y `>` dentro de una
     expresión regular y se cuela en el escáner. */
  const src = sinComentarios(leer(fichero))
    .replace(/const esc = [\s\S]*?\}\]\)\);/, "");
  const fuera = [];
  /* Texto entre etiquetas que NO está dentro de un ${...}. */
  for (const m of src.matchAll(/>\s*([A-ZÁÉÍÓÚÑ¿¡][^<>{}$]{4,}?)\s*</g))
    fuera.push(m[1].trim());
  /* Fuera los trozos de código que se cuelan: la función `esc`
     lleva `<` y `>` dentro de una expresión regular. */
  return fuera.filter(x => /[a-záéíóúñ]/.test(x)
                        && !/\?\?|replace\(|=>|String\(/.test(x));
}

test("las pantallas de cliente no se quedan atrás", () => {
  /* Un tope, no un cero: `perros.js` es un formulario enorme y se
     traduce por partes. Lo que no puede es CRECER — el día que
     alguien añada texto sin traducir, esto salta y se acuerda.

     Bájalo cuando traduzcas más. Nunca lo subas para callarlo. */
  const TOPE = {
    "js/vistas/entrada.js": 0,
    "js/vistas/vecinos.js": 0,
    "js/vistas/actividades.js": 0,
    "js/vistas/mi-ficha.js": 0,
    "js/vistas/mis-reservas.js": 2,
    "js/vistas/clicker.js": 3,
    "js/vistas/reservar.js": 20,
    "js/vistas/reserva-hecha.js": 33,
    "js/vistas/perros.js": 130,
  };

  const peores = [];
  for (const [f, tope] of Object.entries(TOPE)) {
    const n = sueltasEn(f).length;
    if (n > tope) peores.push(`${f}: ${n} sin traducir (el tope era ${tope})`);
  }
  assert.deepEqual(peores, [],
    "ha crecido el texto sin traducir:\n  " + peores.join("\n  "));
});
