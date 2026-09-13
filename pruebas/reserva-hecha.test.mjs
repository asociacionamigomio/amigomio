/* ============================================================
   Lo que se le dice al cliente NADA MÁS reservar.

   Santiago, 13/09/2026: «necesito que al hacer una reserva
   aparezca una ventana explicando claramente el proceso de
   reserva, la confirmación, qué pasos debe seguir».

   Hasta ahora era UNA LÍNEA: «¡Hecho! Ya tienes el sitio
   guardado. Mira en Mis reservas dónde transferir: tienes 24
   horas.» Y al decirla, la pantalla volvía al formulario de
   reservar vacío, como si no hubiera pasado nada.

   Peor: en «Mis reservas» NO SALÍA EL IBAN por ningún sitio. Se
   le pedía una transferencia sin decirle a dónde.

   Este es el momento en que el cliente decide si se fía. Si se
   queda sin saber qué tiene que hacer, o llama, o se va.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const sinComentarios = s => s.replace(/\/\*[\s\S]*?\*\//g, "");

test("existe la pantalla de «ya has reservado»", () => {
  assert.ok(existsSync(new URL("../js/vistas/reserva-hecha.js", import.meta.url)));
});

const vista = leer("js/vistas/reserva-hecha.js");

test("se enseña al reservar, en vez de volver al formulario vacío", () => {
  const reservar = leer("js/vistas/reservar.js");
  assert.match(reservar, /reserva-hecha\.js/);
  assert.doesNotMatch(sinComentarios(reservar),
    /Mira en «Mis reservas» dónde transferir/,
    "esa línea suelta es lo que se sustituye");
});

test("dice con todas las letras que TODAVÍA NO está confirmada", () => {
  /* Es lo único que de verdad hay que entender. Un cliente que
     cree que ya está no manda el resguardo, y a las 24 horas
     pierde el sitio sin enterarse. */
  assert.match(vista, /todavía no|Todavía no|aún no/i);
});

test("los pasos van numerados y son tres", () => {
  /* Uno, dos y tres. Una parrafada no se lee: se mira si hay
     números y se cuentan. */
  assert.match(vista, /paso-numero/, "cada paso lleva su número a la vista");
  /* Uno, dos y tres, en las dos versiones: la de transferencia y
     la de quien paga al llegar. */
  for (const n of [1, 2, 3]) {
    const veces = (vista.match(new RegExp("paso\\(" + n + ",", "g")) || []).length;
    assert.ok(veces >= 2, `falta el paso ${n} en alguna de las dos versiones`);
  }
});

test("dice HASTA CUÁNDO se le guarda el sitio, con fecha y hora", () => {
  /* «Tienes 24 horas» obliga a calcular. Una fecha y una hora
     concretas no. */
  assert.match(vista, /expira/);
  assert.doesNotMatch(sinComentarios(vista), /tienes 24 horas/i,
    "hay que dar la fecha concreta, no una cuenta atrás mental");
});

test("y le dice A DÓNDE transferir", () => {
  /* El agujero que había: se le pedía una transferencia sin
     darle el número de cuenta. */
  assert.match(vista, /iban/i);
  assert.match(leer("js/datos.js"), /datosParaPagar/);
});

test("con el concepto que tiene que poner", () => {
  /* Sin concepto, una transferencia suelta en el extracto no se
     sabe de quién es y hay que llamar para preguntarlo. */
  assert.match(vista, /concepto/i);
});

test("y desde ahí se va a subir el resguardo de un toque", () => {
  assert.match(vista, /data-ir="reservas"|irA\("reservas"\)/);
});

test("si paga en persona, NO se le habla de transferencias", () => {
  /* A quien tiene el trato de pagar al llegar, contarle lo de la
     transferencia le hace dudar de si le toca hacer algo. */
  assert.match(vista, /confirmada/);
  assert.match(vista, /estado === "confirmada"|estado !== "confirmada"/);
});

test("lleva el WhatsApp por si algo no cuadra", () => {
  assert.match(vista, /botonWhatsApp|enlaceWhatsApp/);
});

/* ---------- Y que no se caiga con la base vieja ---------- */
test("si la base todavía no tiene el IBAN, la pantalla sale igual", () => {
  /* EL NAVEGADOR SE DESPLIEGA ANTES QUE LA BASE. SIEMPRE.
     PGRST202 es «esa función no existe». */
  const fn = sinComentarios(leer("js/datos.js"))
    .match(/export async function datosParaPagar[\s\S]*?\n\}/)[0];
  assert.match(fn, /catch|PGRST202|error/,
    "sin IBAN se enseña el resto, no un error");
});

test("el IBAN no se le enseña a cualquiera de internet", () => {
  /* `ajuste_publico` la puede llamar cualquiera: la clave anónima
     está en el repositorio, y el repositorio es público. */
  const sql = leer("db/tarifas.sql");
  const publica = sql.match(/function ajuste_publico[\s\S]*?\$\$;/)[0];
  assert.doesNotMatch(publica, /iban/, "ahí lo lee cualquiera");

  const privada = sql.match(/function datos_para_pagar[\s\S]*?\bend \$\$;/)[0];
  assert.match(privada, /auth\.uid\(\) is null/, "sin sesión no se enseña");
  assert.match(sql, /grant execute on function datos_para_pagar\(\) to authenticated/);
  assert.match(sql, /revoke all on function datos_para_pagar\(\) from public/);
});
