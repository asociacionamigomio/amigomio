/* ============================================================
   La hoja del día: que sirva para trabajar, no sólo para mirar.

   Santiago, 13/09/2026:
     «debe dejar que varíe el box»
     «tb debe dejarme entrar en la ficha del perro para ver su
      info, alimentación, medicaciones y tal»
     «tb quiero que me diga cuántos días le quedan a cada perro
      para salir»

   Las tres son la misma idea: la hoja del día es la pantalla que
   se tiene delante mientras se trabaja con los perros. Si para
   mover a uno de box hay que irse al cuadrante, y para ver qué
   come hay que irse a Clientes y buscarlo, entonces la hoja no
   se usa y se vuelve al papel.

   Y los días que quedan importan más de lo que parece: es lo que
   decide si hoy toca preparar una salida, avisar al dueño o pedir
   más comida.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const sinComentarios = s => s.replace(/\/\*[\s\S]*?\*\//g, "");

const vista = leer("js/vistas/admin-hoja.js");
const sql = leer("db/administracion.sql");

/* ---------- Los días que quedan ---------- */
test("la base dice cuántos días le quedan a cada perro", () => {
  const fn = sql.match(/function hoja_del_dia[\s\S]*?\$\$;/)[0];
  assert.match(fn, /'dias'/, "hay que contarlo en Postgres, no a ojo");
  assert.match(fn, /r\.salida::date - el_dia/,
    "los días que quedan se cuentan contra el día de la hoja, no contra hoy");
});

test("y la hoja lo enseña en cristiano", () => {
  /* «1» no se lee. «Se va mañana» sí. */
  assert.match(vista, /Se va mañana|se va mañana/);
  assert.match(vista, /quedan/i);
});

/* ---------- Cambiar el box ---------- */
test("se puede cambiar el box desde la hoja", () => {
  assert.match(vista, /moverDeAlojamiento/);
  assert.match(vista, /data-mover/);
});

test("y avisa de que se mueve la reserva entera, no un perro", () => {
  /* Un box es de la RESERVA. Si van tres perros juntos, cambiar
     el box los mueve a los tres — y quien lo toca tiene que
     saberlo antes, no después. */
  assert.match(vista, /se mueven todos|el box es de la\s+RESERVA/i,
    "quien lo toca tiene que saberlo ANTES, no después");
});

test("la base da el identificador del alojamiento, no sólo el nombre", () => {
  /* Con el nombre no se puede mover nada. */
  const fn = sql.match(/function hoja_del_dia[\s\S]*?\$\$;/)[0];
  assert.match(fn, /'alojamiento_id'/);
});

/* ---------- Entrar en la ficha del perro ---------- */
test("se entra en la ficha del perro desde la hoja", () => {
  assert.match(vista, /verPerro/);
  const fn = sql.match(/function hoja_del_dia[\s\S]*?\$\$;/)[0];
  assert.match(fn, /'perro_id'/, "sin el identificador no se puede abrir la ficha");
});

/* ---------- Y que siga sirviendo para lo que se hizo ---------- */
test("los mandos NO se imprimen", () => {
  /* La hoja se imprime y se cuelga en la nave. Un desplegable
     impreso es una mancha gris que no dice nada, y encima
     desplaza lo que sí importa. */
  const trozo = sinComentarios(vista);

  /* El desplegable tiene que estar DENTRO de algo marcado como
     que no se imprime. Se mira lo que hay justo antes de él. */
  const antes = trozo.slice(0, trozo.indexOf("data-mover")).slice(-400);
  assert.match(antes, /no-imprimir/,
    "el desplegable de mover se imprimiría como una mancha gris");

  const antesFicha = trozo.slice(0, trozo.indexOf("data-perro")).slice(-400);
  assert.match(antesFicha, /no-imprimir/,
    "el botón de la ficha tampoco pinta nada en el papel");
});

test("sigue teniendo las casillas de los paseos y la firma", () => {
  /* El programa sanitario exige observación dos veces al día
     anotada. Esto es el papel donde se hace: si se pierde por
     meter botones, hemos roto lo que funcionaba. */
  assert.match(vista, /hoja-casillas/);
  assert.match(vista, /Firma/);
});
