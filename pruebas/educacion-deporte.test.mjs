/* ============================================================
   Educación canina y deporte.

   Santiago, 13/09/2026: que el dueño pueda mostrar interés por
   educar o por hacer deporte con su perro. Si es deporte, pedir
   venir a VER un entrenamiento del grupo de trabajo. Si es
   educación, pedir información sobre los grupos.

   Dos caminos distintos y conviene no mezclarlos, porque lo que
   pide el cliente es distinto:

   - DEPORTE: quiere venir a MIRAR. Nadie se apunta a IGP sin
     haber visto un entrenamiento; es una decisión que se toma
     de pie en el campo, no leyendo un folleto.
   - EDUCACIÓN: quiere que le CUENTEN. Grupos, horarios, qué se
     hace y cuánto cuesta.

   Y esto no es una reserva: es una conversación que empieza. No
   hay plazas, ni precio congelado, ni reloj. Sólo llega a
   administración y alguien contesta.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const sinComentarios = t => t.replace(/^\s*--.*$/gm, "");
const aplanar = t => sinComentarios(t).replace(/\s+/g, " ");

const sql = aplanar(leer("db/actividades.sql"));

test("las dos cosas se guardan, y se distinguen", () => {
  assert.match(sql, /create table if not exists interes/);
  assert.match(sql, /'deporte'/);
  assert.match(sql, /'educacion'/);
});

test("se sabe de qué perro habla, si lo dice", () => {
  /* No es obligatorio —puede preguntar antes de tener perro
     dado de alta— pero si lo dice, ahorra la primera pregunta. */
  assert.match(sql, /perro_id uuid references perro/);
});

test("cada uno ve lo suyo; administración, todo", () => {
  assert.match(sql, /alter table interes enable row level security/);
  assert.match(sql, /es_admin\(\)/);
  assert.match(sql, /cliente_id = auth\.uid\(\)/);
});

test("nadie muestra interés en nombre de otro", () => {
  assert.match(sql, /for insert/);
  assert.match(sql, /with check/);
});

test("se puede seguir la pista: nueva, hablada, apuntada", () => {
  /* Una solicitud sin estado se convierte en una lista que
     crece y que nadie sabe si está atendida. */
  assert.match(sql, /'nueva'/);
  assert.match(sql, /'hablada'|'atendida'/);
});

test("no se pide dos veces lo mismo sin querer", () => {
  /* Darle dos veces al botón no puede dejar dos solicitudes
     iguales esperando: administración las llamaría dos veces. */
  assert.match(sql, /unique/);
});

/* ---------- Las pantallas ---------- */
test("el cliente tiene dónde pedirlo", () => {
  const app = aplanar(leer("js/app.js"));
  assert.match(app, /actividades/);
  const vista = aplanar(leer("js/vistas/actividades.js"));
  assert.match(vista, /mostrarInteres/);
});

test("se explican las dos cosas antes de pedir nada", () => {
  /* «Deporte» y «educación» no significan lo mismo para un
     cliente que para un juez de IGP. */
  const vista = leer("js/vistas/actividades.js");
  assert.match(vista, /entrenamiento/i);
  assert.match(vista, /obedien|educa/i);
});

test("lo del deporte es venir a VER, no apuntarse", () => {
  /* Nadie se apunta a IGP sin haber visto un entrenamiento. Si
     el botón dijera «apuntarme», la mitad se echaría atrás. */
  const vista = leer("js/vistas/actividades.js");
  assert.match(vista, /ver un entrenamiento|venir a ver/i);
  assert.doesNotMatch(vista, /apuntarme al grupo de trabajo/i);
});

test("no se promete un plazo que no se puede cumplir", () => {
  /* «Te contestamos en 24 horas» es una promesa que se rompe el
     primer fin de semana con la residencia llena. */
  /* Sin los comentarios: uno de ellos cita justo la promesa que
     no hay que hacer, para explicar por qué. */
  const vista = leer("js/vistas/actividades.js").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(vista, /24 horas|inmediatamente|al momento/i);
});

test("administración las ve en su panel", () => {
  const app = aplanar(leer("js/app.js"));
  assert.match(app, /admin-intereses|renderIntereses/);
});

test("y puede escribirle por WhatsApp desde ahí", () => {
  /* Es una conversación que empieza: si hay que ir a buscar el
     teléfono a otra pantalla, se queda sin contestar. */
  const vista = aplanar(leer("js/vistas/admin-intereses.js"));
  assert.match(vista, /enlaceWhatsAppA/);
});
