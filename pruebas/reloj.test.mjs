/* ============================================================
   El reloj de las 24 horas, y el justificante.

   El agujero más grave que había: la reserva se creaba con
   fecha de caducidad, al cliente se le ENSEÑABA («tienes hasta
   el jueves a las 18:30»)… y no había nada que la ejecutara.

   Consecuencia: alguien pedía un box para Semana Santa, no
   pagaba, no volvía nunca, y ese box quedaba bloqueado para
   siempre. Le prometíamos al cliente algo que no cumplíamos y
   a AmigoMío le reservábamos plazas fantasma.

   Y el justificante: la columna existía, la pantalla decía «nos
   falta el justificante» y no había por dónde mandarlo.

   Quién hace qué:
   - El CLIENTE sube el justificante. Eso NO confirma la
     reserva: para el reloj, nada más.
   - ADMINISTRACIÓN lo mira y confirma. Una transferencia se ve
     en la cuenta, no en una foto: la foto puede ser de
     cualquier cosa.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const sinComentarios = t => t.replace(/^\s*--.*$/gm, "");
const aplanar = t => sinComentarios(t).replace(/\s+/g, " ");

const sql = aplanar(leer("db/reloj.sql"));

/* ---------- El reloj ---------- */
test("existe la función que suelta las reservas sin pagar", () => {
  assert.match(sql, /create or replace function caducar_reservas/);
});

test("sólo toca las pendientes que ya pasaron de hora", () => {
  assert.match(sql, /estado = 'pendiente'/);
  assert.match(sql, /expira < now\(\)/);
});

test("no toca una confirmada aunque tenga fecha de caducidad", () => {
  /* Quien ya pagó no pierde su sitio porque alguien olvidara
     borrarle el `expira`. */
  assert.match(sql, /assert.*confirmada/i);
});

test("la ejecuta el servidor, no el navegador", () => {
  /* Si dependiera de que alguien abra la aplicación, las
     reservas de agosto caducarían en septiembre. */
  assert.match(sql, /cron\.schedule|pg_cron/);
});

test("deja constancia de que caducó, no la borra", () => {
  /* Una reserva borrada es una pregunta sin respuesta cuando el
     cliente llame diciendo que él sí pagó. */
  assert.match(sql, /'caducada'/);
  /* Mirando sólo la función del reloj: el bloque de pruebas de
     abajo sí borra, pero lo que él mismo creó. */
  const reloj = sql.match(/function caducar_reservas.*?end \$\$;/s)[0];
  assert.doesNotMatch(reloj, /delete from reserva/,
    "una reserva borrada es una pregunta sin respuesta cuando el cliente llame");
});

test("se puede llamar a mano si el cron no está disponible", () => {
  /* pg_cron es una extensión y puede no estar activada. Que la
     falta de cron no signifique que no hay reloj. */
  assert.match(sql, /security definer/,
    "administración tiene que poder dispararla desde el panel");
});

/* ---------- El justificante ---------- */
test("el justificante se guarda en el cubo privado, no en abierto", () => {
  const storage = aplanar(leer("db/storage.sql"));
  assert.match(storage, /justificantes/);
  assert.match(storage, /'justificantes', *'justificantes', *false/,
    "un justificante lleva el número de cuenta del cliente");
});

test("subirlo NO confirma la reserva", () => {
  /* Una foto puede ser de cualquier cosa. La transferencia se
     ve en la cuenta, no en la foto. */
  assert.match(sql, /create or replace function subir_justificante/);
  const subir = sql.match(/function subir_justificante.*?end \$\$;/s)[0];
  assert.doesNotMatch(subir, /'confirmada'/,
    "subir el papel no puede confirmar: la transferencia se ve en la cuenta");
  assert.match(sql, /'revisando'/,
    "hace falta un estado intermedio: ni pendiente ni confirmada");
});

test("subirlo sí para el reloj", () => {
  /* Si no, el cliente paga, manda el papel, y a las 24 h pierde
     el sitio igual. */
  assert.match(sql, /expira = null/);
});

test("confirmar es cosa de administración", () => {
  assert.match(sql, /create or replace function validar_justificante/);
  assert.match(sql, /es_admin\(\)/);
});

test("y rechazarlo devuelve el reloj, no mata la reserva", () => {
  /* Si el papel no vale, el cliente tiene que poder mandar otro.
     Matarla en ese momento es perder al cliente por una foto
     movida. */
  assert.match(sql, /rechazar_justificante/);
});

test("la pantalla del cliente deja subirlo", () => {
  const vista = aplanar(leer("js/vistas/mis-reservas.js"));
  assert.match(vista, /subirJustificante/);
});

test("la pantalla de administración deja mirarlo y decidir", () => {
  const vista = aplanar(leer("js/vistas/admin-estancia.js"));
  assert.match(vista, /validarJustificante/);
  assert.match(vista, /rechazarJustificante/);
});

test("las funciones de administración se pueden probar desde el SQL Editor", () => {
  /* En el editor `auth.uid()` es nulo, así que `es_admin()` es
     falso: una prueba honesta abortaba la instalación entera con
     «Esto lo decide administración». `es_admin_o_servidor()`
     distingue a la persona del servidor, y no abre ninguna
     puerta: lo que entra por internet llega como `anon` o
     `authenticated`, nunca como `postgres`. */
  assert.match(sql, /es_admin_o_servidor\(\)/);

  const esquema = aplanar(leer("db/schema.sql"));
  assert.match(esquema, /create or replace function es_admin_o_servidor/);
  assert.match(esquema, /current_user in \('postgres','supabase_admin'\)/);
});
