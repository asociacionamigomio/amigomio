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
const fn = lee("supabase/functions/zapatilla/index.ts");

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
  assert.match(fn, /NUNCA crees una reserva sin haberle enseñado antes el desglose/);
  assert.match(fn, /Un "vale" a otra cosa no cuenta/);
});

test("repite los rechazos tal cual, sin adornarlos", () => {
  /* Los mensajes de la base de datos están escritos para el
     cliente. Si Zapatilla los suaviza, el cliente no entiende
     qué tiene que arreglar. */
  assert.match(fn, /repite su motivo tal cual/);
  assert.match(fn, /No lo suavices/);
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
  assert.match(fn, /labrador chocolate/);
  assert.match(fn, /perro de\s+asistencia y terapia/i);
  assert.match(fn, /Ni vendedor ni gracioso forzado/);
  assert.match(fn, /673 229 399/, "y sabe dar el teléfono cuando no llega");
});

test("el sistema va cacheado: es el texto que se repite en cada vuelta", () => {
  assert.match(fn, /cache_control: \{ type: "ephemeral" \}/,
    "sin caché, cada vuelta del bucle paga el prompt entero otra vez");
});
