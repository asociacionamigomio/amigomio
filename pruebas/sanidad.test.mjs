/* ============================================================
   Vigencia sanitaria, tal y como la exige el Programa de manejo,
   higiene y profilaxis del núcleo zoológico.

   Lo que hay que comprobar NO es si está al día hoy: es si lo
   estará durante la estancia. Un perro que entra el 7 de agosto
   y sale el 11 con la leptospirosis venciendo el 9 no vale,
   aunque hoy, 12 de septiembre, todo parezca correcto.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { REQUISITOS, estadoRequisito, revisarPerro, camposSanidad } from "../js/sanidad.js";

const rabia = REQUISITOS.find(r => r.id === "rabia");
const tos   = REQUISITOS.find(r => r.id === "traqueobronquitis");
const desp  = REQUISITOS.find(r => r.id === "desparasitacion_interna");

test("el catálogo trae los requisitos del programa sanitario", () => {
  const ids = REQUISITOS.map(r => r.id);
  for (const id of ["rabia", "polivalente", "leptospirosis", "traqueobronquitis",
                    "desparasitacion_interna", "antiparasitario_externo", "leishmaniosis"]) {
    assert.ok(ids.includes(id), `falta el requisito ${id}`);
  }
  assert.equal(REQUISITOS.find(r => r.id === "leishmaniosis").obligatorio, false,
    "la leishmaniosis se recomienda, no se exige");
});

test("sin fecha, no hay nada que comprobar", () => {
  const r = estadoRequisito({ requisito: rabia, registro: null,
                              entrada: "2026-08-07", salida: "2026-08-11" });
  assert.equal(r.estado, "sin-datos");
});

test("una vacuna en vigor durante toda la estancia está al día", () => {
  const r = estadoRequisito({ requisito: rabia, registro: { fecha: "2026-03-01" },
                              entrada: "2026-08-07", salida: "2026-08-11" });
  assert.equal(r.estado, "al-dia");
  assert.equal(r.caduca, "2027-03-01");
});

test("si vence en mitad de la estancia, avisa con la fecha", () => {
  const r = estadoRequisito({ requisito: rabia, registro: { fecha: "2025-08-09" },
                              entrada: "2026-08-07", salida: "2026-08-11" });
  assert.equal(r.estado, "caduca-durante");
  assert.equal(r.caduca, "2026-08-09");
  assert.match(r.mensaje, /9 de agosto/, "el mensaje tiene que decir la fecha en cristiano");
});

test("si venció antes de entrar, está caducada", () => {
  const r = estadoRequisito({ requisito: rabia, registro: { fecha: "2025-01-01" },
                              entrada: "2026-08-07", salida: "2026-08-11" });
  assert.equal(r.estado, "caducado");
});

test("manda la fecha de caducidad escrita a mano si la hay", () => {
  /* El collar antiparasitario dura distinto que la pipeta: si el
     propietario apunta hasta cuándo vale, eso es lo que cuenta. */
  const r = estadoRequisito({ requisito: rabia,
                              registro: { fecha: "2025-01-01", validoHasta: "2026-12-31" },
                              entrada: "2026-08-07", salida: "2026-08-11" });
  assert.equal(r.estado, "al-dia");
  assert.equal(r.caduca, "2026-12-31");
});

test("la tos de las perreras necesita 15 días de margen", () => {
  const justa = estadoRequisito({ requisito: tos, registro: { fecha: "2026-07-23" },
                                  entrada: "2026-08-07", salida: "2026-08-11" });
  assert.equal(justa.estado, "al-dia", "15 días exactos valen");

  const tarde = estadoRequisito({ requisito: tos, registro: { fecha: "2026-08-01" },
                                  entrada: "2026-08-07", salida: "2026-08-11" });
  assert.equal(tarde.estado, "demasiado-reciente");
  assert.match(tarde.mensaje, /15 días/);
});

test("una primovacunación necesita 21 días", () => {
  const r = estadoRequisito({ requisito: rabia,
                              registro: { fecha: "2026-08-01", primovacunacion: true },
                              entrada: "2026-08-07", salida: "2026-08-11" });
  assert.equal(r.estado, "demasiado-reciente");
  assert.match(r.mensaje, /21 días/);
});

test("la desparasitación interna tiene que ser de los 30 días anteriores", () => {
  const reciente = estadoRequisito({ requisito: desp, registro: { fecha: "2026-07-20" },
                                     entrada: "2026-08-07", salida: "2026-08-11" });
  assert.equal(reciente.estado, "al-dia");

  const vieja = estadoRequisito({ requisito: desp, registro: { fecha: "2026-06-01" },
                                  entrada: "2026-08-07", salida: "2026-08-11" });
  assert.equal(vieja.estado, "caducado");
  assert.match(vieja.mensaje, /30 días/);
});

test("revisar el perro entero devuelve sólo lo que falla", () => {
  const perro = {
    nombre: "Luna",
    sanidad: {
      rabia:                   { fecha: "2026-03-01" },
      polivalente:             { fecha: "2026-03-01" },
      leptospirosis:           { fecha: "2025-08-09" },
      traqueobronquitis:       { fecha: "2026-06-01" },
      desparasitacion_interna: { fecha: "2026-07-20" },
      antiparasitario_externo: { fecha: "2026-08-01" },
    },
  };
  const r = revisarPerro(perro, "2026-08-07", "2026-08-11");
  assert.equal(r.apto, false);
  assert.equal(r.problemas.length, 1, "solo falla la leptospirosis");
  assert.equal(r.problemas[0].id, "leptospirosis");
  assert.match(r.problemas[0].mensaje, /Luna/, "el mensaje nombra al perro");
});

test("un perro con todo en regla es apto", () => {
  const perro = {
    nombre: "Toby",
    sanidad: {
      rabia:                   { fecha: "2026-03-01" },
      polivalente:             { fecha: "2026-03-01" },
      leptospirosis:           { fecha: "2026-03-01" },
      traqueobronquitis:       { fecha: "2026-06-01" },
      desparasitacion_interna: { fecha: "2026-07-20" },
      antiparasitario_externo: { fecha: "2026-08-01" },
    },
  };
  const r = revisarPerro(perro, "2026-08-07", "2026-08-11");
  assert.equal(r.apto, true);
  assert.equal(r.problemas.length, 0);
});

test("hay un hueco por requisito para rellenar en el formulario", () => {
  const campos = camposSanidad({ sanidad: { rabia: { fecha: "2026-03-01" } } });
  const ids = campos.map(c => c.id);
  for (const id of ["rabia", "polivalente", "leptospirosis", "traqueobronquitis",
                    "desparasitacion_interna", "antiparasitario_externo", "leishmaniosis"])
    assert.ok(ids.includes(id), `falta el hueco de ${id}`);

  const rabia = campos.find(c => c.id === "rabia");
  assert.equal(rabia.fecha, "2026-03-01", "lo ya guardado viene relleno");
  assert.equal(rabia.obligatorio, true);

  const leish = campos.find(c => c.id === "leishmaniosis");
  assert.equal(leish.obligatorio, false, "la leishmaniosis se recomienda, no se exige");
  assert.equal(leish.fecha, "", "lo que no hay, vacío, no undefined");
});

test("los obligatorios van antes que los recomendados", () => {
  const campos = camposSanidad({});
  const ultimo = campos[campos.length - 1];
  assert.equal(ultimo.obligatorio, false, "lo recomendado va al final, no mezclado");
});
