/* ============================================================
   El registro es abierto: cualquiera se da de alta sin invitación.
   Por eso el correo verificado es la única barrera antes de poder
   reservar. Sin ella, cualquiera con un correo inventado retiene
   un alojamiento 24 horas en Semana Santa y desaparece.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { puedeReservar } from "../js/sesion.js";

const lee = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");

test("sin sesión no se reserva", () => {
  assert.equal(puedeReservar(null), false);
  assert.equal(puedeReservar({ usuario: null, correoVerificado: false }), false);
});

test("con sesión pero sin verificar el correo, tampoco", () => {
  assert.equal(puedeReservar({ usuario: { id: "x" }, correoVerificado: false }), false);
});

test("con el correo verificado, sí", () => {
  assert.equal(puedeReservar({ usuario: { id: "x" }, correoVerificado: true }), true);
});

test("la contraseña no se guarda ni se registra en ningún sitio", () => {
  const s = lee("js/sesion.js");
  assert.doesNotMatch(s, /localStorage\.setItem\([^)]*contrasena/i);
  assert.doesNotMatch(s, /console\.log\([^)]*contrasena/i);
});

test("los mensajes de Supabase se traducen antes de enseñarlos", () => {
  const s = lee("js/sesion.js");
  /* Aparecen sólo dentro de la tabla de traducción, nunca sueltos
     hacia el cliente. */
  assert.match(s, /TRADUCCIONES/, "tiene que haber tabla de traducción");
  assert.match(s, /Ese correo y esa contraseña no cuadran/,
    "y el mensaje en cristiano correspondiente");
});

test("el módulo se puede cargar fuera del navegador", () => {
  /* Si sesion.js toca `window` suelto al cargarse, revienta en las
     pruebas y, lo que es peor, en cualquier herramienta que lo lea.
     Tiene que aguantar que no haya navegador. */
  const s = lee("js/sesion.js");
  assert.doesNotMatch(s, /^\s*(export\s+)?const\s+supabase\s*=\s*window\./m,
    "usa globalThis.window, que no revienta si no hay navegador");
});

test("el enlace del correo vuelve a la misma dirección desde la que se pidió", () => {
  const s = lee("js/sesion.js");
  assert.match(s, /emailRedirectTo:\s*location\.origin\s*\+\s*location\.pathname/);
});
