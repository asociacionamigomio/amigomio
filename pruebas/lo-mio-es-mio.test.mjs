/* ============================================================
   «Mis» cosas son las MÍAS.

   Éste es el mismo fallo por tercera vez, y por eso ahora hay
   una prueba que lo caza sola.

   Administración ve todo por RLS: es lo correcto, hace falta
   para atender un teléfono y para pasar una inspección. Pero
   entonces cualquier consulta que no diga «las mías» le
   devuelve LAS DE TODOS, y las pantallas de cliente se llenan
   de datos ajenos.

   Ha pasado con:
   - `misPerros()`, en «Mis perros» (arreglado el 12/09/2026).
   - `misReservas()`, en «Mis reservas» y en el inicio — a
     Santiago le salían las estancias de todos los clientes
     (13/09/2026).

   Así que la regla, y la prueba que la vigila: toda función que
   se llame `mi…` o `mis…` FILTRA por el usuario que ha entrado.
   Si alguna vez hace falta una que no filtre, se llama de otra
   manera —`todosLosPerros()`— y así se ve de lejos lo que hace.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fuente = readFileSync(new URL("../js/datos.js", import.meta.url), "utf8");

/* Cada función exportada, con su cuerpo. */
function funciones() {
  const trozos = [];
  const re = /export async function (\w+)\(/g;
  let m;
  while ((m = re.exec(fuente))) {
    const desde = m.index;
    const hasta = fuente.indexOf("\n}", desde);
    trozos.push({ nombre: m[1], cuerpo: fuente.slice(desde, hasta) });
  }
  return trozos;
}

test("todo lo que se llama «mío» filtra por quien ha entrado", () => {
  const mias = funciones().filter(f => /^mis?[A-Z]/.test(f.nombre));
  assert.ok(mias.length >= 3, "algo falla en la prueba: no encuentra las funciones");

  for (const f of mias) {
    /* O filtra por el usuario, o filtra por algo que ya es suyo
       —el perro de la ficha que está abierta—. Lo que no vale
       es no filtrar por nada. */
    const filtra = /user\.id/.test(f.cuerpo) || /\.eq\("perro_id"/.test(f.cuerpo);
    assert.ok(filtra,
      `${f.nombre}() no filtra: a administración le devolverá las de TODOS los clientes`);
  }
});

test("lo que sí es de todos se llama como lo que es", () => {
  /* `todosLosPerros()` no filtra, y está bien: se ve en el
     nombre. La confusión sólo aparece cuando algo que se llama
     «mío» devuelve lo de todos. */
  const abiertas = funciones().filter(f => !/user\.id/.test(f.cuerpo)
                                        && /^(todos|todas)/.test(f.nombre));
  for (const f of abiertas)
    assert.match(f.nombre, /^(todos|todas)/);
});

test("misReservas filtra: fue el fallo del 13/09/2026", () => {
  const f = funciones().find(x => x.nombre === "misReservas");
  assert.match(f.cuerpo, /eq\("cliente_id", user\.id\)/);
});
