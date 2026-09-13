/* ============================================================
   Cómo se llega hasta nosotros, y qué se cobra por venir fuera
   de hora.

   Dos encargos de Santiago del 12/09/2026:

   - Donde diga que hay recargo, que DIGA CUÁNTO. «Fuera de
     estos horarios hay recargo» deja al cliente sin saber si
     son diez euros o cien, y eso no se pregunta: se abandona.
   - Que nos HABLE, no que nos LLAME. Hay gente que no llama por
     teléfono ni queriendo, y el WhatsApp lo abre todo el mundo.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TELEFONO, TELEFONO_BONITO, enlaceWhatsApp } from "../js/contacto.js";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const aplanar = t => t.replace(/\s+/g, " ");
/* Mirando el código de verdad, no los comentarios: el texto viejo
   sigue citado ahí, explicando por qué se cambió. */
const soloCodigo = t => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("el teléfono es el de AmigoMío, en formato internacional", () => {
  /* Sin el +34 el enlace de WhatsApp no abre nada fuera de
     España, y medio cliente de la residencia viene de fuera. */
  assert.equal(TELEFONO, "+34673229399");
  assert.equal(TELEFONO_BONITO, "673 229 399");
});

test("el enlace de WhatsApp va al número, sin espacios ni signos", () => {
  const url = enlaceWhatsApp();
  assert.match(url, /^https:\/\/wa\.me\/34673229399/);
  assert.doesNotMatch(url, /\+|\s/);
});

test("se le puede dejar el mensaje empezado", () => {
  const url = enlaceWhatsApp("Quiero recoger a Luna a las 21:00");
  assert.match(url, /[?&]text=/);
  assert.ok(url.includes(encodeURIComponent("Quiero recoger a Luna a las 21:00")));
});

test("donde hay recargo se dice cuánto, no «hay recargo» a secas", () => {
  const reservar = aplanar(soloCodigo(leer("js/vistas/reservar.js")));
  assert.doesNotMatch(reservar, /hay recargo: llámanos/,
    "el texto viejo no decía ni cuánto ni por dónde hablar");
  /* Los tres importes salen de la base de datos, que es donde se
     editan, no escritos a mano aquí. */
  assert.match(reservar, /fuera_horario_noche/);
  assert.match(reservar, /fuera_horario_finde/);
  assert.match(reservar, /fuera_horario_semana/);
  /* Y las franjas, que son lo que hay que mirar antes. */
  assert.match(reservar, /21:00/);
  assert.match(reservar, /7:30|07:30/);
  assert.match(reservar, /por cada movimiento|cada movimiento/i,
    "entrada y salida fuera de hora son DOS recargos, y hay que decirlo");
});

test("en ningún sitio se le pide al cliente que llame", () => {
  for (const f of ["js/vistas/reservar.js", "js/vistas/mis-reservas.js",
                   "js/zapatilla.js"]) {
    const t = soloCodigo(leer(f));
    assert.doesNotMatch(t, /llámanos|llámalos|llama al/i,
      `${f} sigue pidiendo que llame`);
  }
});

test("hay por dónde hablarnos donde antes ponía que llamáramos", () => {
  for (const f of ["js/vistas/reservar.js", "js/vistas/mis-reservas.js"]) {
    assert.match(leer(f), /enlaceWhatsApp|whatsapp/i, `${f} no ofrece WhatsApp`);
  }
});

test("Zapatilla también da el WhatsApp, no solo el teléfono", () => {
  const z = aplanar(soloCodigo(leer("supabase/functions/zapatilla/index.ts")));
  assert.match(z, /wa\.me\/34673229399/);
  assert.doesNotMatch(z, /llama al 673/i, "que hable, no que llame");
});

/* ---------- Escribirle a otra persona ---------- */
import { enlaceWhatsAppA } from "../js/contacto.js";

test("a un móvil español sin prefijo se le pone el 34", () => {
  /* En la ficha la gente escribe el teléfono como le sale. Sin
     el prefijo, WhatsApp no encuentra a nadie y el botón parece
     roto. */
  assert.match(enlaceWhatsAppA("673229399"), /wa\.me\/34673229399/);
  assert.match(enlaceWhatsAppA("673 22 93 99"), /wa\.me\/34673229399/);
  assert.match(enlaceWhatsAppA("+34 673 229 399"), /wa\.me\/34673229399/);
});

test("un número de fuera se deja como está", () => {
  /* Con prefijo ya puesto no se toca: ponerle otro 34 delante
     lo rompería. */
  assert.match(enlaceWhatsAppA("+351 912 345 678"), /wa\.me\/351912345678/);
});

test("sin número no hay enlace", () => {
  /* Devolver un enlace a ninguna parte es peor que no devolver
     nada: quien llama decide qué enseñar. */
  assert.equal(enlaceWhatsAppA(""), null);
  assert.equal(enlaceWhatsAppA(null), null);
  assert.equal(enlaceWhatsAppA("12345"), null);
});

test("el mensaje se puede dejar escrito", () => {
  const url = enlaceWhatsAppA("673229399", "Hola, te escribo por Luna");
  assert.ok(url.includes(encodeURIComponent("Hola, te escribo por Luna")));
});
