/* ============================================================
   Los colores de la marca salen del logo de AmigoMío, medidos
   sobre el PNG original. Si alguien los cambia "a ojo", la app
   deja de parecerse a la casa. Esta prueba los clava.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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

test("index.html no carga ningún framework ni dependencia compilada", () => {
  const html = lee("index.html");
  assert.doesNotMatch(html, /react|vue|angular|node_modules|\/dist\//i,
    "esta app se sirve tal cual: sin framework y sin compilar");
});
