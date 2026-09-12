/* ============================================================
   Por qué la app no se podía instalar en el móvil.

   Chrome NO ofrece instalar una web cuyo service worker no
   intercepta peticiones, aunque tenga manifiesto e iconos
   perfectos. Y no avisa: el botón sencillamente no aparece y no
   hay forma de saber por qué.

   Y aunque cumpla, en móvil el navegador tampoco enseña nada por
   su cuenta: hay que guardar el aviso y ofrecerlo.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lee = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");

test("el service worker intercepta peticiones", () => {
  const sw = lee("sw.js");
  assert.match(sw, /addEventListener\("fetch"/,
    "sin esto, Chrome no ofrece instalar la app");
  assert.match(sw, /respondWith/);
});

test("lo que viene de Supabase no se guarda en caché", () => {
  /* Enseñar una disponibilidad de ayer como si fuera de hoy
     vende plazas que ya no existen. */
  const sw = lee("sw.js");
  assert.match(sw, /supabase\.co/);
  assert.match(sw, /vende plazas que no existen/);
});

test("se ofrece instalar, no se espera a que el navegador lo haga", () => {
  const app = lee("js/app.js");
  assert.match(app, /beforeinstallprompt/);
  assert.match(app, /e\.preventDefault\(\)/, "hay que quedarse el aviso");
  assert.match(app, /pedirInstalar\.prompt\(\)/);
});

test("el botón desaparece cuando ya está instalada", () => {
  const app = lee("js/app.js");
  assert.match(app, /appinstalled/);
});

test("el manifiesto tiene lo que exige el navegador", () => {
  const m = JSON.parse(lee("manifest.webmanifest"));
  assert.ok(m.name && m.short_name, "nombre y nombre corto");
  assert.equal(m.display, "standalone", "si no, se abre como una pestaña más");
  assert.ok(m.icons.some(i => i.sizes === "192x192"));
  assert.ok(m.icons.some(i => i.sizes === "512x512"));
  assert.ok(m.start_url, "hay que decirle por dónde abre");
});

/* ------------------------------------------------------------
   «Esta app está creada para una versión anterior de Android».

   Lo dice Android, no nosotros, y sale cuando lo que se instala
   NO es un WebAPK —el paquete que Google genera para cada web
   instalable— sino el acceso directo de repuesto que Chrome
   monta él mismo, que va firmado contra un Android viejo.

   Chrome cae a ese repuesto cuando el manifiesto no le llega
   para pedir el WebAPK. Lo que le faltaba: un `id` estable, un
   `scope` y un icono `maskable`. Con eso pide el WebAPK y el
   aviso desaparece.
   ------------------------------------------------------------ */
test("el manifiesto pide un WebAPK de verdad, no un acceso directo", () => {
  const m = JSON.parse(lee("manifest.webmanifest"));

  assert.ok(m.id, "sin `id` estable, Android la trata como otra app cada vez");
  assert.ok(m.scope, "sin `scope`, Chrome no sabe qué es la app y qué es fuera");

  const maskable = m.icons.filter(i => (i.purpose || "").split(/\s+/).includes("maskable"));
  assert.ok(maskable.length, "sin icono `maskable` no hay WebAPK");
  assert.ok(maskable.some(i => i.sizes === "512x512"),
    "el maskable tiene que ser el grande");

  /* Y que siga habiendo uno `any`: el maskable lleva margen y
     recortado fuera de Android se ve pequeño. */
  assert.ok(m.icons.some(i => (i.purpose || "any").split(/\s+/).includes("any")));
});

test("el icono maskable existe y deja margen para el recorte", () => {
  const m = JSON.parse(lee("manifest.webmanifest"));
  const icono = m.icons.find(i => (i.purpose || "").includes("maskable"));
  const bytes = readFileSync(new URL("../" + icono.src, import.meta.url));
  assert.ok(bytes.length > 1000, "el fichero tiene que estar ahí de verdad");
  assert.match(icono.src, /maskable/, "que se sepa cuál es sin abrirlo");
});
