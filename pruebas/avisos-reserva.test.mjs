/* ============================================================
   Los avisos de una reserva.

   Santiago, 13/09/2026: «los mensajes de confirmación de reserva
   no están llegando». Y no llegaban porque NO EXISTÍAN: la cola
   `aviso` tenía UNA fila en toda su vida, y el reloj que la
   reparte estaba perfectamente vivo —328 vueltas, todas
   correctas—. Sencillamente nadie encolaba nada al reservar.

   Un cliente que reserva y no recibe nada cree que no ha
   funcionado: llama, o se va a otro sitio. Es el correo más
   barato de mandar y el más caro de no mandar.

   Y: «las reservas canceladas por el cliente deben enviar un
   aviso a la administración, y debe haber un enlace para hablar
   por WhatsApp». Una plaza que se libera y nadie se entera es
   una plaza vacía en agosto.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const sql = leer("db/avisos-reserva.sql");
const cartero = leer("supabase/functions/avisos/index.ts");

test("al entrar una reserva se avisa al cliente", () => {
  assert.match(sql, /reserva-nueva:/);
  assert.match(sql, /encolar_aviso\(\s*\n?\s*new\.cliente_id/);
});

test("y también a administración", () => {
  /* Es quien tiene que validar el justificante. Si no se entera,
     la reserva se queda ahí y caduca sola a las 24 horas. */
  assert.match(sql, /avisar_a_administracion/);
  assert.match(sql, /reserva-nueva-admin:/);
});

test("se avisa a TODOS los administradores, no a uno", () => {
  /* Si sólo se avisara a uno, el día que ese esté de vacaciones
     no se entera nadie. */
  const fn = sql.match(/function avisar_a_administracion[\s\S]*?\bend \$\$;/)[0];
  assert.match(fn, /for .* in select id from cliente where es_admin/);
});

test("el correo dice de qué perros habla", () => {
  /* Es el dato por el que el cliente abre el correo. */
  assert.match(sql, /perros_texto/);
  assert.match(sql, /string_agg\(p\.nombre/);
});

test("por eso el disparador es APLAZADO", () => {
  /* Los perros de la reserva se meten DESPUÉS que la reserva. Un
     disparador normal saltaría antes de que existieran y el
     correo saldría sin decir de qué perro habla. */
  assert.match(sql, /create constraint trigger reserva_avisa_al_entrar[\s\S]*?deferrable initially deferred/);
});

test("un aviso que falla NO puede tumbar la reserva", () => {
  /* Sin esto, un fallo mandando un correo desharía la reserva
     entera y el cliente vería un error sin entender nada. El
     dinero primero, el correo después. */
  const disparadores = sql.match(/returns trigger[\s\S]*?\bend \$\$;/g);
  assert.equal(disparadores.length, 2, "hay dos disparadores");
  for (const d of disparadores)
    assert.match(d, /exception when others/,
      "un disparador que revienta deshace la operación entera");
});

/* ---------- La cancelación ---------- */
test("cuando el cliente cancela, se avisa a administración", () => {
  assert.match(sql, /reserva-cancelada:/);
  assert.match(sql, /when \(old\.estado is distinct from new\.estado and new\.estado = 'cancelada'\)/);
});

test("pero NO cuando cancela la propia administración", () => {
  /* Avisarse a uno mismo de lo que acaba de hacer es la forma
     más rápida de que se dejen de leer los avisos. */
  const fn = sql.match(/function aviso_de_reserva_cancelada[\s\S]*?\bend \$\$;/)[0];
  assert.match(fn, /if es_admin\(\) then return null; end if;/);
});

test("el aviso de cancelación dice que el alojamiento queda libre", () => {
  /* Es la única razón por la que corre: se puede volver a vender. */
  assert.match(sql, /HA QUEDADO LIBRE/);
});

test("y trae el WhatsApp del cliente para hablarle", () => {
  const fn = sql.match(/function aviso_de_reserva_cancelada[\s\S]*?\bend \$\$;/)[0];
  assert.match(fn, /wa\.me\/34/);
  assert.match(fn, /regexp_replace\(telefono/,
    "el teléfono se escribe de mil maneras; wa.me sólo quiere dígitos");
});

/* ---------- El enlace, que es lo que pidió ---------- */
test("todos los correos llevan el ENLACE de WhatsApp, no sólo el número", () => {
  assert.match(sql, /https:\/\/wa\.me\/34673229399/);
  const viejos = leer("db/avisos.sql");
  assert.doesNotMatch(viejos, /WhatsApp al 673 229 399/,
    "un número suelto hay que copiarlo a mano");
  assert.match(viejos, /https:\/\/wa\.me\/34673229399/);
});

test("y el cartero los convierte en enlaces de verdad", () => {
  /* En la parte de texto casi todos los programas de correo lo
     enlazan solos; en la parte HTML, que es la que se ve, NO. */
  assert.match(cartero, /function enlazar/);
  assert.match(cartero, /<a href=/);
  const fn = cartero.match(/function enlazar[\s\S]*?\n\}/)[0];
  assert.match(fn, /https\?:/, "sólo http y https");
});

test("el cuerpo del correo se escapa antes de enlazar nada", () => {
  /* Lleva dentro nombres de perros y de personas que escriben
     ellos. */
  const fn = cartero.match(/function comoHtml[\s\S]*?\n\}/)[0];
  const escapa = fn.indexOf("&amp;");
  const enlaza = fn.indexOf("enlazar(");
  assert.ok(escapa > -1 && enlaza > -1);
  assert.match(fn, /&quot;/, "también las comillas, que van dentro de un href");
});

/* ---------- Y que aplicar el SQL no mande correos de mentira ---------- */
test("las pruebas del SQL no dejan correos encolados", () => {
  /* Las pruebas de crear-reserva crean reservas DE VERDAD para un
     cliente DE VERDAD. Desde que existe el disparador, cada una
     encola un correo: sin limpiarlos, aplicar el SQL le manda a
     alguien cinco correos de reservas de 2027 que no ha hecho. */
  const crear = leer("db/crear-reserva.sql");
  assert.match(crear, /delete from aviso/);
  assert.match(crear, /antes_avisos/,
    "hay que comprobar que la cola queda como estaba");
});

test("y los borra por identificador, no por fecha", () => {
  /* Mientras esto corre puede estar entrando una reserva de
     verdad. Esa no se toca. */
  const crear = leer("db/crear-reserva.sql");
  const limpieza = crear.match(/delete from aviso[\s\S]*?;/)[0];
  assert.match(limpieza, /using reserva r/);
  assert.doesNotMatch(limpieza, /interval/,
    "borrar «lo de hace un minuto» se lleva por delante lo de un cliente real");
});

test("este fichero está en orden.txt, y detrás de avisos.sql", () => {
  /* Un fichero que no está en la lista no se aplica nunca, y eso
     no se nota hasta que falla en producción. */
  const orden = leer("db/orden.txt").trim().split("\n").map(l => l.trim());
  assert.ok(orden.includes("avisos-reserva.sql"));
  assert.ok(orden.indexOf("avisos-reserva.sql") > orden.indexOf("avisos.sql"),
    "encolar_aviso() nace en avisos.sql");
});
