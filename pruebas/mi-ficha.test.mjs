/* ============================================================
   Los datos del cliente no son un capricho de formulario: el
   libro de registro del núcleo zoológico exige nombre, DNI,
   domicilio, teléfono y quién está autorizado a recoger al
   perro. Sin eso, el libro nace incompleto.

   Y el consentimiento de protección de datos es obligatorio en
   cuanto se guarda un DNI.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { validarFichaCliente, dniValido } from "../js/ficha.js";

const completa = {
  nombre: "Santiago", apellidos: "Díaz Fandiño", dni: "12345678Z",
  domicilio: "Carril Tórtola 43, Puerto Real", telefono: "600000000",
  consiente_datos: true,
};

test("la ficha exige lo que pide el libro de registro", () => {
  const r = validarFichaCliente({});
  assert.equal(r.ok, false);
  const campos = r.faltan.map(f => f.campo);
  for (const c of ["nombre", "apellidos", "dni", "domicilio", "telefono"])
    assert.ok(campos.includes(c), `el libro de registro pide ${c}`);
});

test("con todo relleno y consentido, pasa", () => {
  assert.equal(validarFichaCliente(completa).ok, true);
});

test("sin consentimiento no se guarda nada", () => {
  const r = validarFichaCliente({ ...completa, consiente_datos: false });
  assert.equal(r.ok, false);
  assert.ok(r.faltan.some(f => f.campo === "consiente_datos"));
});

test("la persona autorizada es opcional, pero si va el nombre va el DNI", () => {
  const r = validarFichaCliente({ ...completa, recoge_nombre: "María" });
  assert.equal(r.ok, false);
  assert.ok(r.faltan.some(f => f.campo === "recoge_dni"),
    "hay que comprobar su identidad en la entrega, así que el DNI hace falta");

  const bien = validarFichaCliente({ ...completa, recoge_nombre: "María", recoge_dni: "87654321X" });
  assert.equal(bien.ok, true);
});

test("el DNI se comprueba de verdad, con su letra", () => {
  assert.equal(dniValido("12345678Z"), true);
  assert.equal(dniValido("12345678A"), false, "la letra no cuadra");
  assert.equal(dniValido("1234567Z"), false, "faltan dígitos");
  assert.equal(dniValido("X1234567L"), true, "los NIE también valen");
  assert.equal(dniValido(""), false);
});

test("un DNI con la letra cambiada se rechaza con su explicación", () => {
  const r = validarFichaCliente({ ...completa, dni: "12345678A" });
  assert.equal(r.ok, false);
  const dni = r.faltan.find(f => f.campo === "dni");
  assert.match(dni.mensaje, /letra/i, "hay que decirle qué está mal, no solo que está mal");
});

test("el teléfono tiene que parecer un teléfono", () => {
  const r = validarFichaCliente({ ...completa, telefono: "hola" });
  assert.equal(r.ok, false);
  assert.ok(r.faltan.some(f => f.campo === "telefono"));
});

test("los mensajes hablan como una persona", () => {
  const r = validarFichaCliente({});
  for (const f of r.faltan)
    assert.doesNotMatch(f.mensaje, /obligatorio|inválido|campo requerido|error/i,
      `"${f.mensaje}" suena a máquina`);
});
