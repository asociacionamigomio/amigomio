/* ============================================================
   El panel de clientes.

   Santiago: «necesito que el panel de administracion tenga un
   listado de clientes donde yo pueda modificar datos, enviar
   avisos, descuentos...».

   Lo que se puede tocar y lo que no:

   - DATOS DE CONTACTO: sí. Administración corrige un teléfono
     mal apuntado o un DNI sin llamar a nadie.
   - DESCUENTO: sí, y sólo administración.
   - ES_ADMIN: NO desde aquí. Se es administrador por estar en
     la lista de correos (`admin_autorizado`), no porque alguien
     le dé a un botón. Si se pudiera desde la pantalla, el día
     que alguien entre en una sesión abierta se hace
     administrador en dos clics.
   - EL CORREO: tampoco. Es la identidad con la que entra; se
     cambia desde Auth, no desde aquí.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const aplanar = t => t.replace(/\s+/g, " ");

const vista = aplanar(leer("js/vistas/admin-clientes.js"));
const datos = aplanar(leer("js/datos.js"));

test("se pueden corregir los datos de contacto", () => {
  assert.match(datos, /export async function guardarCliente/);
  assert.match(vista, /guardarCliente/);
});

test("desde el panel no se hace administrador a nadie", () => {
  /* Se es administrador por estar en la lista de correos. Un
     botón aquí sería la puerta más fácil de la aplicación. */
  const fn = datos.match(/function guardarCliente.*?^\}/ms)?.[0] || datos;
  assert.doesNotMatch(fn, /es_admin:/,
    "es_admin no se manda desde aquí");
});

test("se le puede escribir un aviso", () => {
  assert.match(datos, /escribirACliente/);
  assert.match(vista, /escribirACliente/);
});

test("no se manda un aviso vacío sin decir nada", () => {
  assert.match(datos, /Falta el asunto|Ponle un asunto|Escribe/i);
});

test("se ve si el cliente ha pedido que no le escriban", () => {
  /* Escribirle a quien dijo que no es la forma más rápida de
     que denuncie el correo como spam. */
  assert.match(vista, /quiere_correos/);
});

test("el cliente puede decir que no quiere correos", () => {
  const miFicha = aplanar(leer("js/vistas/mi-ficha.js"));
  assert.match(miFicha, /quiere_correos/);
});
