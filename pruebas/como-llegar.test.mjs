/* ============================================================
   Cómo llegar.

   Santiago, 13/09/2026: «crea en el menú un cómo llegar».

   Parece una tontería y es de lo más útil que puede tener: el
   día de la entrada, el cliente va conduciendo con el perro
   detrás y necesita una cosa — que el móvil le lleve. No un
   mapa que mirar: que le LLEVE.

   Por eso el botón no abre «un mapa», abre la RUTA desde donde
   esté, que es lo que se hace con el coche parado en la puerta
   de casa.

   Y OJO CON LA DIRECCIÓN: el repositorio es público. La
   dirección exacta del núcleo no entra aquí (regla 4 del
   CLAUDE.md). El destino sale de un ajuste de la base, y si no
   está puesto se busca por el nombre del sitio, que es público
   —tiene ficha en Google— y no es una dirección.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const sinComentarios = s => s.replace(/\/\*[\s\S]*?\*\//g, "");

test("existe la pantalla", () => {
  assert.ok(existsSync(new URL("../js/vistas/como-llegar.js", import.meta.url)));
});

const vista = leer("js/vistas/como-llegar.js");

test("está en el menú, y la ve el cliente", () => {
  const app = sinComentarios(leer("js/app.js"));
  assert.match(app, /id: "llegar"/);
  const linea = app.match(/\{ id: "llegar".*\n?.*/)[0];
  assert.doesNotMatch(linea, /admin: true/, "esto lo necesita el cliente, no administración");
});

test("el botón LLEVA, no sólo enseña un mapa", () => {
  /* El día de la entrada el cliente va con el coche y el perro
     detrás. No quiere mirar un mapa: quiere que le lleve. */
  assert.match(vista, /maps\/dir\/\?api=1/,
    "tiene que abrir la ruta desde donde esté, no un mapa suelto");
  assert.match(vista, /destination=/);
});

test("la dirección exacta NO está en el repositorio", () => {
  /* Regla 4: el repositorio es público. */
  assert.doesNotMatch(vista, /\bcalle\s+\w+|\bc\/\s*\w+|\bcarretera\s+\w+\s+km|\bnº?\s*\d+/i,
    "la dirección exacta va en la base, no aquí");
  assert.doesNotMatch(vista, /\d{1,2}\.\d{4,},\s*-?\d{1,2}\.\d{4,}/,
    "ni las coordenadas");
});

test("el destino sale de un ajuste, con algo que funciona si falta", () => {
  assert.match(vista, /mapa_destino|destinoDelMapa/);
  assert.match(vista, /AmigoMío/, "sin ajuste se busca por el nombre, que es público");
});

test("aguanta que la base no tenga todavía el ajuste", () => {
  /* EL NAVEGADOR SE DESPLIEGA ANTES QUE LA BASE. SIEMPRE. */
  const f = sinComentarios(vista);
  assert.match(f, /catch/);
});

test("y si se pierde, puede hablar con alguien", () => {
  /* Perdido en un camino y sin cobertura de nadie a quien
     preguntar es el peor momento posible para que una aplicación
     no tenga un botón. */
  assert.match(vista, /botonWhatsApp|enlaceWhatsApp/);
});

test("dice la zona, que es lo que ya está publicado", () => {
  assert.match(vista, /Marquesado|Puerto Real/);
});

test("se guarda en el móvil como todo lo demás", () => {
  assert.match(leer("sw.js"), /"\.\/js\/vistas\/como-llegar\.js"/);
});
