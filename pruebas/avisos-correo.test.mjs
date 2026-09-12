/* ============================================================
   Que los avisos salgan de la aplicación.

   Hasta ahora avisábamos de que a Luna le caduca la rabia… si
   el cliente entraba en la aplicación. Un aviso que hay que ir
   a buscar no es un aviso. Y el que más lo necesita —el que no
   entra nunca— es justo el que no se enteraba.

   Cómo está montado, y por qué así:

   - Los correos NO se mandan desde el navegador. Se ENCOLAN en
     una tabla y los manda el servidor. Si se mandaran desde la
     pantalla, se perderían al cerrar la pestaña, se mandarían
     dos veces al recargar, y haría falta la clave del proveedor
     en el navegador, que es como publicarla.
   - Cada aviso lleva una MARCA de qué es y de qué va. Con ella
     no se manda dos veces lo mismo, y ése es el fallo que
     convierte un servicio útil en correo basura.
   - Lo que falla se reintenta un número de veces y luego se
     rinde, dejando dicho por qué. Un reintento infinito contra
     una dirección que no existe es una factura creciendo sola.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const sinComentarios = t => t.replace(/^\s*--.*$/gm, "");
const aplanar = t => sinComentarios(t).replace(/\s+/g, " ");

const sql = aplanar(leer("db/avisos.sql"));

test("los avisos se encolan, no se mandan desde la pantalla", () => {
  assert.match(sql, /create table if not exists aviso/);
  assert.match(sql, /alter table aviso enable row level security/);
});

test("nadie lee la cola de correos salvo administración", () => {
  /* La cola lleva la dirección y el texto de todos los
     clientes. */
  assert.match(sql, /create policy aviso_solo_admin/);
});

test("cada aviso lleva su marca para no mandarlo dos veces", () => {
  assert.match(sql, /marca text/);
  assert.match(sql, /unique/,
    "sin unicidad en la marca, un cron que se dispare dos veces manda dos correos");
});

test("lo que falla se reintenta, pero no para siempre", () => {
  assert.match(sql, /intentos/);
  assert.match(sql, /'rendido'|'fallido'/,
    "hace falta un estado final: reintentar sin fin contra una dirección muerta es una factura creciendo sola");
});

test("hay una función que mira qué hay que avisar hoy", () => {
  assert.match(sql, /create or replace function preparar_avisos/);
});

test("avisa de lo sanitario que caduca", () => {
  assert.match(sql, /sanidad/);
});

test("avisa de la reserva que va a caducar sin pagar", () => {
  /* Es el aviso que más dinero salva: el cliente que se
     despistó y va a perder el sitio en unas horas. */
  assert.match(sql, /'pendiente'/);
  assert.match(sql, /expira/);
});

test("y recuerda la estancia que empieza mañana", () => {
  assert.match(sql, /manana|mañana|recordatorio/i);
});

test("no se le escribe a quien no quiere que le escriban", () => {
  /* Si no se puede parar, es spam. */
  assert.match(sql, /quiere_correos/);
});

test("administración puede escribirle a un cliente a mano", () => {
  assert.match(sql, /create or replace function escribir_a_cliente/);
  assert.match(sql, /es_admin\(\)/);
});

/* ---------- Quien los manda de verdad ---------- */
const fn = leer("supabase/functions/avisos/index.ts");

test("la función de envío no usa la clave de servicio a lo loco", () => {
  /* Ésta SÍ necesita service_role: escribe en la cola de todos.
     Pero entonces tiene que comprobar quién la llama. */
  assert.match(fn, /SERVICE_ROLE/);
  assert.match(fn, /CRON_SECRET|authorization/i,
    "si cualquiera puede dispararla, cualquiera puede vaciarte la cola de correos");
});

test("marca el aviso ANTES de mandarlo, no después", () => {
  /* Si se marca después y el proceso se cae en medio, el
     siguiente pase lo vuelve a mandar. Mejor un correo perdido
     que diez repetidos. */
  assert.match(fn, /enviando/);
});

test("el correo se ve bien aunque el cliente no cargue imágenes", () => {
  assert.match(fn, /text:/,
    "todo correo lleva su versión en texto plano");
});

test("una fecha en blanco no revienta la preparación de avisos", () => {
  /* El formulario guarda `"fecha": ""` cuando el campo se deja
     vacío, y una cadena vacía NO es nula: con `is not null`
     pasaba el filtro y el cast abortaba con
     «22007: invalid input syntax for type date: ""», tirando la
     instalación entera. */
  assert.match(sql, /nullif\(p\.sanidad -> k ->> 'fecha', ''\)/);
  assert.doesNotMatch(sql, /where p\.sanidad -> k ->> 'fecha' is not null/);
});
