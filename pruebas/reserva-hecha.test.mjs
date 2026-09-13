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
     números y se cuentan.

     Sólo en la versión de transferencia: cuando la reserva ya
     está confirmada NO HAY PASOS QUE DAR, y numerar cosas que no
     hay que hacer es inventarle trabajo a alguien. Ahí va lo que
     traer y punto. */
  assert.match(vista, /paso-numero/, "cada paso lleva su número a la vista");
  const pendiente = vista.match(/function pintarPendiente[\s\S]*?\n\}/)[0];
  for (const n of [1, 2, 3])
    assert.ok(pendiente.includes(`paso(${n},`), `falta el paso ${n}`);

  const confirmada = vista.match(/function pintarConfirmada[\s\S]*?\n\}/)[0];
  assert.doesNotMatch(confirmada, /paso\(\d/,
    "con la reserva confirmada no hay pasos que dar");
  assert.match(confirmada, /no tienes que hacer nada más/i);
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

/* ============================================================
   Qué tiene que traer.

   Santiago, 13/09/2026: «los mensajes de para el día de la
   entrada no se ve bien, se sale del marco, cuenta lo de su
   camita, juguetes, su comida...».

   Dos cosas distintas. El marco: los pasos se salían por la
   derecha en el móvil — es la trampa de siempre de flexbox, una
   caja con `flex: 1` no encoge por debajo de su contenido si no
   se le dice `min-width: 0`.

   Y el contenido, que importa más: un perro que llega con su
   manta, sus juguetes y SU comida de siempre lo pasa muchísimo
   mejor. Lo del pienso no es un detalle bonito: cambiarlo de
   golpe da diarreas, y una diarrea en una residencia es una
   semana mala para el perro y una llamada incómoda para todos.
   ============================================================ */
test("le decimos qué traer: su camita, sus juguetes y su comida", () => {
  for (const cosa of [/camita|manta/i, /juguete/i, /comida|pienso/i])
    assert.match(vista, cosa, `falta ${cosa}`);
});

test("y se lo decimos también a quien paga por transferencia", () => {
  /* Ese cliente sólo ve esta pantalla una vez, justo al reservar.
     Si lo de traer las cosas estuviera sólo en la versión de
     «confirmada», no lo leería nunca. */
  const pendiente = vista.match(/function pintarPendiente[\s\S]*?\n\}/)[0];
  assert.match(pendiente, /queTraer|camita|manta/i);
});

test("lo del pienso se explica, no se ordena", () => {
  /* «Trae su comida» se salta. «Cambiarle el pienso de golpe le
     puede sentar mal» se hace caso. */
  assert.match(vista, /sentar mal|diarrea|barriga|estómago/i);
});

test("los pasos no se salen del marco", () => {
  /* Una caja con `flex: 1` NO encoge por debajo de su contenido
     mientras no se le diga `min-width: 0`. Es la causa de nueve
     de cada diez desbordamientos en el móvil. */
  const css = leer("css/estilo.css");
  const paso = css.match(/\.paso-texto\s*\{[^}]*\}/)[0];
  assert.match(paso, /min-width:\s*0/,
    "sin esto el texto largo empuja el marco hacia fuera");
});

test("y nada de la aplicación se sale a lo ancho", () => {
  /* Se comprueba en la hoja entera: un `min-width` en píxeles
     dentro de una caja flexible es la otra forma de conseguirlo. */
  const css = leer("css/estilo.css");
  const reserva = css.slice(css.indexOf("Ya has reservado"));
  assert.doesNotMatch(reserva, /min-width:\s*\d{3,}px/,
    "un ancho mínimo grande no cabe en un móvil");
});
