/* ============================================================
   Zapatilla es un asistente de IA con permiso para crear
   reservas. Eso significa que puede equivocarse en voz alta y
   comprometer a AmigoMío.

   La protección NO es lo que le pidamos en el texto: un modelo
   puede ignorar cualquier instrucción. La protección es que
   habla con la base de datos usando la sesión del cliente, así
   que no puede hacer nada que ese cliente no pudiera hacer solo.

   Estas pruebas vigilan justo eso.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lee = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");

/* El texto de Zapatilla va envuelto a 76 columnas, así que casi
   cualquier frase que se busque cruza un salto de línea. Esto
   aplasta los espacios para que buscar una frase funcione sin
   tener que adivinar dónde cae el corte: es la trampa que más
   veces ha hecho fallar una prueba buena hoy. */
const aplanar = t => t.replace(/\s+/g, " ");
const fn = aplanar(lee("supabase/functions/zapatilla/index.ts"));

test("Zapatilla usa la sesión del cliente, NO la llave maestra", () => {
  /* Con service_role se saltaría RLS y podría ver y tocar los
     datos de cualquiera. Es el fallo que convierte un asistente
     en una fuga de datos. */
  assert.doesNotMatch(fn, /SERVICE_ROLE|service_role/,
    "jamás la clave de servicio en Zapatilla");
  assert.match(fn, /SUPABASE_ANON_KEY/);
  assert.match(fn, /Authorization:\s*jwt/,
    "tiene que pasar la sesión del cliente a la base de datos");
});

test("sin sesión no habla", () => {
  assert.match(fn, /if \(!jwt\)/);
  assert.match(fn, /Hay que entrar con tu cuenta/);
  assert.match(fn, /if \(!user\)/, "y hay que comprobar que la sesión es de verdad");
});

test("la clave de Claude sale del entorno, nunca del código", () => {
  assert.match(fn, /Deno\.env\.get\("ANTHROPIC_API_KEY"\)/);
  assert.doesNotMatch(fn, /sk-ant-/, "ninguna clave escrita a mano");
});

test("usa el modelo que se decidió", () => {
  assert.match(fn, /const MODELO = "claude-opus-5"/);
});

test("no calcula precios: los pregunta", () => {
  /* Si Zapatilla sumara por su cuenta, se inventaría importes y
     comprometería a AmigoMío con tarifas que no existen. */
  assert.match(fn, /rpc\("presupuesto"/);
  assert.match(fn, /rpc\("hay_sitio"/);
  assert.match(fn, /rpc\("crear_reserva"/);
  assert.match(fn, /No calcules tú/);
});

test("las reservas que crea quedan marcadas como suyas", () => {
  /* Si mañana hay una discusión, hay que saber de dónde salió. */
  assert.match(fn, /quien: "zapatilla"/);
});

test("tiene prohibido reservar sin enseñar el desglose y sin un sí", () => {
  assert.match(fn, /NUNCA reserves sin haber enseñado antes el desglose/);
  assert.match(fn, /Un "vale" a otra cosa no cuenta/);
});

test("repite los rechazos tal cual, sin adornarlos", () => {
  /* Los mensajes de la base de datos están escritos para el
     cliente. Si Zapatilla los suaviza, el cliente no entiende
     qué tiene que arreglar. */
  assert.match(fn, /repites su motivo tal cual/);
  assert.match(fn, /no lo suavices/i);
});

test("el bucle de herramientas tiene tope", () => {
  /* Sin tope, una conversación atascada da vueltas hasta agotar
     la paciencia del cliente y el saldo de la cuenta. */
  assert.match(fn, /vuelta < \d+/);
  assert.match(fn, /me he liado/, "y al llegar al tope lo dice y ofrece el teléfono");
});

test("los errores no se le enseñan crudos al cliente", () => {
  assert.match(fn, /console\.error\("\[Zapatilla\]"/);
  assert.match(fn, /Se nos ha atragantado algo/);
});

test("habla como Zapatilla, no como un robot", () => {
  assert.match(fn, /labradora chocolate/);
  assert.match(fn, /perra de terapia/i);
  assert.match(fn, /673 229 399/, "y sabe dar el teléfono cuando no llega");
});

test("no suelta coletillas de sistema", () => {
  /* "Como asistente", "estoy aquí para ayudarte" y "no dudes en
     consultarme" rompen el personaje en la primera frase. */
  assert.match(fn, /No dices "como asistente"/);
  assert.match(fn, /no dudes en consultarme/);
});

test("si le preguntan qué es, no lo niega", () => {
  /* La línea que no se cruza. Está comprometiendo dinero de la
     gente: un cliente engañado ahí es un problema de AmigoMío, y
     en la UE hay obligación de decirlo si preguntan.

     Pero tampoco va avisando sin venir a cuento: eso rompería el
     personaje sin que nadie lo haya pedido. */
  assert.match(fn, /no lo niegas/i);
  assert.match(fn, /Perra de verdad no soy/);
  assert.match(fn, /No lo sueltes si no te lo preguntan/);
});

test("el sistema va cacheado: es el texto que se repite en cada vuelta", () => {
  assert.match(fn, /cache_control: \{ type: "ephemeral" \}/,
    "sin caché, cada vuelta del bucle paga el prompt entero otra vez");
});

/* ---------- El botón flotante ---------- */
const widget = aplanar(lee("js/zapatilla.js"));
const app = aplanar(lee("js/app.js"));

test("está en todas las pantallas, no es una sección", () => {
  assert.match(app, /montarZapatilla\(\)/);
  assert.match(widget, /position: fixed|zapatilla-boton/);
  assert.doesNotMatch(app, /id: "zapatilla",\s*texto:/,
    "no puede ser una pestaña más del menú");
});

test("el botón no aparece si no has entrado", () => {
  /* Habla con la base de datos usando la sesión del cliente:
     sin sesión no tendría con qué. */
  const i = app.indexOf("montarZapatilla()");
  const antes = app.slice(0, i);
  assert.match(antes, /if \(!sesion\.usuario\)/,
    "se monta después de comprobar que hay sesión");
});

test("lo que escribe Zapatilla no se interpreta como HTML", () => {
  /* Viene de un modelo de IA, que a su vez ha leído datos que
     escriben los clientes. Si se pintara tal cual, un nombre de
     perro con etiquetas dentro se ejecutaría en la página. */
  assert.match(widget, /const esc = /);
  assert.match(widget, /esc\(t\)/, "se escapa antes de pintar");
  assert.match(widget, /no se interpreta HTML venga de donde venga/);
});

test("no hay reglas de negocio en el botón", () => {
  /* Todo lo que decide vive en la función y en la base de datos.
     Si aquí hubiera un precio, habría dos verdades. */
  assert.doesNotMatch(widget, /\b1[58]\b|\b25\b|\bprecio\s*=/,
    "aquí no se calcula ni se sabe nada de tarifas");
});

test("avisa si algo va mal, sin dejar al cliente colgado", () => {
  assert.match(widget, /673 229 399/);
  assert.match(widget, /esperando\.remove\(\)/, "y quita el 'está escribiendo'");
});

test("el panel arranca cerrado y se puede cerrar", () => {
  /* Fallo real: el CSS le daba `display: flex` al panel, y eso gana
     al `display: none` que el navegador aplica a [hidden]. Resultado:
     el panel salía siempre abierto y la × no hacía nada visible.

     Cualquier elemento que se oculte con `hidden` y tenga un display
     propio necesita esta regla. */
  const css = lee("css/estilo.css");
  assert.match(css, /\.zapatilla-panel\[hidden\]\s*\{\s*display:\s*none\s*!important/,
    "hace falta anular el display propio cuando está oculto");

  assert.match(widget, /panel\.hidden = true;/, "arranca cerrado");
  assert.match(widget, /\.cerrar"\)\.addEventListener\("click", cerrar\)/, "y la × lo cierra");
});

test("el «está escribiendo» no pasa por el escapado", () => {
  /* Fallo real: los tres puntitos se mandaban como texto a
     escribe(), que escapa TODO a propósito —lo que dice Zapatilla
     viene de un modelo que ha leído datos escritos por clientes—.
     Resultado: el cliente veía «<span></span><span></span>».

     Lo que pone la app va por su puerta; lo que viene de fuera,
     por la del escapado. */
  assert.match(widget, /function puntitos\(\)/);
  assert.match(widget, /createElement\("span"\)/,
    "los puntitos se crean como elementos, no como texto");
  assert.doesNotMatch(widget, /escribe\([^)]*<span>/,
    "nunca etiquetas como texto a escribe()");
});

test("sabe consultar el recargo por hora, no se excusa", () => {
  /* Preguntada por recoger a las 6 de la mañana contestó que no lo
     sabía. Hizo bien en no inventárselo, pero es que no tenía
     herramienta: el motor lo calcula. */
  assert.match(fn, /name: "recargo_por_hora"/);
  assert.match(fn, /rpc\("recargo_horario"/);
  assert.match(fn, /no lo digas de memoria ni contestes que no lo sabes/);
});

test("la conversación va con esfuerzo bajo", () => {
  /* Es una conversación de mostrador, no un problema difícil.
     Siete segundos esperando a que te digan un precio se hacen
     eternos, y además cuesta más. */
  assert.match(fn, /effort: "low"/);
});
