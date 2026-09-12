/* ============================================================
   El alta del perro es el formulario más largo de la app.
   Si se suelta de golpe, la gente lo abandona a la mitad.
   Va en tres pasos y se puede guardar a medias.

   Y los mensajes de lo que falta se le enseñan tal cual al
   cliente: por eso se comprueba también cómo están escritos.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { PASOS, validarPaso } from "../js/formularios.js";

test("el alta va en tres pasos cortos", () => {
  assert.equal(PASOS.length, 3);
  assert.deepEqual(PASOS.map(p => p.id), ["quien-es", "como-come", "como-es"]);
});

test("el paso 1 exige chip, nombre, fecha de nacimiento y sexo", () => {
  const r = validarPaso(0, {});
  assert.equal(r.ok, false);
  const campos = r.faltan.map(f => f.campo);
  for (const c of ["chip", "nombre", "fecha_nacimiento", "sexo"])
    assert.ok(campos.includes(c), `debería pedir ${c}`);
});

test("un chip mal formado se rechaza con su explicación", () => {
  const r = validarPaso(0, { chip: "12345", nombre: "Luna",
                             fecha_nacimiento: "2022-04-01", sexo: "hembra" });
  assert.equal(r.ok, false);
  const chip = r.faltan.find(f => f.campo === "chip");
  assert.match(chip.mensaje, /15/, "hay que decirle que son 15 dígitos");
});

test("el paso 1 pasa con todo relleno, aunque el chip venga con espacios", () => {
  const r = validarPaso(0, { chip: "941 0000 1234 5678", nombre: "Luna",
                             fecha_nacimiento: "2022-04-01", sexo: "hembra" });
  assert.equal(r.ok, true);
  assert.equal(r.faltan.length, 0);
});

test("no se admite un perro nacido en el futuro", () => {
  const r = validarPaso(0, { chip: "941000012345678", nombre: "Luna",
                             fecha_nacimiento: "2099-01-01", sexo: "hembra" });
  assert.equal(r.ok, false);
  assert.ok(r.faltan.some(f => f.campo === "fecha_nacimiento"));
});

test("el paso 2 no obliga a nada: comer y cuidados son texto libre", () => {
  assert.equal(validarPaso(1, {}).ok, true);
});

test("un perro potencialmente peligroso necesita licencia y seguro", () => {
  const r = validarPaso(2, { es_ppp: true, sociable: "todos", actividad: "normal" });
  assert.equal(r.ok, false);
  const campos = r.faltan.map(f => f.campo);
  assert.ok(campos.includes("ppp_licencia_hasta"));
  assert.ok(campos.includes("ppp_seguro_hasta"));
});

test("el paso 3 pasa con carácter relleno y sin ser PPP", () => {
  const r = validarPaso(2, { sociable: "todos", actividad: "normal", es_ppp: false });
  assert.equal(r.ok, true);
});

test("los mensajes hablan como una persona, no como un formulario", () => {
  const r = validarPaso(0, {});
  for (const f of r.faltan) {
    assert.doesNotMatch(f.mensaje, /obligatorio|inválido|error|campo requerido/i,
      `"${f.mensaje}" suena a máquina`);
  }
});
