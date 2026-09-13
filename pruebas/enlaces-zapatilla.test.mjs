/* ============================================================
   Los enlaces que escribe Zapatilla tienen que poder tocarse.

   Santiago, 13/09/2026: «el enlace de whatsapp que da zapatilla
   para hablar con la administración va mal».

   Y va mal, aunque el número esté bien. Todo lo que escribe
   Zapatilla se pinta como TEXTO PLANO a propósito —es un modelo,
   y lo que escriba un modelo no puede colar HTML en la página—,
   así que el `https://wa.me/34673229399` salía escrito y no se
   podía tocar. En un móvil, un enlace que no se toca no es un
   enlace: es un número de teléfono que hay que copiar a mano.

   Así que se enlaza, pero sólo lo que es seguro enlazar:
   `http` y `https`, y nada más. `javascript:` en un enlace que
   escribe un modelo es exactamente la razón por la que esto se
   escapaba entero.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");

import { aTexto } from "../js/zapatilla.js";

test("el enlace de WhatsApp se puede tocar", () => {
  const salida = aTexto("Escríbenos al WhatsApp 673 229 399 (https://wa.me/34673229399) y te atendemos.");
  assert.match(salida, /<a [^>]*href="https:\/\/wa\.me\/34673229399"/,
    "el enlace tiene que salir como enlace de verdad");
});

test("el paréntesis de después no se cuela dentro del enlace", () => {
  /* Zapatilla escribe «(https://wa.me/34673229399)». Si el
     paréntesis entra en la dirección, WhatsApp no encuentra a
     nadie — que es la forma más tonta de que un enlace falle. */
  const salida = aTexto("Háblanos (https://wa.me/34673229399).");
  assert.match(salida, /href="https:\/\/wa\.me\/34673229399"/);
  assert.doesNotMatch(salida, /href="[^"]*[)]/);
});

test("ni el punto final", () => {
  const salida = aTexto("Mira https://amigomio.org.");
  assert.match(salida, /href="https:\/\/amigomio\.org"/);
});

test("un enlace escrito en markdown también vale", () => {
  /* Un modelo escribe `[WhatsApp](https://…)` en cuanto se
     descuida. Sin esto, el cliente ve los corchetes. */
  const salida = aTexto("Pincha [aquí](https://wa.me/34673229399).");
  assert.match(salida, /<a [^>]*href="https:\/\/wa\.me\/34673229399"[^>]*>aquí<\/a>/);
  assert.doesNotMatch(salida, /\[aquí\]/);
});

test("se abre fuera y sin dejar la puerta abierta", () => {
  const salida = aTexto("https://amigomio.org");
  assert.match(salida, /target="_blank"/);
  assert.match(salida, /rel="[^"]*noopener/);
});

/* ---------- Y lo que NO se enlaza ---------- */
test("javascript: NO se enlaza jamás", () => {
  /* Lo que escribe un modelo es texto de fuera. Si algún día
     alguien consigue que escriba esto, tiene que salir como lo
     que es: letras. */
  const salida = aTexto("Pincha javascript:alert(1) y [aquí](javascript:alert(2))");
  assert.doesNotMatch(salida, /href="javascript/i);
  assert.doesNotMatch(salida, /<a [^>]*javascript/i);
});

test("sigue sin colarse HTML", () => {
  /* Lo de siempre, que no se pierda al añadir los enlaces. */
  const salida = aTexto('<img src=x onerror="alert(1)"> y <script>malo()</script>');
  assert.doesNotMatch(salida, /<img|<script/i);
  assert.match(salida, /&lt;img/);
});

test("una dirección con comillas no rompe el atributo", () => {
  /* Lo que importa no es que no aparezcan las letras
     «onmouseover» —dentro de una dirección ya escapada son
     inofensivas— sino que NO se conviertan en un atributo. Como
     se escapa antes de tocar nada, la comilla llega como `&quot;`
     y el `href` sigue cerrando donde tiene que cerrar. */
  const salida = aTexto('https://malo.example/"onmouseover="alert(1)');
  assert.match(salida, /href="[^"]*" target="_blank"/,
    "el href tiene que cerrar él solo y dejar paso a target");
  assert.match(salida, /&quot;/, "la comilla tiene que llegar escapada");
});

test("las negritas y los saltos de línea siguen funcionando", () => {
  const salida = aTexto("Hola **Santiago**\ny adiós");
  assert.match(salida, /<strong>Santiago<\/strong>/);
  assert.match(salida, /<br>/);
});
