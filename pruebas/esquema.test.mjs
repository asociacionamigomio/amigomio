/* ============================================================
   El fallo que esta prueba impide: crear una tabla nueva y
   olvidarse de activarle RLS. Sin RLS, cualquiera con la clave
   pública —que va dentro de la página— lee la tabla entera.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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

test("todas las tablas tienen al menos una política", () => {
  for (const t of tablas) {
    const re = new RegExp(`create\\s+policy[\\s\\S]{0,200}?on\\s+${t}\\b`, "i");
    assert.match(sql, re, `la tabla ${t} no tiene ninguna política`);
  }
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
