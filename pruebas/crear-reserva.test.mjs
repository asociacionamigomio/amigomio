/* ============================================================
   crear_reserva es la operación única del diseño: la llaman la
   app, el panel y Zapatilla.

   Por eso TODAS las comprobaciones viven dentro de ella. Si
   estuvieran en la pantalla, Zapatilla se las saltaría sin
   enterarse, y un asistente de IA que se salta comprobaciones
   compromete a AmigoMío con reservas que no puede cumplir.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lee = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const sql = lee("db/crear-reserva.sql");

test("la operación es una sola y la usan las tres puertas", () => {
  assert.match(sql, /create\s+or\s+replace\s+function\s+crear_reserva/i);
  assert.match(sql, /quien\s+text\s+default\s+'cliente'/i,
    "tiene que quedar registrado quién la creó: cliente, panel o Zapatilla");
});

test("nadie reserva a nombre de otro", () => {
  assert.match(sql, /Solo puedes reservar a tu nombre/);
  assert.match(sql, /auth\.uid\(\) is null/,
    "y sin identificarse tampoco");
});

test("un visitante sin identificar no pasa por admin", () => {
  /* security definer se salta RLS: si la puerta no distingue quién
     llama, auth.uid() nulo dejaría entrar a cualquiera. */
  assert.match(sql, /current_user in \('postgres', 'supabase_admin'\)/,
    "hay que distinguir al servidor de alguien de internet");
});

test("el interruptor de reservas se comprueba aquí, no en la pantalla", () => {
  assert.match(sql, /reservas_abiertas/);
  assert.match(sql, /Todavía no hemos abierto las reservas/);
});

test("los perros tienen que ser suyos", () => {
  assert.match(sql, /no está en tu ficha/);
});

test("el agresivo con personas va solo y a especial", () => {
  assert.match(sql, /agresivo_con_personas/);
  assert.match(sql, /va siempre solo/);
  assert.match(sql, /tipo := 'especial'/);
});

test("la compatibilidad se comprueba entre todas las parejas", () => {
  assert.match(sql, /for i in 1\.\.n loop[\s\S]{0,200}for j in \(i \+ 1\)\.\.n loop/,
    "hay que comparar cada perro con cada otro, no solo con el primero");
});

test("el precio se congela dentro de la reserva", () => {
  assert.match(sql, /se congela aquí dentro/i);
  assert.match(sql, /desglose[\s\S]{0,60}cuentas/);
});

test("el plazo de 24 horas se pone al crearla", () => {
  assert.match(sql, /now\(\) \+ interval '24 hours'/);
});

test("los autorizados a pagar en persona se saltan el justificante", () => {
  assert.match(sql, /paga_en_persona/);
  assert.match(sql, /then 'confirmada' else 'pendiente'/);
});

test("las pruebas del SQL dejan la base como estaba", () => {
  /* Corren contra la base DE VERDAD, con un cliente de verdad
     (`select id from cliente limit 1`). Lo que creen no puede
     sobrevivir ni un segundo. */
  assert.match(sql, /raise exception 'PRUEBAS-DE-CREAR-RESERVA-OK'/,
    "se deshacen enteras en vez de limpiar detrás");
  assert.match(sql, /count\(\*\) from reserva\) = antes/,
    "y se comprueba que no ha quedado nada");
});

test("la regla de compatibilidad avisa de que está duplicada", () => {
  /* Existe en js/perro.js para avisar antes de reservar. La de SQL
     manda. Si alguien toca una y no la otra, el cliente ve un aviso
     que no coincide con lo que luego pasa. */
  assert.match(sql, /también existe en js\/perro\.js/);
  assert.match(sql, /la de JavaScript desaparece/,
    "y tiene que estar escrito cuándo se quita la copia");
});
