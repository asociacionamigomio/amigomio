/* ============================================================
   El fallo que esta prueba impide: crear una tabla nueva y
   olvidarse de activarle RLS. Sin RLS, cualquiera con la clave
   pública —que va dentro de la página— lee la tabla entera.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const sql = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");

const tablas = [...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(\w+)/gi)]
  .map(m => m[1].toLowerCase());

test("están las tres tablas de la fase 0", () => {
  for (const t of ["cliente", "perro", "solicitud_cambio"])
    assert.ok(tablas.includes(t), `falta la tabla ${t}`);
});

test("todas las tablas tienen RLS activado", () => {
  for (const t of tablas) {
    const re = new RegExp(`alter\\s+table\\s+${t}\\s+enable\\s+row\\s+level\\s+security`, "i");
    assert.match(sql, re, `la tabla ${t} se ha quedado sin RLS`);
  }
});

/* Tablas a las que la aplicación NO debe llegar nunca. Con RLS
   activado y cero políticas, Postgres lo niega todo: es la forma
   más fuerte de cerrar una tabla, no un descuido. Cada una aquí
   con su motivo. */
const SIN_POLITICAS = {
  admin_autorizado: "lista de correos de administración; sólo la leen " +
                    "funciones security definer y Santiago desde el panel",
};

test("toda tabla tiene políticas, o está cerrada a propósito", () => {
  for (const t of tablas) {
    const re = new RegExp(`create\\s+policy[\\s\\S]{0,200}?on\\s+${t}\\b`, "i");
    if (SIN_POLITICAS[t]) {
      assert.doesNotMatch(sql, re,
        `${t} está declarada como cerrada (${SIN_POLITICAS[t]}) pero tiene políticas`);
    } else {
      assert.match(sql, re, `la tabla ${t} no tiene ninguna política`);
    }
  }
});

test("la lista de administradores va vacía en el repositorio", () => {
  /* Son datos personales y el repositorio es público. Se cargan
     directamente en la base de datos. */
  assert.doesNotMatch(sql, /insert\s+into\s+admin_autorizado/i,
    "los correos de administración no se escriben aquí");
  assert.doesNotMatch(sql, /[\w.+-]+@[\w-]+\.[a-z]{2,}/i,
    "no puede haber ninguna dirección de correo en el esquema");
});

test("el chip y el nombre están protegidos por trigger, no por el navegador", () => {
  assert.match(sql, /create\s+(or\s+replace\s+)?function\s+perro_chip_y_nombre_inmutables/i);
  assert.match(sql, /create\s+trigger[\s\S]{0,200}?perro_chip_y_nombre_inmutables/i);
});

test("el chip es único: el mismo perro no se da de alta dos veces", () => {
  assert.match(sql, /chip\s+text[^,]*unique/i);
});

test("no hay ni rastro de la clave de servicio ni del IBAN", () => {
  assert.doesNotMatch(sql, /service_role\s*=|ES\d{2}\s*\d{4}/i,
    "el repositorio es público: ahí no van secretos");
});

test("ninguna variable de plpgsql se llama como una columna", () => {
  /* Fallo real, 12/09/2026: el trigger que marca a los
     administradores declaraba `correo`, y admin_autorizado tiene una
     columna `correo`. Postgres respondía «column reference "correo"
     is ambiguous» y la ficha del cliente no se creaba nunca.

     Se tardó en ver porque el error se tragaba en el navegador. */
  /* Las columnas se buscan SOLO dentro de los create table, no en
     todo el fichero: si no, la propia declaración de la variable
     cuenta como columna y la prueba se muerde la cola. */
  const columnas = new Set();
  for (const tabla of sql.matchAll(/create\s+table[^(]*\(([\s\S]*?)\n\);/gi))
    for (const m of tabla[1].matchAll(/^\s+(\w+)\s+(text|uuid|boolean|date|timestamptz|jsonb|integer)\b/gm))
      columnas.add(m[1].toLowerCase());

  const declaradas = [];
  for (const bloque of sql.matchAll(/\bdeclare\b([\s\S]*?)\bbegin\b/gi))
    for (const v of bloque[1].matchAll(/^\s*(\w+)\s+\w/gm))
      declaradas.push(v[1].toLowerCase());

  assert.ok(columnas.size > 10, "el patrón de columnas no está encontrando nada");
  assert.ok(declaradas.length > 0, "el patrón de variables no está encontrando nada");

  for (const v of declaradas) {
    assert.ok(!columnas.has(v),
      `la variable "${v}" se llama igual que una columna: Postgres no sabrá a cuál te refieres`);
  }
});

/* ---------- El orden de aplicación ---------- */
test("todos los ficheros de base de datos están en el orden", () => {
  /* Un fichero que no está en `db/orden.txt` no se aplica nunca,
     y eso no se nota hasta que algo falla en producción. */
  const orden = readFileSync(new URL("../db/orden.txt", import.meta.url), "utf8")
    .split("\n").map(l => l.trim()).filter(Boolean);

  const hay = readdirSync(new URL("../db", import.meta.url))
    .filter(f => f.endsWith(".sql") && !f.endsWith(".local.sql"));

  for (const f of hay)
    assert.ok(orden.includes(f), `${f} no está en db/orden.txt: no se aplicaría nunca`);
});

test("el esquema va antes que todo lo que usa es_admin()", () => {
  const orden = readFileSync(new URL("../db/orden.txt", import.meta.url), "utf8")
    .split("\n").map(l => l.trim()).filter(Boolean);
  assert.equal(orden[0], "schema.sql", "es_admin() nace aquí");
  assert.ok(orden.indexOf("reservas.sql") < orden.indexOf("reloj.sql"),
    "el reloj toca la tabla reserva");
  assert.ok(orden.indexOf("reloj.sql") < orden.indexOf("avisos.sql"),
    "los avisos hablan del estado `revisando`, que nace en el reloj");
});
