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
