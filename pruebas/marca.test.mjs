/* ============================================================
   Los colores de la marca salen del logo de AmigoMío, medidos
   sobre el PNG original. Si alguien los cambia "a ojo", la app
   deja de parecerse a la casa. Esta prueba los clava.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const lee = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");

const COLORES = {
  "--azul":       "#4E80A5",
  "--azul-medio": "#6199C8",
  "--azul-claro": "#79BAE4",
  "--amarillo":   "#F6EC4D",
  "--rojo":       "#C32927",
};

test("el CSS define los cinco colores de la marca", () => {
  const css = lee("css/estilo.css");
  for (const [variable, valor] of Object.entries(COLORES)) {
    const re = new RegExp(variable + "\\s*:\\s*" + valor, "i");
    assert.match(css, re, `falta ${variable}: ${valor}`);
  }
});

test("la tipografía es Poppins", () => {
  const css = lee("css/estilo.css");
  assert.match(css, /Poppins/i, "la marca usa Poppins");
});

test("no hay framework ni carpeta compilada propia", () => {
  const html = lee("index.html");
  assert.doesNotMatch(html, /\b(react|vue|angular|svelte)\b/i, "sin framework");
  assert.doesNotMatch(html, /node_modules|src=["']\.?\/?dist\//i,
    "esta app se sirve tal cual: nada de carpetas compiladas");
});

test("las librerías de fuera viven en casa y con versión clavada", () => {
  /* Esto empezó siendo «que el CDN lleve versión clavada», para
     que una actualización ajena no rompiera la app un martes
     cualquiera. El 13/09/2026 quedó claro que no bastaba: un CDN
     también puede sencillamente NO CONTESTAR, y entonces la
     aplicación no arranca y no hay nada que puedas hacer, porque
     no es tuyo. Le pasó a Santiago en su móvil.

     Así que ahora no hay ninguna librería de fuera: están dentro
     del repositorio, con su versión apuntada en js/vendor/LEEME.md
     y guardadas en el caché como todo lo demás. */
  const html = lee("index.html");
  const externos = [...html.matchAll(/src="(https?:\/\/[^"]+)"/g)].map(m => m[1]);
  assert.equal(externos.length, 0,
    `la aplicación no puede depender de internet para arrancar: ${externos}`);

  const leeme = lee("js/vendor/LEEME.md");
  assert.doesNotMatch(leeme, /@latest|\/latest\//, "nada de @latest");
  assert.match(leeme, /\d+\.\d+\.\d+/,
    "hay que dejar apuntada la versión exacta de lo que se copió");
});

test("el logo y los iconos de la PWA están en su sitio", () => {
  /* Sin iconos, al instalarla en el móvil sale un cuadrado en blanco
     y no parece de nadie. */
  for (const f of ["assets/logo.png", "assets/icono-192.png", "assets/icono-512.png",
                   "assets/icono-maskable-512.png"])
    assert.ok(existsSync(new URL("../" + f, import.meta.url)), `falta ${f}`);

  const manifiesto = JSON.parse(lee("manifest.webmanifest"));
  assert.equal(manifiesto.icons.length, 3, "el manifiesto tiene que declararlos");
  assert.equal(manifiesto.theme_color, "#4E80A5", "el color de la barra es el azul de la marca");
});

test("la portada enseña el logo, no solo el nombre escrito", () => {
  const entrada = lee("js/vistas/entrada.js");
  assert.match(entrada, /assets\/logo\.png/, "la puerta de entrada lleva el logo");
  assert.match(entrada, /alt="AmigoMío"/, "y con texto alternativo, que hay gente que no ve");
});

test("los campos se estilan sin depender de que lleven type escrito", () => {
  /* Fallo real: el CSS apuntaba a input[type="text"] y los campos sin
     type —que son text por defecto— salían estrechos y sin estilo. */
  const css = lee("css/estilo.css");
  assert.match(css, /input:not\(\[type="checkbox"\]\)/,
    "el selector tiene que cubrir los inputs sin type");
});

test("no hay datos reales de nadie en el repositorio", () => {
  /* Fallo real: la dirección de la nave se coló como dato de ejemplo
     en una prueba, y de ahí a GitHub. El repositorio es público.
     Esta prueba mira TODOS los ficheros que se publican. */
  const prohibido = [
    [/Carril\s+T[óo]rtola/i, "la dirección exacta del núcleo"],
    [/Brea\s+Higuero|Jim[ée]nez\s+Pastrana/i, "nombres de terceros"],
    [/660\s?677\s?775/, "el teléfono de urgencias de la veterinaria"],
    [/ES\d{2}\s?\d{4}\s?\d{4}/, "un IBAN"],
    [/@gmail\.com/i, "correos personales"],
  ];
  const raiz = new URL("../", import.meta.url);
  const ficheros = execSync("git ls-files", { cwd: raiz, encoding: "utf8" })
    .split("\n").filter(f => f && /\.(js|mjs|css|html|sql|md|json|webmanifest)$/.test(f));

  for (const f of ficheros) {
    const texto = lee(f);
    for (const [re, que] of prohibido)
      assert.doesNotMatch(texto, re, `${f} lleva ${que}`);
  }
});

test("los iconos llevan su medida escrita", () => {
  /* Un SVG sin width/height ocupa todo lo que le dejen. Basta
     olvidarse de ponérsela en un sitio —el cajón de «Más»— para
     que salga un icono del tamaño de la pantalla. */
  const app = lee("js/app.js");
  assert.match(app, /<svg width="22" height="22" viewBox="0 0 24 24"/);
});

test("todas las opciones van en el menú de la izquierda", () => {
  /* Sin «Más»: en vertical caben de sobra, que es justo lo que no
     pasaba con nueve pestañas en horizontal. */
  const app = lee("js/app.js");
  assert.match(app, /class="lateral"/);
  assert.doesNotMatch(app, /id="mas"|barra-abajo|cajon/,
    "ni barra abajo ni cajón de Más");

  const css = lee("css/estilo.css");
  assert.match(css, /\.lateral \{/);
  assert.match(css, /@media \(max-width: 700px\)[\s\S]{0,300}\.lateral \{/,
    "en móvil se estrecha, pero sigue a la izquierda y con todo");
});
