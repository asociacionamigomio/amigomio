/* ============================================================
   Que la aplicación ARRANQUE, y que si no arranca lo diga.

   Santiago, 13/09/2026, en su móvil: «aparece cargando, pero no
   carga». Y en el ordenador, perfecta.

   «Cargando…» es el texto que trae `index.html` de fábrica,
   antes de que corra nada. Que se quede ahí significa que el
   arranque se atascó — y la pantalla no lo dice, así que no hay
   forma de saber en qué.

   Tres fallos de diseño míos, cada uno capaz de dejar esa
   pantalla clavada para siempre:

   1. **El service worker devolvía `index.html` cuando fallaba
      CUALQUIER petición.** Si lo que se pedía era un módulo de
      JavaScript, el navegador recibía una página HTML donde
      esperaba código: error de sintaxis, y la aplicación entera
      no arranca. Con mala cobertura pasa a la primera.

   2. **Sólo se guardaban 7 ficheros.** Los otros 34 se pedían a
      la red en cada arranque. Treinta y cuatro oportunidades de
      fallar, y basta una.

   3. **La librería de Supabase venía de un CDN de internet.** Si
      ese CDN va lento o no contesta, la aplicación no arranca, y
      no es nuestro y no se puede guardar.

   Y por encima de las tres: si algo se atasca, hay que DECIRLO.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const sinComentarios = s => s.replace(/\/\*[\s\S]*?\*\//g, "");

const sw = leer("sw.js");
const indice = leer("index.html");
const app = leer("js/app.js");

/* ---------- 1. Un módulo tiene que fallar como módulo ---------- */
test("index.html NO se devuelve en lugar de un módulo de JavaScript", () => {
  /* Devolver la página entera cuando lo que se pedía era
     `js/app.js` le da al navegador HTML donde espera código. La
     aplicación no arranca y la pantalla se queda en «Cargando…»
     sin decir por qué. Sólo una NAVEGACIÓN puede caer ahí. */
  const f = sinComentarios(sw);

  /* Se busca dónde se SIRVE la portada como recambio, no dónde se
     guarda: en la lista de lo que se guarda sale también. */
  const recambio = /(.{0,300})(?:cache|caches)\.match\(\s*"\.\/index\.html"\s*\)/s.exec(f);
  assert.ok(recambio, "el service worker tiene que poder servir la portada");
  assert.match(recambio[1], /navigate/,
    "la portada sólo vale como recambio de una NAVEGACIÓN, nunca de un módulo");
});

/* ---------- 2. Se guarda TODO lo que hace falta para abrir ---------- */
test("se guarda todo el JavaScript de la aplicación, no una parte", () => {
  /* Lo que no está guardado se pide a la red cada vez que se
     abre. Un fichero que no llega es una aplicación que no
     arranca. */
  const modulos = [
    ...readdirSync(new URL("../js", import.meta.url))
      .filter(f => f.endsWith(".js")).map(f => "js/" + f),
    ...readdirSync(new URL("../js/vistas", import.meta.url))
      .filter(f => f.endsWith(".js")).map(f => "js/vistas/" + f),
  ];

  for (const m of modulos)
    assert.ok(sw.includes(`"./${m}"`),
      `${m} no está en LO_BASICO: sin él la aplicación no abre sin cobertura`);
});

test("se guardan también el estilo, el logo y el manifiesto", () => {
  for (const f of ["./index.html", "./css/estilo.css", "./manifest.webmanifest",
                   "./assets/logo.png"])
    assert.ok(sw.includes(`"${f}"`), `falta ${f}`);
});

/* ---------- 3. Nada de fuera para arrancar ---------- */
test("la aplicación no depende de ningún CDN para arrancar", () => {
  /* Un CDN que va lento es una aplicación que no abre, y no es
     nuestro: no se puede guardar ni arreglar. La librería de
     Supabase vive en el repositorio, con su versión clavada. */
  const guiones = [...indice.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1]);
  for (const g of guiones)
    assert.doesNotMatch(g, /^https?:\/\//,
      `${g} viene de internet: si no contesta, la aplicación no arranca`);
});

test("la librería de Supabase está en el repositorio", () => {
  assert.ok(existsSync(new URL("../js/vendor/supabase.js", import.meta.url)),
    "falta js/vendor/supabase.js");
  assert.ok(indice.includes("js/vendor/supabase.js"));
});

/* ---------- 4. Si se atasca, que lo diga ---------- */
test("hay un vigía que avisa si el arranque se atasca", () => {
  /* Y es JavaScript normal, no un módulo: si lo que falla es
     justamente la carga de los módulos, el vigía tiene que
     seguir vivo para poder contarlo. */
  const sueltos = [...indice.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)];
  const vigia = sueltos.find(s => /setTimeout/.test(s[2]));
  assert.ok(vigia, "index.html no lleva ningún vigía del arranque");
  assert.doesNotMatch(vigia[1], /type="module"/,
    "como módulo no correría justo cuando más falta hace");
});

test("el aviso de atasco lleva a la página de rescate", () => {
  assert.match(indice, /reiniciar\.html/,
    "quedarse atascado sin salida es quedarse atascado");
});

test("el arranque no puede romperse en silencio", () => {
  /* `arrancar()` es una promesa: si revienta por dentro y nadie
     la recoge, no pasa absolutamente nada en la pantalla. */
  const f = sinComentarios(app);
  assert.match(f, /arrancar\(\)[\s\S]{0,200}?\.catch\(/,
    "arrancar() tiene que recoger su propio error y pintarlo");
});

test("cuando arranca bien, el vigía se calla", () => {
  const f = sinComentarios(app);
  assert.match(f, /arrancoBien/,
    "si no se avisa de que fue bien, el aviso de atasco sale igual");
  assert.match(indice, /arrancoBien/);
});

test("el mensaje de atasco está escrito para una persona", () => {
  const sueltos = [...indice.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map(s => s[1]).join("\n");
  assert.doesNotMatch(sueltos, /error 500|stack|undefined is not/i);
  assert.match(sueltos, /tardando|atascad|no acaba de abrir/i,
    "hay que decir qué pasa, no sólo que pasa algo");
});

/* ============================================================
   Y el fallo de verdad, el que dejaba «Cargando…» clavado.

   `supabase.auth.getUser()` no lee la sesión: le PREGUNTA AL
   SERVIDOR quién eres, por internet. Y mirando la librería (que
   ahora está en el repositorio y se puede leer):

     catch(e){ if (esErrorDeAutenticación(e)) return {user:null};
               throw e }

   Un fallo de red NO es un error de autenticación. Así que no
   devuelve «no hay usuario»: REVIENTA. Y `miFicha()`, que es de
   lo primero que hace el arranque, lo llamaba a pelo.

   Un segundo de mala cobertura al abrir = aplicación muerta. En
   el ordenador no pasa jamás; en un móvil, a la primera.

   Quién eres ya lo sabemos: está en la sesión, guardada en el
   propio móvil. No hay que preguntárselo a nadie. Y quién puede
   ver qué no lo decide el navegador — lo decide RLS.
   ============================================================ */
const datos = leer("js/datos.js");
const push = leer("js/push.js");
const sesionjs = leer("js/sesion.js");

test("nadie le pregunta al servidor quién eres: la sesión ya lo dice", () => {
  for (const [nombre, f] of [["datos.js", datos], ["push.js", push],
                             ["sesion.js", sesionjs]])
    assert.doesNotMatch(sinComentarios(f), /auth\.getUser\(\)/,
      `${nombre} usa getUser(), que va por internet y revienta si no llega`);
});

test("hay una manera de saber quién eres que no puede fallar", () => {
  assert.match(sesionjs, /export async function usuarioActual/);
  const f = sinComentarios(sesionjs)
    .match(/export async function usuarioActual[\s\S]*?\n\}/)[0];
  assert.match(f, /catch/, "si esto revienta, revienta la aplicación entera");
  assert.doesNotMatch(f, /getUser/, "getUser va por internet: es justo lo que falla");
});

test("leer la sesión tampoco puede tumbar el arranque", () => {
  /* O recoge ella el error, o se apoya en quien lo recoge. Lo
     que no puede es reventar: es lo primero que hace el
     arranque, y si revienta no se pinta nada. */
  const f = sinComentarios(sesionjs)
    .match(/export async function sesionActual[\s\S]*?\n\}/)[0];
  assert.match(f, /catch|usuarioActual\(\)/);
});

test("si no se puede traer la ficha, la aplicación abre igual", () => {
  /* La ficha da el nombre y si eres administración. Que no llegue
     es una molestia; que tumbe la aplicación, no es aceptable. */
  const f = sinComentarios(app);
  assert.match(f, /catch[\s\S]{0,120}ficha = null|ficha = await miFicha\(\)[\s\S]{0,200}catch/,
    "miFicha() tiene que poder fallar sin llevarse el arranque por delante");
});

test("cuando algo falla, la pantalla dice QUÉ falla", () => {
  /* «No hemos podido abrir» a secas deja igual de ciego que
     «Cargando…». Con el mensaje de verdad delante se arregla en
     un rato; sin él, a adivinar. */
  const f = sinComentarios(app);
  assert.match(f, /fallo\?\.message|fallo\.message|String\(fallo/,
    "hay que enseñar el mensaje del error, no sólo que hubo uno");
});

test("no confundir «no tiene ficha» con «no he podido preguntarlo»", () => {
  /* EL FALLO. `miFicha()` pedía la ficha tirando el error:

       let { data } = await supabase.from("cliente").select(...)
       if (!data) { ...crearla... }

     Si la consulta falla —un segundo de mala cobertura—, `data`
     viene vacío y el código concluye «es la primera vez que
     entra». Intenta CREAR una ficha que ya existe, eso falla, y
     ahí sí revienta: se lleva por delante el arranque entero.

     Le pasaba a Santiago y no a un visitante sin entrar, porque
     un visitante no llega nunca hasta aquí. Dos días de «no
     carga, no abre».

     Una consulta que falla y una consulta que no encuentra nada
     NO son lo mismo, y confundirlas escribe en la base de
     datos. */
  const f = sinComentarios(datos).match(/export async function miFicha[\s\S]*?\n\}/)[0];

  assert.match(f, /error/,
    "la consulta de la ficha tiene que mirar si falló");
  assert.doesNotMatch(f, /let \{ data \} = await/,
    "así se tira el error y se confunde «falló» con «no hay»");

  /* Y el orden importa: primero se descarta que la consulta
     fallara, y SÓLO DESPUÉS se decide crear nada. */
  const crea = f.search(/\.insert\(/);
  const antesDeCrear = f.slice(0, crea);
  assert.match(antesDeCrear, /select\([\s\S]*?error/,
    "la consulta tiene que devolver también su error");
  assert.match(antesDeCrear, /throw/,
    "hay que cortar por lo sano ANTES de decidir crear nada");
});

/* ---------- Los permisos, que fueron LA causa ---------- */
test("los permisos de las tablas se dan los ÚLTIMOS", () => {
  /* `push.sql` y `avisos.sql` añaden columnas a `cliente`. Una
     columna creada DESPUÉS de darse los permisos se queda sin
     ninguno, y basta una para que Postgres rechace `select *`
     entero. Dos días, el 13/09/2026. */
  const orden = leer("db/orden.txt").trim().split("\n").map(l => l.trim());
  assert.equal(orden.at(-1), "permisos.sql",
    "permisos.sql tiene que aplicarse el último");
});

test("ningún fichero da permisos de columnas antes de tiempo", () => {
  const orden = leer("db/orden.txt").trim().split("\n").map(l => l.trim());
  for (const f of orden.filter(f => f !== "permisos.sql"))
    assert.doesNotMatch(leer("db/" + f), /grant select\s*\(/,
      `${f} da permisos columna a columna: eso va en permisos.sql, el último`);
});

test("los permisos se le preguntan a la tabla, no a una lista a mano", () => {
  /* Una lista de columnas escrita a mano sobre una tabla que
     crece es una trampa con fecha: aguanta hasta que alguien
     añade una columna. */
  const sql = leer("db/permisos.sql");
  assert.match(sql, /information_schema\.columns/,
    "hay que preguntarle a la tabla qué columnas tiene");
  assert.doesNotMatch(sql, /grant select \(id, nombre/,
    "eso es una lista a mano, que es justo lo que falló");
});

test("y hay una prueba dentro del SQL que lo caza sola", () => {
  /* Aplicar el fichero ES ejecutarla: el día que alguien añada
     una columna y no llegue el permiso, la instalación aborta en
     vez de dejar la aplicación muerta y callada. */
  const sql = leer("db/permisos.sql");
  assert.match(sql, /assert/);
  assert.match(sql, /column_privileges/);
});

test("el navegador aguanta aunque la base esté a medias", () => {
  /* EL NAVEGADOR SE DESPLIEGA ANTES QUE LA BASE. SIEMPRE. */
  const f = sinComentarios(datos).match(/export async function miFicha[\s\S]*?\n\}/)[0];
  assert.match(f, /42501/,
    "si falta un permiso hay que reintentar, no morirse");
});
