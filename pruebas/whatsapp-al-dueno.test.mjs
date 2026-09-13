/* ============================================================
   Escribirle al dueño desde la ficha de su perro.

   Santiago, 13/09/2026: «quiero que al entrar en la ficha de un
   perro me salga la opción de mandarle un whatsapp a su dueño y
   ahí mandar las fotos, o los vídeos».

   Y aquí hay una limitación que no es nuestra y conviene tenerla
   clara antes de leer el código:

   UN ENLACE DE WHATSAPP NO PUEDE LLEVAR FOTOS. El `wa.me/...`
   sólo admite texto; WhatsApp no acepta adjuntos por enlace y no
   hay forma de rodearlo.

   Lo que SÍ funciona es el botón de compartir del propio móvil:
   la aplicación le pasa la foto al sistema, el sistema ofrece
   WhatsApp entre las opciones, y va con la foto puesta. Es un
   toque más, pero es el único camino que existe y funciona en
   Android y en iPhone.

   Así que son dos botones y hacen cosas distintas:
     «Escribirle»        -> abre el chat con el texto puesto
     «Mandarle una foto» -> compartir del sistema, con el fichero
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const aplanar = t => t.replace(/\s+/g, " ");
const vista = aplanar(leer("js/vistas/perros.js"));
const contacto = leer("js/contacto.js");

test("se puede escribir al dueño desde la ficha del perro", () => {
  assert.match(vista, /enlaceWhatsAppA|whatsappCon/);
});

test("el mensaje va empezado y con el nombre del perro", () => {
  /* «Hola» a secas obliga a escribirlo todo; con el nombre
     delante, el dueño sabe de qué va antes de abrirlo. */
  assert.match(vista, /d\.nombre/);
});

test("se escribe al teléfono DEL DUEÑO, no al de la residencia", () => {
  assert.match(contacto, /export function enlaceWhatsAppA/);
  const fn = contacto.match(/export function enlaceWhatsAppA[\s\S]*?\n\}/)[0];
  assert.match(fn, /telefono|numero/);
});

test("un teléfono español sin prefijo se arregla solo", () => {
  /* En la ficha la gente escribe «673229399» o «673 22 93 99».
     Sin el 34 delante, WhatsApp no encuentra a nadie. */
  const fn = contacto.match(/export function enlaceWhatsAppA[\s\S]*?\n\}/)[0];
  assert.match(fn, /34/);
});

test("si no hay teléfono, se dice: no sale un botón roto", () => {
  assert.match(vista, /sin tel[eé]fono|no tenemos su tel/i);
});

test("esto sólo lo ve administración", () => {
  /* Un cliente no tiene por qué ver el teléfono de nadie, ni
     siquiera el suyo en esta pantalla. */
  assert.match(vista, /es_admin/);
});

test("si no se sabe quién mira, se dice — no se esconde el botón", () => {
  /* El 13/09/2026 `miFicha()` falló toda la tarde por un permiso
     de columna, y el efecto aquí fue que desapareció el botón de
     escribirle al dueño. Sin decir nada, y sin parecerse en nada
     a la causa. Una función que se esconde por un fallo se busca
     durante horas. */
  const fuente = readFileSync(new URL("../js/vistas/perros.js", import.meta.url), "utf8");
  assert.doesNotMatch(fuente, /miFicha\(\)\.catch\(\(\) => null\)/,
    "esconder las cosas de administración por un fallo es mentir");
  assert.match(fuente, /noSeSabeQuienMira/);
});

test("desde aquí NO se mandan fotos", () => {
  /* Hubo un botón para compartir fotos y vídeos: un enlace de
     WhatsApp no puede llevar ficheros, y el único rodeo era el
     botón de compartir del propio móvil.

     Santiago lo quitó el 13/09/2026, y con razón: sólo funcionaba
     en el móvil, fallaba en el ordenador, y una vez abierta la
     conversación mandar una foto desde el propio WhatsApp es más
     rápido que desde aquí. Una función que sólo va a veces cansa
     más de lo que ayuda. */
  const fuente = readFileSync(new URL("../js/vistas/perros.js", import.meta.url), "utf8");
  assert.doesNotMatch(fuente, /navigator\.share|canShare|id="compartir"/,
    "se quitó a propósito: sólo funcionaba a veces");
});

test("pero el enlace para escribirle sigue estando", () => {
  const fuente = readFileSync(new URL("../js/vistas/perros.js", import.meta.url), "utf8");
  assert.match(fuente, /Escribirle por WhatsApp/);
  assert.match(fuente, /enlaceWhatsAppA/);
});
