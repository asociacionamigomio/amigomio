/* ============================================================
   «Por validar»: lo que está esperando a administración.

   Santiago, 13/09/2026: «en el perfil de administración no me
   salen las cosas para validar».

   No era un fallo: la pantalla no existía. Mirando la base ese
   mismo día había una reserva en «revisando» —un cliente había
   subido su justificante y llevaba ahí esperando— y dos en
   «pendiente». Para verlas había que ir al cuadrante y pinchar
   las reservas UNA POR UNA, a ver si alguna tenía algo.

   Eso no es una pantalla de administración: es una búsqueda del
   tesoro. Y lo que se le pierde a uno así es el dinero de una
   reserva que nadie confirmó.

   Una residencia con 32 boxes necesita una sola pantalla que
   diga QUÉ TE ESTÁ ESPERANDO, y desde la que se resuelva. Si
   hay que ir a buscarlo, no se mira; y si no se mira, la
   aplicación no sirve para lo que se hizo.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const sinComentarios = s => s.replace(/\/\*[\s\S]*?\*\//g, "");

const datos = leer("js/datos.js");
const app = leer("js/app.js");

test("existe la pantalla «Por validar»", () => {
  assert.ok(existsSync(new URL("../js/vistas/admin-validar.js", import.meta.url)),
    "falta js/vistas/admin-validar.js");
});

test("está en el menú de administración, y la PRIMERA", () => {
  /* Es lo que se mira al entrar. Debajo de «Libro de registro»
     no la vería nadie. */
  const f = sinComentarios(app);
  assert.match(f, /id: "validar"/);

  const seccion = f.match(/const SECCIONES = \[[\s\S]*?\n\];/)[0];
  const admins = [...seccion.matchAll(/id: "([^"]+)"[^\n]*admin: true/g)].map(m => m[1]);
  assert.equal(admins[0], "validar",
    "tiene que ser la primera de administración: es lo que se mira al entrar");
});

test("recoge las cuatro cosas que esperan, no una", () => {
  /* Un sitio donde mirar. Si hay cuatro sitios, se olvida uno —
     y justo ese es el que tiene el dinero. */
  const f = sinComentarios(datos);
  assert.match(f, /export async function cosasPorValidar/);
  const fn = f.match(/export async function cosasPorValidar[\s\S]*?\n\}/)[0];

  for (const que of ["revisando", "pendiente", "solicitud_cambio", "interes"])
    assert.ok(fn.includes(que), `«${que}» no se mira en cosasPorValidar()`);
});

test("lo que más corre, primero", () => {
  /* Una reserva en «revisando» tiene a un cliente esperando con
     el dinero ya pagado. Un interés en educación puede esperar a
     mañana. El orden de la pantalla es el orden de la prisa. */
  const vista = sinComentarios(leer("js/vistas/admin-validar.js"));
  assert.ok(vista.indexOf("revisando") < vista.indexOf("interes"),
    "los justificantes van antes que los intereses");
});

test("desde la pantalla se resuelve, no sólo se mira", () => {
  /* Una lista que sólo enseña obliga a ir a otro sitio a hacer
     lo que hay que hacer, y entonces no se usa. */
  const vista = leer("js/vistas/admin-validar.js");
  assert.match(vista, /validarJustificante/);
  assert.match(vista, /rechazarJustificante/);
});

test("y se puede ver el justificante antes de darle al botón", () => {
  /* Confirmar un pago sin mirar el resguardo es confirmar
     cualquier cosa. */
  const vista = leer("js/vistas/admin-validar.js");
  assert.match(vista, /verJustificante/);
});

test("si no hay nada que validar, lo dice con todas las letras", () => {
  const vista = leer("js/vistas/admin-validar.js");
  assert.match(vista, /al día|Nada pendiente|nada que/i);
});

test("un error no se disfraza de «no hay nada»", () => {
  /* Es la trampa de esta pantalla: si la consulta falla y se
     enseña «todo al día», administración se queda tranquila
     mientras un cliente espera. Mentir aquí cuesta dinero. */
  const vista = sinComentarios(leer("js/vistas/admin-validar.js"));
  assert.match(vista, /catch/);
  assert.match(vista, /No hemos podido|no hemos podido/,
    "hay que decir que ha fallado, no enseñar una lista vacía");
});

test("la aplicación aguanta con la base a medias", () => {
  /* EL NAVEGADOR SE DESPLIEGA ANTES QUE LA BASE. SIEMPRE. */
  const fn = sinComentarios(datos)
    .match(/export async function cosasPorValidar[\s\S]*?\n\}/)[0];
  assert.match(fn, /catch|allSettled/,
    "si una de las cuatro consultas falla, las otras tres tienen que salir");
});

test("los estados que se escriben son los que admite la base", () => {
  /* El `check` de Postgres sólo admite nueva/hablada/apuntado/
     descartada. Inventarse «atendida» lo rechaza la base y el
     botón no hace nada. */
  const vista = leer("js/vistas/admin-validar.js");
  const sql = leer("db/actividades.sql");
  const validos = sql.match(/estado in \('nueva'[^)]*\)/)[0];
  for (const m of vista.matchAll(/atenderInteres\([^,]+,\s*"([^"]+)"/g))
    assert.ok(validos.includes(`'${m[1]}'`),
      `«${m[1]}» no es un estado que admita la tabla interes`);
});

test("una pantalla vacía se explica: vacía y rota no se parecen", () => {
  /* Santiago, 13/09/2026: «no me sale en mensajes las solicitudes
     pendientes». No salían porque no había ninguna —cero en la
     base, nunca ha habido— pero un «Nada pendiente» a secas no
     distingue «no hay» de «no funciona». Después del día que
     llevamos, eso no vale. */
  for (const v of ["js/vistas/admin-validar.js", "js/vistas/admin-solicitudes.js"]) {
    const vacio = leer(v).match(/vacio[\s\S]{0,600}?<\/div>/)[0];
    assert.match(vacio, /Aquí (aparecen|llegan)/,
      `${v} no explica de dónde salen las cosas cuando no hay ninguna`);
  }
});

test("pedir un cambio que falla deja rastro", () => {
  /* Un mensaje amable sin rastro de la causa es lo que convierte
     un fallo de cinco minutos en un día entero. */
  const fn = sinComentarios(leer("js/datos.js"))
    .match(/export async function pedirCambio[\s\S]*?\n\}/)[0];
  assert.match(fn, /console\.error/);
});

/* ============================================================
   Descartar: quitar de la lista lo que no procede.

   Santiago, 13/09/2026: «necesito que en las validaciones me deje
   eliminar lo que considere, reservas o lo que sea».

   Una lista de la que no se puede quitar nada se llena de cosas
   que ya no sirven —la reserva de alguien que llamó y lo anuló,
   la que está duplicada— y entonces deja de mirarse. Una pantalla
   de pendientes sólo vale si se puede vaciar.

   Pero NO se borra de la base: se CANCELA. Una residencia con
   libro de registro no puede perder el rastro de quién reservó
   qué de cara a una inspección. Desaparece de la lista, libera el
   box, y queda el apunte.
   ============================================================ */
test("se puede quitar de la lista cualquier cosa que haya", () => {
  const vista = leer("js/vistas/admin-validar.js");
  assert.match(vista, /data-descartar/,
    "las reservas tienen que poder quitarse de la lista");
  /* Y las otras tres ya tenían su manera: rechazar la solicitud y
     descartar el interés. */
  assert.match(vista, /data-solicitud/);
  assert.match(vista, /descartada/);
});

test("descartar CANCELA, no borra", () => {
  /* El libro de registro es obligatorio para las inspecciones.
     Un `delete` ahí deja un hueco que no se puede explicar. */
  const vista = sinComentarios(leer("js/vistas/admin-validar.js"));
  assert.doesNotMatch(vista, /borrarReserva|\.delete\(/,
    "de aquí no se borra nada de la base: se cancela");
  assert.match(vista, /cancelarReserva|cambiarEstado/);
});

test("los estados que escribe son los que admite la base", () => {
  const vista = leer("js/vistas/admin-validar.js");
  const validos = leer("db/reservas.sql").match(/estado in \('pendiente'[\s\S]*?\)\)/)[0];
  for (const m of vista.matchAll(/cambiarEstado\([^,]+,\s*"([^"]+)"/g))
    assert.ok(validos.includes(`'${m[1]}'`),
      `«${m[1]}» no es un estado que admita la tabla reserva`);
});

test("no se descarta sin preguntar", () => {
  /* Es lo único de esta pantalla que le quita una reserva a un
     cliente. Un resbalón con el dedo en el móvil no puede
     cancelarle a nadie sus vacaciones. */
  const vista = sinComentarios(leer("js/vistas/admin-validar.js"));
  const trozo = vista.match(/data-descartar[\s\S]{0,1200}/)[0];
  assert.match(trozo, /confirm|¿/,
    "descartar tiene que pedir confirmación");
});
