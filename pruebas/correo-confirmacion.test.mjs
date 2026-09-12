/* ============================================================
   El correo de «ya está todo listo».

   Santiago, 13/09/2026: cuando administración da por bueno el
   pago, al cliente hay que decirle algo más que «confirmada».
   Ese correo es el que se lee DOS VECES: al recibirlo y la
   víspera, buscando qué había que traer.

   Así que lleva, en este orden:

   1. QUÉ ESTÁ CONFIRMADO — fechas, horas, perros y precio. Lo
      primero, porque es lo que se viene a comprobar.
   2. LOS HORARIOS de entrega y recogida. La pregunta número uno
      por teléfono.
   3. QUÉ TRAER — la lista de Santiago, tal cual la escribió.
   4. LO IMPRESCINDIBLE — pasaporte sanitario y lectura de chip.
      Va aparte y marcado, porque sin eso el perro no entra y
      enterarse en la puerta es tarde.
   5. Y su despedida, que vale más que todo lo anterior.

   Los importes y las fechas salen de la reserva, no del texto:
   un correo que dice una hora distinta de la reservada es peor
   que no mandar correo.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const sinComentarios = t => t.replace(/^\s*--.*$/gm, "");
const aplanar = t => sinComentarios(t).replace(/\s+/g, " ");

const sql = aplanar(leer("db/avisos.sql"));
const reloj = aplanar(leer("db/reloj.sql"));

test("confirmar el pago manda el correo", () => {
  /* Y se manda desde donde se confirma, no desde la pantalla:
     administración confirma también por teléfono. */
  assert.match(reloj, /avisar_reserva_confirmada/);
});

test("el correo existe y tiene su propio motivo", () => {
  assert.match(sql, /create or replace function avisar_reserva_confirmada/);
  assert.match(sql, /'confirmacion'/);
});

test("no se manda dos veces aunque se confirme dos veces", () => {
  /* Administración puede darle al botón dos veces, o confirmar
     algo ya confirmado. La marca lo impide. */
  assert.match(sql, /'confirmacion:' \|\| /);
});

test("dice qué días y a qué horas, sacado de la reserva", () => {
  /* Escribir las horas a mano en el texto sería contar una cosa
     distinta de la reservada. */
  assert.match(sql, /r\.entrada/);
  assert.match(sql, /r\.salida/);
  assert.match(sql, /HH24:MI/);
});

test("dice qué perros y cuánto", () => {
  assert.match(sql, /reserva_perro/);
  assert.match(sql, /r\.total/);
});

test("lleva los horarios de entrega y recogida", () => {
  assert.match(sql, /10:00 a 12:30/);
  assert.match(sql, /16:30 a 19:00/);
  assert.match(sql, /[Ss]ábados/);
});

test("lleva la lista de lo que puede traer", () => {
  for (const cosa of ["mantita", "juguete", "comida", "medicaci"])
    assert.match(sql, new RegExp(cosa, "i"), `falta lo de ${cosa}`);
});

test("la medicación oral se dice que no cuesta más", () => {
  /* Si no se dice, la gente no la trae por no pagar de más, y
     el perro se queda sin su pastilla. */
  assert.match(sql, /no tiene coste|sin coste/i);
});

test("lo imprescindible va marcado como imprescindible", () => {
  /* Sin pasaporte no entra. Enterarse en la puerta, con el
     coche cargado, es tarde. */
  assert.match(sql, /IMPRESCINDIBLE|imprescindible/);
  assert.match(sql, /pasaporte/i);
  assert.match(sql, /chip/i);
});

test("y acaba como lo escribió Santiago", () => {
  /* Esta frase es la que hace que el correo se lea entero. No
     se toca. */
  assert.match(sql, /ser tu mejor amigo es agotador/);
});

test("el recordatorio de la víspera no repite el sermón", () => {
  /* La lista completa va en la confirmación. La víspera, sólo
     lo justo: quien recibe dos veces lo mismo deja de leer el
     segundo. */
  const recordatorio = sql.match(/'recordatorio', 'recordatorio:.*?then puestos/s)?.[0] ?? "";
  assert.doesNotMatch(recordatorio, /mantita/i);
});

test("las pruebas del reloj no le mandan un correo a un cliente real", () => {
  /* Las pruebas de db/reloj.sql usan el primer cliente que haya
     —una reserva necesita uno— y confirman esa reserva, lo que
     encola el correo de «todo listo». Sin limpiarlo, cada vez
     que se reaplicara el fichero le llegaría a ese cliente un
     correo diciéndole que su perro tiene plaza para 2099. */
  assert.match(reloj, /delete from aviso where marca = 'confirmacion:' \|\| la_reserva/);
});

test("los avisos se definen antes de que el reloj los use", () => {
  const orden = leer("db/orden.txt").split("\n").map(l => l.trim()).filter(Boolean);
  assert.ok(orden.indexOf("avisos.sql") < orden.indexOf("reloj.sql"),
    "`validar_justificante` llama a `avisar_reserva_confirmada`");
});
