/* ============================================================
   Avisar ANTES de que caduque, no cuando ya ha caducado.

   Son dos preguntas distintas y conviene no mezclarlas:

   - estadoRequisito() pregunta «¿vale durante ESA estancia?».
     Se usa al reservar.
   - avisosDelPerro() pregunta «¿hay algo que se le vaya a
     caducar pronto?». Se usa cada vez que el cliente entra, sin
     que haya ninguna reserva de por medio.

   Y el antiparasitario externo no se puede tratar como los
   demás: una pipeta dura un mes y un collar seis o siete. Con un
   plazo único, o avisas tarde del uno o pesado del otro.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { avisosDelPerro, PRODUCTOS_EXTERNOS, caducidadDe } from "../js/sanidad.js";

const HOY = "2026-08-10";

test("avisa una semana antes por defecto", () => {
  /* Rabia puesta el 15/08/2025, vence el 15/08/2026. Hoy es el 10:
     quedan 5 días, dentro de la semana de aviso. */
  const perro = { nombre: "Luna", sanidad: { rabia: { fecha: "2025-08-15" } } };
  const avisos = avisosDelPerro(perro, HOY);
  const rabia = avisos.find(a => a.id === "rabia");
  assert.ok(rabia, "tendría que avisar");
  assert.equal(rabia.dias, 5);
  assert.match(rabia.mensaje, /Luna/, "el aviso nombra al perro");
  assert.match(rabia.mensaje, /15 de agosto/, "y dice la fecha en cristiano");
});

test("no avisa de lo que todavía queda lejos", () => {
  const perro = { nombre: "Luna", sanidad: { rabia: { fecha: "2026-06-01" } } };
  assert.equal(avisosDelPerro(perro, HOY).length, 0);
});

test("avisa también de lo ya caducado, y lo dice distinto", () => {
  const perro = { nombre: "Toby", sanidad: { rabia: { fecha: "2025-06-01" } } };
  const a = avisosDelPerro(perro, HOY)[0];
  assert.equal(a.estado, "caducado");
  assert.ok(a.dias < 0);
  assert.match(a.mensaje, /venció/i);
});

test("la desparasitación interna avisa por los 30 días, no por caducidad", () => {
  /* No caduca: tiene que ser reciente. Se avisa cuando se acerca
     a quedarse vieja. */
  const perro = { nombre: "Nala", sanidad: { desparasitacion_interna: { fecha: "2026-07-15" } } };
  const a = avisosDelPerro(perro, HOY).find(x => x.id === "desparasitacion_interna");
  assert.ok(a, "tendría que avisar: lleva 26 días");
  assert.match(a.mensaje, /30 días/);
});

test("el antiparasitario externo dura según el producto", () => {
  assert.equal(PRODUCTOS_EXTERNOS.pipeta.meses, 1);
  assert.equal(PRODUCTOS_EXTERNOS.collar.meses, 7);
  assert.ok(PRODUCTOS_EXTERNOS.otro, "y se puede poner la fecha a mano");
});

test("una pipeta puesta hace 25 días ya avisa; un collar no", () => {
  const pipeta = { nombre: "Kira",
    sanidad: { antiparasitario_externo: { fecha: "2026-07-16", producto: "pipeta" } } };
  const collar = { nombre: "Kiba",
    sanidad: { antiparasitario_externo: { fecha: "2026-07-16", producto: "collar" } } };

  assert.ok(avisosDelPerro(pipeta, HOY).some(a => a.id === "antiparasitario_externo"),
    "la pipeta vence el 16 de agosto: quedan 6 días");
  assert.equal(avisosDelPerro(collar, HOY).length, 0,
    "el collar aguanta hasta febrero: no hay por qué dar la lata");
});

test("cada uno puede decir cuántos días antes quiere el aviso", () => {
  const perro = { nombre: "Luna",
    sanidad: { antiparasitario_externo: { fecha: "2026-07-16", producto: "collar", avisoDias: 200 } } };
  const a = avisosDelPerro(perro, HOY).find(x => x.id === "antiparasitario_externo");
  assert.ok(a, "con 200 días de aviso, el collar sí entra");
});

test("la fecha escrita a mano manda sobre el producto", () => {
  const perro = { sanidad: { antiparasitario_externo:
    { fecha: "2026-01-01", producto: "collar", validoHasta: "2026-08-12" } } };
  assert.equal(caducidadDe("antiparasitario_externo", perro.sanidad.antiparasitario_externo),
    "2026-08-12");
});

test("los avisos salen ordenados: primero lo más urgente", () => {
  const perro = { nombre: "Luna", sanidad: {
    rabia:                   { fecha: "2025-08-15" },   // vence en 5 días
    leptospirosis:           { fecha: "2025-06-01" },   // ya venció
    antiparasitario_externo: { fecha: "2026-07-18", producto: "pipeta" }, // en 8 días
  }};
  const dias = avisosDelPerro(perro, HOY).map(a => a.dias);
  assert.deepEqual(dias, [...dias].sort((a, b) => a - b), "de menos a más días");
});

test("sin fecha no se avisa de nada", () => {
  /* Que falte el dato es cosa del alta, no de los avisos. Si no,
     un perro recién dado de alta suelta siete avisos de golpe. */
  assert.equal(avisosDelPerro({ nombre: "Nuevo", sanidad: {} }, HOY).length, 0);
});

/* ---------- Que lleguen a la pantalla ---------- */
import { readFileSync } from "node:fs";
const lee = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");

test("los avisos salen en el inicio, sin esperar a que reserve", () => {
  /* De nada sirve enterarse el día que quiere reservar: para
     ponerle una vacuna hacen falta días. */
  const app = lee("js/app.js");
  assert.match(app, /avisosDeTodos/);
  assert.match(app, /sin que haga falta ninguna reserva/);
});

test("el inicio dice cuánto queda en cristiano", () => {
  const app = lee("js/app.js");
  assert.match(app, /vence hoy/);
  assert.match(app, /vence mañana/);
  assert.match(app, /quedan \$\{d\} días/);
});

test("un fallo cargando los perros no deja el inicio en blanco", () => {
  const app = lee("js/app.js");
  assert.match(app, /catch \{ \/\* ya se verá \*\/ \}/);
});

test("la ficha del perro deja elegir producto y plazo de aviso", () => {
  const vista = lee("js/vistas/perros.js");
  assert.match(vista, /antiparasitario_externo:puestos:\$\{i\}:producto/);
  assert.match(vista, /:avisoDias/);
  assert.match(vista, /La pipeta y el collar\s+no duran lo mismo/);
});

test("los días de aviso se guardan como número, no como texto", () => {
  /* Un "7" de texto rompería la comparación con los días que
     faltan, y el aviso no saltaría nunca. Y un hueco en blanco
     tiene que quedarse en blanco: Number("") es 0, y 0 meses de
     duración caducaría el mismo día. */
  const vista = lee("js/vistas/perros.js");
  assert.match(vista, /el\.type === "number"\s+\? \(el\.value === "" \? "" : Number\(el\.value\)\)/);
});

/* ---------- Papeles con fecha de caducidad ---------- */
import { avisosDelPerro as avisos2, DOCUMENTOS } from "../js/sanidad.js";

test("los papeles también caducan y también avisan", () => {
  /* La licencia deportiva, la de perro potencialmente peligroso y
     su seguro. Los dos últimos ya se guardaban y NO se avisaba de
     ellos: el dato estaba y no servía para nada. */
  const ids = DOCUMENTOS.map(d => d.id);
  for (const id of ["licencia_deportiva", "ppp_licencia_hasta", "ppp_seguro_hasta"])
    assert.ok(ids.includes(id), `falta ${id}`);
});

test("un papel avisa con un mes, no con una semana", () => {
  /* Renovar una licencia no es ponerle una pipeta: hay que pedir
     cita, pagar y esperar. Una semana llega tarde. */
  for (const d of DOCUMENTOS) assert.ok(d.aviso >= 30, `${d.id} avisa demasiado tarde`);
});

test("avisa de la licencia deportiva cuando se acerca", () => {
  const perro = { nombre: "Argos", licencia_deportiva: "12345",
                  licencia_deportiva_hasta: "2026-09-01" };
  const a = avisos2(perro, "2026-08-10").find(x => x.id === "licencia_deportiva");
  assert.ok(a, "faltan 22 días: tiene que avisar");
  assert.equal(a.dias, 22);
  assert.match(a.mensaje, /Argos/);
  assert.match(a.mensaje, /licencia deportiva/i);
});

test("no avisa de una licencia que no tiene", () => {
  assert.equal(avisos2({ nombre: "Luna", sanidad: {} }, "2026-08-10").length, 0);
});

test("la licencia y el seguro de PPP avisan igual", () => {
  const perro = { nombre: "Bravo", es_ppp: true,
                  ppp_licencia_hasta: "2026-08-25", ppp_seguro_hasta: "2026-09-05" };
  const ids = avisos2(perro, "2026-08-10").map(a => a.id);
  assert.ok(ids.includes("ppp_licencia_hasta"));
  assert.ok(ids.includes("ppp_seguro_hasta"));
});

test("papeles y vacunas salen en la misma lista, por urgencia", () => {
  const perro = {
    nombre: "Argos",
    licencia_deportiva_hasta: "2026-08-20",
    sanidad: { rabia: { fecha: "2025-08-15" } },
  };
  const l = avisos2(perro, "2026-08-10");
  assert.equal(l.length, 2);
  assert.equal(l[0].id, "rabia", "la rabia vence antes: va primero");
});

/* ---------- Varios antiparasitarios a la vez ---------- */
test("se pueden llevar dos antiparasitarios puestos", () => {
  /* Collar y pipeta a la vez es lo normal en zona de flebotomos:
     el collar para el mosquito y la pipeta para pulgas y
     garrapatas. */
  const perro = { nombre: "Luna", sanidad: { antiparasitario_externo: { puestos: [
    { producto: "collar", fecha: "2026-02-01" },
    { producto: "pipeta", fecha: "2026-08-01" },
  ]}}};
  /* El collar de febrero dura 7 meses: hasta el 1 de septiembre.
     La pipeta, un mes: hasta el 1 de septiembre también. */
  assert.equal(caducidadDe("antiparasitario_externo",
    perro.sanidad.antiparasitario_externo), "2026-09-01");
});

test("protegido hasta que caduca el ÚLTIMO, no el primero", () => {
  const perro = { sanidad: { antiparasitario_externo: { puestos: [
    { producto: "pipeta", fecha: "2026-08-01" },   // hasta el 1 de septiembre
    { producto: "collar", fecha: "2026-08-01" },   // hasta el 1 de marzo
  ]}}};
  assert.equal(caducidadDe("antiparasitario_externo",
    perro.sanidad.antiparasitario_externo), "2027-03-01");
});

test("de cada uno se puede decir cuánto dura O cuándo caduca", () => {
  const porDuracion = { puestos: [{ producto: "otro", fecha: "2026-08-01", duracionMeses: 3 }] };
  assert.equal(caducidadDe("antiparasitario_externo", porDuracion), "2026-11-01");

  const porFecha = { puestos: [{ producto: "otro", fecha: "2026-08-01", validoHasta: "2026-12-20" }] };
  assert.equal(caducidadDe("antiparasitario_externo", porFecha), "2026-12-20");

  const lasDos = { puestos: [{ producto: "collar", fecha: "2026-08-01",
                              duracionMeses: 3, validoHasta: "2026-10-05" }] };
  assert.equal(caducidadDe("antiparasitario_externo", lasDos), "2026-10-05",
    "la fecha escrita a mano manda sobre la duración");
});

test("sigue valiendo la forma antigua, de uno solo", () => {
  /* Los perros dados de alta antes de esto tienen un único
     producto sin lista. No se les puede romper la ficha. */
  assert.equal(caducidadDe("antiparasitario_externo",
    { producto: "pipeta", fecha: "2026-08-01" }), "2026-09-01");
});

test("avisa por el que caduca antes de los que quedan", () => {
  const perro = { nombre: "Kira", sanidad: { antiparasitario_externo: { puestos: [
    { producto: "pipeta", fecha: "2026-07-16" },   // vence el 16 de agosto
  ], avisoDias: 7 }}};
  const a = avisosDelPerro(perro, "2026-08-10").find(x => x.id === "antiparasitario_externo");
  assert.ok(a, "quedan 6 días: tiene que avisar");
});

/* ---------- Fechas que no son fechas ---------- */
test("una fecha ilegible no saca un aviso con NaN", () => {
  /* Visto en producción el 12/09/2026, en la pantalla de
     inicio: «Antiparasitario externo vence el NaN de undefined
     de NaN · quedan NaN días».

     En la base hay fichas de perro guardadas hace tiempo, y en
     `sanidad` puede haber cualquier cosa: un espacio, una fecha
     a medio escribir, un texto. El motor NO puede fiarse de que
     lo guardado sea una fecha. */
  for (const malo of [" ", "sin fecha", "2026-13-45", "0000-00-00", "2026-"]) {
    const perro = { nombre: "Kira", sanidad: { rabia: { fecha: malo } } };
    const avisos = avisosDelPerro(perro, "2026-08-10");
    for (const a of avisos) {
      assert.doesNotMatch(a.mensaje, /NaN|undefined/,
        `con fecha «${malo}» sale un aviso ilegible: ${a.mensaje}`);
      assert.ok(Number.isFinite(a.dias), `con «${malo}» los días son ${a.dias}`);
    }
  }
});

test("tampoco por el antiparasitario, que es donde se vio", () => {
  const perro = { nombre: "Luna", sanidad: { antiparasitario_externo: { puestos: [
    { producto: "otro", fecha: " " },
    { producto: "pipeta", fecha: "mal" },
  ]}}};
  for (const a of avisosDelPerro(perro, "2026-08-10"))
    assert.doesNotMatch(a.mensaje, /NaN|undefined/, a.mensaje);
});

test("y caducidadDe no devuelve una fecha inventada", () => {
  assert.equal(caducidadDe("rabia", { fecha: "no es una fecha" }), null);
  assert.equal(caducidadDe("antiparasitario_externo",
    { puestos: [{ producto: "pipeta", fecha: " " }] }), null);
});
