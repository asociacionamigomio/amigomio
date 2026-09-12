/* ============================================================
   La sobreventa no se evita comprobando antes de guardar: se
   evita con una restricción del motor que hace IMPOSIBLE guardar
   dos reservas solapadas en el mismo alojamiento.

   La diferencia importa cuando dos clientes pulsan a la vez.
   Una comprobación previa deja un hueco entre el "¿hay sitio?" y
   el "guarda"; la restricción no.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lee = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const sql = lee("db/reservas.sql");

test("la sobreventa la impide el motor, no una comprobación previa", () => {
  assert.match(sql, /exclude\s+using\s+gist/i,
    "hace falta una restricción de exclusión, no un select antes de insertar");
  assert.match(sql, /alojamiento_id\s+with\s+=/i);
  assert.match(sql, /daterange[\s\S]{0,80}with\s+&&/i);
});

test("la restricción solo mira las reservas vivas", () => {
  /* Una reserva cancelada o caducada no puede seguir bloqueando
     el alojamiento. */
  const i = sql.indexOf("sin_solapes");
  const bloque = sql.slice(i, i + 500);
  assert.match(bloque, /where\s*\(estado in \('pendiente','confirmada','en_curso'\)\)/i);
});

test("el rango es '[)': salir e entrar el mismo día no se solapa", () => {
  /* El perro se va por la mañana y entra otro por la tarde. Si el
     rango fuera cerrado, perderías una noche de cada box en cada
     cambio de ocupante. */
  assert.match(sql, /daterange\(entrada::date, salida::date, '\[\)'\)/);
  assert.match(sql, /Encadenar sí vale/);
});

test("se comprueban los dos topes, no solo los alojamientos", () => {
  assert.match(sql, /perros_dentro/);
  assert.match(sql, /tope_perros_simultaneos/);
  assert.match(sql, /if tope is not null then/i,
    "si el tope está vacío no se aplica, pero si está puesto sí");
});

test("las pruebas del SQL comprueban el solape de verdad", () => {
  assert.match(sql, /exception when exclusion_violation/i);
  assert.match(sql, /TIENE que rechazar dos reservas solapadas/);
});

test("las pruebas limpian lo que crean", () => {
  assert.match(sql, /delete from reserva where id = reserva_prueba/);
  assert.match(sql, /update ajuste set valor = '90'/,
    "y dejan el tope como estaba");
});

test("reserva y reserva_perro llevan RLS", () => {
  for (const t of ["reserva", "reserva_perro"])
    assert.match(sql, new RegExp(`alter\\s+table\\s+${t}\\s+enable\\s+row\\s+level\\s+security`, "i"));
});

test("el precio se guarda congelado dentro de la reserva", () => {
  assert.match(sql, /desglose\s+jsonb/i);
  assert.match(sql, /total\s+numeric/i);
  assert.match(sql, /se CONGELA/);
});
