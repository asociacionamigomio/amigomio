/* ============================================================
   Aprobar una solicitud de cambio de chip tiene que hacer DOS
   cosas: marcar la solicitud como aprobada Y cambiar el chip de
   verdad. Si sólo hace la primera, administración cree que lo ha
   arreglado y el perro sigue con el chip viejo.

   Es el fallo clásico de este tipo de flujo, y no lo ve nadie
   hasta que alguien llega con un perro cuyo chip no coincide.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lee = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const datos = lee("js/datos.js");

function cuerpoDe(nombre) {
  const i = datos.indexOf("export async function " + nombre);
  assert.notEqual(i, -1, `falta ${nombre}`);
  const j = datos.indexOf("\nexport ", i + 10);
  return datos.slice(i, j === -1 ? datos.length : j);
}

test("aprobar una solicitud también cambia el dato en el perro", () => {
  const c = cuerpoDe("resolverSolicitud");
  assert.match(c, /from\("perro"\)[\s\S]{0,160}update/,
    "aprobar tiene que escribir el valor nuevo en la tabla perro");
  assert.match(c, /estado:\s*aprobar\s*\?\s*["']aprobada["']/,
    "y marcar la solicitud según lo que se decida");
});

test("rechazar no toca el perro", () => {
  const c = cuerpoDe("resolverSolicitud");
  assert.match(c, /if\s*\(\s*aprobar\s*\)/,
    "tiene que distinguir aprobar de rechazar antes de tocar el perro");
});

test("queda registrado quién resolvió y cuándo", () => {
  const c = cuerpoDe("resolverSolicitud");
  assert.match(c, /resuelta_por/);
  assert.match(c, /resuelta_el/);
});

test("el panel no se fía de esconder botones", () => {
  /* Ocultar el menú de administración es para no enseñar botones
     inútiles, NO es la protección. La protección es RLS, que ya
     rechaza la operación aunque alguien llegue a la pantalla.
     Esta prueba está para que nadie lo olvide y quite la política. */
  const esquema = lee("db/schema.sql");
  assert.match(esquema, /create\s+policy\s+solicitud_la_resuelve_admin[\s\S]{0,120}es_admin\(\)/i,
    "resolver solicitudes tiene que estar cerrado en la base de datos");
});

test("el cliente solo puede pedir el cambio, nunca hacerlo", () => {
  const esquema = lee("db/schema.sql");
  /* No hay política de update en perro que permita chip/nombre al
     dueño: lo impide el trigger. Y la solicitud la crea él, pero
     resolverla es de administración. */
  assert.match(esquema, /create\s+policy\s+solicitud_la_pide_el_dueno[\s\S]{0,120}auth\.uid\(\)/i);
  assert.match(esquema, /perro_chip_y_nombre_inmutables/);
});

test("las consultas con tablas que se enlazan dos veces dicen por cuál", () => {
  /* Fallo real, 12/09/2026: solicitud_cambio apunta a cliente por
     cliente_id y por resuelta_por. Pedir `cliente(...)` a secas hace
     que Supabase se niegue: no adivina cuál de las dos quieres.
     El panel salía con «No hemos podido cargarlas». */
  const esquema = lee("db/schema.sql");
  const dobles = [];
  for (const tabla of esquema.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(\w+)\s*\(([\s\S]*?)\n\);/gi)) {
    const cuenta = {};
    for (const ref of tabla[2].matchAll(/references\s+(\w+)\s*\(/gi))
      cuenta[ref[1]] = (cuenta[ref[1]] || 0) + 1;
    for (const [destino, n] of Object.entries(cuenta))
      if (n > 1) dobles.push([tabla[1], destino]);
  }

  assert.ok(dobles.length > 0, "debería detectar solicitud_cambio -> cliente dos veces");

  for (const [origen, destino] of dobles) {
    const embebidos = datos.matchAll(new RegExp(`from\\("${origen}"\\)[\\s\\S]{0,200}?\\.select\\("([^"]*)"`, "g"));
    for (const e of embebidos) {
      const sel = e[1];
      if (new RegExp(`(^|,\\s*)${destino}\\s*\\(`).test(sel))
        assert.fail(`al pedir ${destino} desde ${origen} hay que decir por qué clave: ${destino}!nombre_de_la_fkey(...)`);
    }
  }
});
