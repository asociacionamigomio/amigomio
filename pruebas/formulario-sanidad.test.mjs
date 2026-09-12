/* ============================================================
   Por qué el formulario de vacunas se salía de la caja.

   Santiago, 12/09/2026: «cuando relleno datos de perro por
   ejemplo las vacunas y desparasitarios el texto se sale de las
   tablas». Mirado en el navegador, eran tres cosas distintas:

   1. El campito de «Avísame ___ días antes» ocupaba el ANCHO
      ENTERO. La regla de CSS que lo estrecha,
      `.requisito .dias`, es MENOS específica que la general
      `input:not([type=checkbox]):not([type=radio]):not([type=file])`
      —tres `:not` con selector de atributo dentro pesan más que
      dos clases—, así que perdía y nadie lo notaba mirando el
      fichero. Resultado: «Avísame», una caja enorme y «días
      antes», en tres renglones.

   2. Ese campo salía SIEMPRE VACÍO en todo lo que no fuera el
      antiparasitario. Un `&&` en medio de dos `??`:
      `extra.avisoDias ?? (esExterno && …) ?? AVISO_POR_DEFECTO`
      devuelve `false` cuando no es externo, y `false` no es
      nulo, así que el `?? 7` no llegaba a entrar nunca.

   3. «Polivalente (moquillo, parvovirosis, hepatitis y
      parainfluenza)» no cabe en una línea de móvil.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { diasDeAvisoDe, AVISO_POR_DEFECTO, PRODUCTOS_EXTERNOS } from "../js/sanidad.js";

const leer = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const aplanar = t => t.replace(/\s+/g, " ");

test("una vacuna cualquiera avisa con una semana", () => {
  assert.equal(diasDeAvisoDe("rabia", {}), AVISO_POR_DEFECTO);
  assert.equal(diasDeAvisoDe("rabia", undefined), AVISO_POR_DEFECTO);
  assert.equal(diasDeAvisoDe("leishmaniosis", { fecha: "2026-01-01" }), AVISO_POR_DEFECTO);
});

test("nunca devuelve algo que no sea un número", () => {
  /* Éste es el fallo de verdad: devolvía `false`, y un
     value="false" en un <input type=number> deja el campo en
     blanco sin decir nada. */
  for (const id of ["rabia", "polivalente", "antiparasitario_externo", "inventado"])
    assert.equal(typeof diasDeAvisoDe(id, {}), "number", `${id} devuelve algo raro`);
});

test("el collar avisa con más tiempo que la pipeta", () => {
  assert.equal(diasDeAvisoDe("antiparasitario_externo",
    { puestos: [{ producto: "collar", fecha: "2026-02-01" }] }), PRODUCTOS_EXTERNOS.collar.aviso);
  assert.equal(diasDeAvisoDe("antiparasitario_externo",
    { puestos: [{ producto: "pipeta", fecha: "2026-08-01" }] }), PRODUCTOS_EXTERNOS.pipeta.aviso);
});

test("si el dueño pone su propio plazo, manda el suyo", () => {
  assert.equal(diasDeAvisoDe("rabia", { avisoDias: 45 }), 45);
});

test("el formulario ya no hace la cuenta a mano", () => {
  /* Mientras la pantalla calculara esto por su cuenta, el fallo
     podía volver sin que ninguna prueba se enterara. */
  const vista = aplanar(leer("js/vistas/perros.js"));
  assert.match(vista, /diasDeAvisoDe/);
  assert.doesNotMatch(vista, /esExterno && PRODUCTOS_EXTERNOS/,
    "ese `&&` entre dos `??` es justo lo que dejaba el campo vacío");
});

/* ---------- Que quepa en un móvil ---------- */
const css = leer("css/estilo.css");

test("el campito de los días gana a la regla general de los inputs", () => {
  /* La general lleva tres `:not(...)`, y cada uno pesa como un
     selector de atributo. Con `.requisito .dias` (dos clases) no
     basta: hace falta nombrar también la etiqueta. */
  assert.match(css, /input\.dias/,
    "sin el `input` delante, la regla pierde y el campo ocupa toda la línea");
});

test("los nombres largos se parten en vez de salirse", () => {
  /* «Polivalente (moquillo, parvovirosis, hepatitis y
     parainfluenza)» no cabe en 390 px de ancho. */
  assert.match(css, /\.nombre-req[^}]*overflow-wrap/s);
  assert.match(css, /\.fila-sanidad[^}]*min-width: *0/s,
    "un hijo de flex sin min-width:0 no encoge y desborda");
});

test("en pantalla estrecha la ficha apila nombre y fecha", () => {
  /* «Polivalente (…)» y «hasta el 1 de septiembre de 2026» en la
     misma línea no caben en ningún móvil. */
  assert.match(aplanar(css), /@media \(max-width: *4\d\dpx\)[^}]*\.fila-sanidad/,
    "falta apilarlas cuando no hay sitio");
});

/* ---------- Una cosa o la otra, no las dos ---------- */
test("de cada antiparasitario se elige CÓMO se sabe cuándo caduca", () => {
  /* Fallo de diseño mío, visto en los datos reales de Santiago:
     el formulario ofrecía «y dura ___ meses» Y «o caduca el
     ___», los dos rellenables a la vez y sin decir cuál manda.
     Resultado, en su propia ficha:

       Tara: collar puesto el 13/09, «dura 2 meses» Y «caduca el
             20/09». Son dos respuestas distintas —13 de
             noviembre o 20 de septiembre— y sólo vale una.

     Preguntar dos cosas para quedarse con una es una trampa. Se
     elige primero cómo se sabe, y se pregunta SÓLO eso. */
  const vista = aplanar(leer("js/vistas/perros.js"));
  assert.match(vista, /como-caduca|comoCaduca/,
    "hace falta elegir entre duración y fecha");
});

test("y se le enseña la fecha que sale de lo que ha puesto", () => {
  /* Si no ve el resultado, no sabe que se ha equivocado hasta
     que le llega un aviso raro. */
  const vista = aplanar(leer("js/vistas/perros.js"));
  assert.match(vista, /caducidadDe|Caduca el/,
    "hay que enseñar la fecha calculada debajo");
});

test("no se cuela un año de cinco cifras", () => {
  /* «20206-12-01» está en la base, en la ficha de un perro real.
     Un <input type=date> lo acepta tan tranquilo si no se le
     pone tope. */
  /* Sin los comentarios: uno de ellos cita el fallo. */
  const vista = leer("js/vistas/perros.js")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const fechas = vista.match(/<input type="date"[^>]*>/g) || [];
  assert.ok(fechas.length, "debería haber campos de fecha");
  for (const f of fechas)
    assert.match(f, /max=/, `este campo de fecha no tiene tope: ${f.slice(0, 70)}`);
});
