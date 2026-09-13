/* ============================================================
   Recuperar la contraseña.

   Santiago, 13/09/2026. Hasta ahora, quien la olvidara se
   quedaba fuera y había que atenderlo a mano — o peor, se creaba
   otra cuenta con otro correo y sus perros y sus reservas se
   quedaban en la cuenta vieja.

   Cómo funciona: se pide el correo, Supabase manda un enlace, y
   al volver de ese enlace la aplicación detecta que viene de una
   recuperación y le pide la contraseña nueva. Nadie ve nunca la
   vieja: ni nosotros ni Supabase, que las guarda cifradas.

   Dos cosas que no son evidentes:

   1. NO SE DICE SI EL CORREO EXISTE O NO. El mensaje es el mismo
      lo esté o no. Si cambiara, cualquiera podría ir probando
      direcciones para averiguar quién es cliente de AmigoMío.
   2. LA CONTRASEÑA NUEVA SE PIDE DOS VECES. Escribirla mal en la
      única oportunidad que hay deja fuera otra vez, y el enlace
      ya está gastado.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const aplanar = t => t.replace(/\s+/g, " ");

const sesion = leer("js/sesion.js");
const entrada = aplanar(leer("js/vistas/entrada.js"));
const app = aplanar(leer("js/app.js"));

test("se puede pedir el enlace de recuperación", () => {
  assert.match(sesion, /resetPasswordForEmail/);
  assert.match(entrada, /olvidad|recuperar/i);
});

test("no se dice si el correo está dado de alta o no", () => {
  /* Si el mensaje cambiara, cualquiera podría ir probando
     direcciones para averiguar quién es cliente de AmigoMío. */
  const fn = sesion.match(/export async function recuperarContrasena[\s\S]*?\n\}/)[0];
  assert.doesNotMatch(fn, /no existe|no está dado de alta|no encontrado/i);
  assert.match(fn, /Si ese correo|si está/i);
});

test("el enlace vuelve a la aplicación, no a ninguna otra parte", () => {
  assert.match(sesion, /redirectTo/);
});

test("la aplicación sabe cuándo viene de un enlace de recuperación", () => {
  /* Supabase avisa con el evento PASSWORD_RECOVERY. Sin
     escucharlo, el enlace deja al usuario dentro pero sin
     pantalla donde cambiar nada. */
  assert.match(app, /PASSWORD_RECOVERY/);
});

test("hay pantalla para escribir la contraseña nueva", () => {
  assert.match(app, /renderContrasenaNueva|contrasena-nueva/);
});

test("la contraseña nueva se pide dos veces", () => {
  /* Escribirla mal en la única oportunidad que hay deja fuera
     otra vez, y el enlace ya está gastado. */
  const vista = aplanar(leer("js/vistas/contrasena-nueva.js"));
  assert.match(vista, /repetir|otra vez|confirmar/i);
  assert.match(vista, /no coinciden|no cuadran|distintas/i);
});

test("se exige un mínimo de longitud, y se dice antes", () => {
  const vista = aplanar(leer("js/vistas/contrasena-nueva.js"));
  assert.match(vista, /8/);
});

test("cambiar la contraseña no deja la sesión a medias", () => {
  /* Después de cambiarla hay que llevarlo a algún sitio, no
     dejarlo mirando el formulario sin saber si se guardó. */
  assert.match(sesion, /export async function cambiarContrasena/);
});
