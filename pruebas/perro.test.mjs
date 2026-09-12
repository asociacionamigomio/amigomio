/* ============================================================
   Reglas del perro que no se pueden equivocar:

   - El chip es el identificador de verdad. Si se cuela uno mal
     formado, el mismo perro acaba dado de alta dos veces.
   - Un perro agresivo con personas SOLO puede ir a uno de los dos
     alojamientos especiales, y siempre solo. Si esta función
     falla, se mete a alguien donde no debe.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { chipValido, normalizarChip, edadEnMeses, esCachorro,
         necesitaAlojamientoEspecial, puedenCompartir } from "../js/perro.js";

test("el chip son 15 dígitos", () => {
  assert.equal(chipValido("941000012345678"), true);
  assert.equal(chipValido("94100001234567"), false, "14 dígitos no valen");
  assert.equal(chipValido("9410000123456789"), false, "16 tampoco");
  assert.equal(chipValido("94100001234567X"), false, "letras no");
  assert.equal(chipValido(""), false);
  assert.equal(chipValido(null), false);
});

test("el chip se normaliza antes de comprobarlo", () => {
  assert.equal(normalizarChip(" 941 0000 1234 5678 "), "941000012345678");
  assert.equal(normalizarChip("941-0000-1234-5678"), "941000012345678");
  assert.equal(chipValido("941 0000 1234 5678"), true);
});

test("la edad se cuenta en meses cumplidos", () => {
  assert.equal(edadEnMeses("2026-01-15", "2026-09-12"), 7);
  assert.equal(edadEnMeses("2026-09-13", "2026-09-12"), 0, "aún no ha nacido: 0, no negativo");
  assert.equal(edadEnMeses("2020-09-12", "2026-09-12"), 72);
});

test("es cachorro por debajo de 6 meses", () => {
  assert.equal(esCachorro("2026-05-01", "2026-09-12"), true);
  assert.equal(esCachorro("2026-01-01", "2026-09-12"), false);
});

test("agresivo con personas exige alojamiento especial", () => {
  assert.equal(necesitaAlojamientoEspecial({ agresivoConPersonas: true }), true);
  assert.equal(necesitaAlojamientoEspecial({ agresivoConPersonas: false }), false);
  assert.equal(necesitaAlojamientoEspecial({}), false);
});

test("un agresivo con personas nunca comparte", () => {
  const bravo = { nombre: "Bravo", sexo: "macho", agresivoConPersonas: true, sociable: "todos" };
  const luna  = { nombre: "Luna",  sexo: "hembra", agresivoConPersonas: false, sociable: "todos" };
  const r = puedenCompartir(bravo, luna);
  assert.equal(r.si, false);
  assert.match(r.motivo, /Bravo/, "el motivo tiene que decir de qué perro se trata");
});

test("la sociabilidad manda sobre quién comparte", () => {
  const soloMachos = { nombre: "Toby", sexo: "macho", sociable: "machos", agresivoConPersonas: false };
  const hembra     = { nombre: "Nala", sexo: "hembra", sociable: "todos", agresivoConPersonas: false };
  const macho      = { nombre: "Kiba", sexo: "macho",  sociable: "todos", agresivoConPersonas: false };
  assert.equal(puedenCompartir(soloMachos, hembra).si, false);
  assert.equal(puedenCompartir(soloMachos, macho).si, true);
});

test("el que no se lleva con ninguno, con ninguno", () => {
  const arisco = { nombre: "Rocky", sexo: "macho", sociable: "ninguno", agresivoConPersonas: false };
  const majo   = { nombre: "Kira",  sexo: "hembra", sociable: "todos",  agresivoConPersonas: false };
  assert.equal(puedenCompartir(arisco, majo).si, false);
  assert.equal(puedenCompartir(majo, arisco).si, false, "la regla vale en los dos sentidos");
});
