/* ============================================================
   Descuentos.

   Santiago, 12/09/2026: «cliente fijo, se lo puedo poner,
   promociones puntuales, por estancia larga».

   Tres clases distintas, y la diferencia importa:

   - CLIENTE FIJO: se lo pone administración a una persona y se
     queda puesto. Es el habitual, el que trae tres perros cada
     agosto desde hace diez años.
   - PROMOCIÓN PUNTUAL: vale para todos, pero sólo entre dos
     fechas. Llenar octubre, por ejemplo.
   - ESTANCIA LARGA: a partir de tantas noches, tanto por
     ciento. No lo decide nadie: lo decide la reserva.

   Dos reglas que no se negocian:

   1. NO SE ACUMULAN. Gana el mayor. Un fijo del 10 % más una
      promoción del 15 % más una larga del 20 % sería regalar la
      estancia, y eso no se descubre hasta que llega la factura.
   2. NO SE DESCUENTAN LOS RECARGOS DE FUERA DE HORARIO. Abrir a
      las once de la noche cuesta lo que cuesta, tenga quien
      tenga descuento. Ni lo de la veterinaria, que no es
      nuestro.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const sinComentarios = t => t.replace(/^\s*--.*$/gm, "");
const aplanar = t => sinComentarios(t).replace(/\s+/g, " ");

const sql = aplanar(leer("db/tarifas.sql"));

test("el cliente lleva su descuento, y sólo administración lo toca", () => {
  assert.match(sql, /descuento_pct/, "el motor de precios tiene que saber de él");
  /* Si el propio cliente pudiera ponérselo, no sería un
     descuento: sería una lista de precios a su gusto. */
  const esquema = aplanar(leer("db/schema.sql"));
  assert.match(esquema, /descuento_pct/,
    "el trigger que devuelve los privilegios a su sitio tiene que cubrirlo");
});

test("hay promociones con fecha de caducidad", () => {
  assert.match(sql, /create table if not exists promocion/);
  assert.match(sql, /desde date/);
  assert.match(sql, /hasta date/);
  assert.match(sql, /alter table promocion enable row level security/);
});

test("la promoción la ve todo el mundo pero sólo la crea administración", () => {
  /* El cliente tiene que poder ver por qué le sale más barato;
     si no, parece un error de la aplicación. */
  assert.match(sql, /create policy promocion_la_ve_cualquiera/);
  assert.match(sql, /create policy promocion_solo_admin/);
});

test("la estancia larga se configura, no se escribe a fuego", () => {
  assert.match(sql, /descuento_larga_noches/);
  assert.match(sql, /descuento_larga_pct/);
});

test("el descuento se elige, no se suma", () => {
  assert.match(sql, /create or replace function descuento_aplicable/);
  assert.match(sql, /order by pct desc/,
    "gana el mayor: acumularlos es regalar la estancia");
});

test("el presupuesto sabe de quién es la reserva", () => {
  /* Sin saber quién reserva no se puede aplicar su descuento. */
  assert.match(sql, /presupuesto\( la_entrada timestamp, la_salida timestamp, el_tipo text default 'normal', los_perros integer default 1, con_curas integer default 0, los_extras integer\[\] default '\{\}', el_cliente uuid default null \)/);
});

test("el descuento no se come los recargos de fuera de horario", () => {
  /* Abrir a las once de la noche cuesta lo mismo con descuento
     que sin él. Por eso se aplica ANTES de sumar los recargos. */
  assert.match(sql, /descontable/,
    "hace falta separar lo que se descuenta de lo que no");
});

test("el descuento sale en el desglose, con su nombre", () => {
  /* Una línea negativa sin explicación es una llamada de
     teléfono preguntando qué es eso. */
  assert.match(sql, /'concepto', dto\.concepto/);
});

test("crear_reserva pasa el cliente al presupuesto", () => {
  /* Si no, el precio que se congela en la reserva sería el de
     tarifa y el cliente vería un descuento que luego no le
     cobran… o al revés. */
  const crear = aplanar(leer("db/crear-reserva.sql"));
  assert.match(crear, /presupuesto\([^)]*el_cliente/);
});

test("la pantalla de reservar pide el presupuesto con su cliente", () => {
  const datos = aplanar(leer("js/datos.js"));
  assert.match(datos, /el_cliente/);
});

/* ---------- Las pantallas ---------- */
test("administración puede poner el descuento desde la ficha del cliente", () => {
  const vista = aplanar(leer("js/vistas/admin-clientes.js"));
  assert.match(vista, /ponerDescuento/);
  assert.match(vista, /no se suman|se queda el mayor|No se suman/i,
    "hay que decir que no se acumulan, o se ponen creyendo que sí");
});

test("hay una pestaña de promociones con sus fechas", () => {
  const vista = aplanar(leer("js/vistas/admin-tarifas.js"));
  assert.match(vista, /id: "promos"/);
  assert.match(vista, /guardarPromocion/);
  assert.match(vista, /borrarPromocion/);
  assert.match(vista, /No se suman/i);
});

test("el cliente no se puede poner descuento a sí mismo desde la app", () => {
  /* La base ya lo impide con el trigger, pero mandarlo desde
     aquí sería pedirle a Postgres que nos diga que no. */
  const datos = aplanar(leer("js/datos.js"));
  assert.match(datos, /const \{ es_admin, paga_en_persona, descuento_pct, descuento_nota,/);
});
