/* ============================================================
   Fotos, y perfiles que se pueden enseñar.

   Santiago, 13/09/2026: «quiero que los usuarios puedan subir
   una foto de perfil y otra para sus perros. los perfiles se
   pueden hcer visibles para otros clientes».

   Lo de las fotos es fácil. Lo de hacerlos visibles hay que
   hacerlo con cuidado, porque la ficha del cliente lleva DNI,
   domicilio y teléfono, y la del perro lleva el CHIP y sus
   fechas sanitarias. Nada de eso puede salir.

   Y RLS es por FILA, no por columna: si se abre la fila del
   cliente para que la vean otros, se ve entera. Así que lo
   público sale por otra puerta —una vista con sólo lo que se
   puede enseñar— y las tablas siguen cerradas como estaban.

   Qué se enseña:  el nombre de pila, la foto, y de sus perros
                   el nombre, la raza y la foto.
   Qué NO sale:    apellidos, DNI, domicilio, teléfono, correo,
                   el chip del perro, sus fechas sanitarias, sus
                   pautas de comida, y si es agresivo o no.

   Y es que lo decide EL CLIENTE, apagado de fábrica. Un perfil
   que se hace público sin que nadie lo pida no es un perfil
   público: es una filtración.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const sinComentarios = t => t.replace(/^\s*--.*$/gm, "");
const aplanar = t => sinComentarios(t).replace(/\s+/g, " ");

const sql = aplanar(leer("db/perfiles.sql"));

/* ---------- Las fotos ---------- */
test("el cliente tiene foto, y el perro ya la tenía", () => {
  assert.match(sql, /alter table cliente add column if not exists foto/);
  const esquema = aplanar(leer("db/schema.sql"));
  assert.match(esquema, /foto\s+text/);
});

test("las fotos se encogen antes de subirlas, como las cartillas", () => {
  const datos = aplanar(leer("js/datos.js"));
  assert.match(datos, /export async function subirFoto/);
  assert.match(datos, /encoger/);
});

test("una foto de perfil no necesita ser un cartel", () => {
  /* 1600 px para una cartilla tiene sentido: hay que leer
     fechas escritas a mano. Para una cara o un perro, no. */
  const doc = leer("js/documentos.js");
  assert.match(doc, /LADO_FOTO/);
});

/* ---------- Lo que se enseña ---------- */
test("hay una vista con SÓLO lo que se puede enseñar", () => {
  assert.match(sql, /create or replace view perfiles_publicos/);
});

test("por ahí no salen los datos personales", () => {
  const vista = sql.match(/create or replace view perfiles_publicos.*?;/s)[0];
  for (const prohibido of ["dni", "domicilio", "telefono", "recoge_"])
    assert.doesNotMatch(vista, new RegExp(prohibido),
      `la vista pública enseña ${prohibido}`);
});

test("ni el chip del perro ni sus fechas sanitarias", () => {
  /* El chip identifica al animal y vale para reclamarlo. Y las
     fechas sanitarias no son asunto de los demás clientes. */
  const vista = sql.match(/create or replace view perros_publicos.*?;/s)[0];
  assert.doesNotMatch(vista, /chip/);
  assert.doesNotMatch(vista, /sanidad/);
  assert.doesNotMatch(vista, /agresivo/);
  assert.doesNotMatch(vista, /pautas|cuidados/);
});

test("está APAGADO de fábrica", () => {
  /* Un perfil que se hace público sin que nadie lo pida no es un
     perfil público: es una filtración. */
  assert.match(sql, /perfil_visible boolean not null default false/);
});

test("sólo se ven los perfiles de quien ha dicho que sí", () => {
  assert.match(sql, /where c\.perfil_visible/);
});

test("y sólo los ve quien ha entrado, no internet entero", () => {
  assert.match(sql, /to authenticated|auth\.uid\(\) is not null/);
});

test("el propio cliente decide, y no se lo pone administración", () => {
  /* `es_admin` y `paga_en_persona` los devuelve el trigger a su
     sitio; esto es al revés: es del cliente y nadie más se lo
     toca. */
  const datos = aplanar(leer("js/datos.js"));
  assert.match(datos, /perfil_visible/);
  const miFicha = aplanar(leer("js/vistas/mi-ficha.js"));
  assert.match(miFicha, /perfil_visible/);
});

test("se explica qué se enseña ANTES de encenderlo", () => {
  /* Marcar una casilla sin saber qué enseña es lo que hace que
     luego alguien se lleve un disgusto. */
  const miFicha = leer("js/vistas/mi-ficha.js");
  assert.match(miFicha, /nombre.*foto|foto.*nombre/i);
  assert.match(miFicha, /no.*(tel[eé]fono|DNI)|ni tu/i);
});

test("hay una pantalla donde verlos", () => {
  const app = aplanar(leer("js/app.js"));
  assert.match(app, /vecinos|perfiles/i);
});
