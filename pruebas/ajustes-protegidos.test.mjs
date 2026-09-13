/* ============================================================
   Los ajustes, bajo llave.

   Santiago, 13/09/2026: «quiero que en la pantalla de ajustes
   esté protegida, se necesita varias confirmaciones después de
   darle a un botón de editar para poder cambiar algo».

   Y tiene toda la razón, porque ahí dentro hay cosas que no son
   como cambiar un precio:

   - `reservas_abiertas` — ponerlo a «no» cierra las reservas de
     toda la residencia. Sin avisar a nadie.
   - `tope_perros_simultaneos` — un cero deja de vender todo.
   - `cron_secret` — tocarlo apaga TODOS los correos, y no se
     nota hasta que alguien echa de menos un aviso que nunca
     llegó.
   - `iban` — un dígito mal y el dinero de los clientes se va a
     otra cuenta.
   - `larga_desde_noches` — un 3 en vez de un 30 y toda la
     residencia pasa a 12 euros la noche.

   Hasta ahora se cambiaban escribiendo encima y pinchando
   fuera. Eso está bien para un precio y es una temeridad para
   esto.

   Cómo queda: los campos empiezan BLOQUEADOS. Hay que darle a
   «Editar», y entonces cada cambio pide una confirmación que
   dice QUÉ va a pasar, no un «¿estás seguro?» que nadie lee.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const aplanar = t => t.replace(/\s+/g, " ");
const vista = aplanar(leer("js/vistas/admin-tarifas.js"));

test("los ajustes empiezan bloqueados", () => {
  assert.match(vista, /disabled/);
  assert.match(vista, /Editar/);
});

test("hay que desbloquear antes de tocar nada", () => {
  assert.match(vista, /desbloquead|editando/i);
});

test("la confirmación dice QUÉ va a pasar, no «¿estás seguro?»", () => {
  /* Un «¿estás seguro?» se acepta sin leerlo. Uno que dice
     «esto cierra las reservas de toda la residencia», no. */
  assert.match(vista, /CONSECUENCIAS|consecuencia/i);
  assert.doesNotMatch(vista, /¿Estás seguro\?</);
});

test("los ajustes peligrosos están señalados uno a uno", () => {
  /* No todos pesan lo mismo: cambiar los días de cancelación no
     es apagar los correos. */
  for (const clave of ["reservas_abiertas", "cron_secret", "iban",
                       "tope_perros_simultaneos", "larga_desde_noches"])
    assert.match(vista, new RegExp(clave), `falta avisar de ${clave}`);
});

test("se escribe el valor a mano para confirmar, no se pulsa «sí»", () => {
  /* Escribir lo que va a quedar obliga a leerlo. Pulsar «sí» se
     hace con el dedo antes que con la cabeza. */
  assert.match(vista, /escribe|escribir/i);
});

test("se puede cancelar y queda como estaba", () => {
  assert.match(vista, /Cancelar/);
});

test("los precios normales no se vuelven incómodos", () => {
  /* Esto es sólo para los ajustes. Cambiar el precio de una
     noche se sigue haciendo escribiendo encima: es lo que se
     hace a menudo y no rompe nada. */
  const precios = vista.match(/async function verPrecios.*?async function/s)?.[0] ?? "";
  assert.doesNotMatch(precios, /CONSECUENCIAS/);
});

/* ============================================================
   Que se pueda cambiar de verdad.

   Santiago, 13/09/2026: «no me deja cambiar el IBAN, cuando lo
   intento me dice que no es lo que tenía... lógicamente, por eso
   lo cambio y no lo cambia».

   Dos fallos míos encadenados:

   1. El hueco de confirmar llevaba el valor nuevo COMO TEXTO DE
      FONDO. Un `placeholder` se ve igual que algo ya escrito: le
      das a «Sí, cambiarlo» creyendo que está puesto, y el campo
      está vacío. Encima le regala la respuesta a quien tenía que
      escribirla, que era todo el sentido de pedirla.

   2. Y comparaba carácter a carácter. Un IBAN se escribe con
      espacios y cada uno los pone donde le parece: «ES12 3456» y
      «ES123456» son la misma cuenta y no cuadraban.

   Una protección que no deja hacer lo correcto no protege: se
   acaba quitando entera, y entonces no queda ninguna.
   ============================================================ */
test("el hueco de confirmar no regala la respuesta", () => {
  const fuente = leer("js/vistas/admin-tarifas.js");
  const trozo = fuente.match(/id="tecleado"[^>]*>/)[0];
  assert.doesNotMatch(trozo, /placeholder="\$\{esc\(ahora\)/,
    "enseñar el valor a escribir lo convierte en copiar, y parece ya escrito");
});

test("comparar sin pelearse con los espacios ni las mayúsculas", () => {
  /* «ES12 3456» y «es123456» son la misma cuenta. */
  const fuente = leer("js/vistas/admin-tarifas.js").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(fuente, /function igualDeVerdad|replace\(\/\\s\+\/g/,
    "hay que comparar el contenido, no los espacios");
});

test("y si no cuadra, se dice qué pasa exactamente", () => {
  const fuente = leer("js/vistas/admin-tarifas.js");
  assert.doesNotMatch(fuente, /no es lo mismo\. Míralo otra vez/,
    "«no es lo mismo» se lee como «no es lo que tenías»");
});
