/* ============================================================
   Español e inglés.

   DECISIÓN, y conviene que esté escrita aquí: se traduce LO QUE
   VE EL CLIENTE. El panel de administración se queda en
   español.

   No es pereza. El panel lo usan Santiago y Elena, que son de
   Puerto Real. Traducir el cuadrante, la hoja del día y el
   libro de registro sería mantener el doble de texto para que
   no lo lea nadie, y un texto que nadie lee es un texto que
   nadie corrige: al año diría una cosa distinta de la otra
   versión.

   CÓMO SE USA. No hay claves: la clave ES la frase en español.

       t("Reservar")                     -> "Book a stay"
       t("Quedan {dias} días", {dias: 3}) -> "3 days left"

   Así, el código se sigue leyendo en castellano, y si una frase
   no está traducida sale en español en vez de un «inicio.saludo»
   en mitad de la pantalla, que es peor que no traducir.
   ============================================================ */

export const IDIOMAS = [
  { id: "es", nombre: "Español",  bandera: "ES" },
  { id: "en", nombre: "English",  bandera: "EN" },
];

/* El tono en inglés es el mismo que en español: cercano, de tú,
   sin jerga. «We'll remind you», nunca «The user will be
   notified». */
export const DICCIONARIO = {
  en: {
    /* ---------- El menú ---------- */
    "Inicio": "Home",
    "Reservar": "Book a stay",
    "Mis reservas": "My bookings",
    "Mis perros": "My dogs",
    "Mi ficha": "My details",
    "Salir": "Sign out",

    /* ---------- La puerta ---------- */
    "Entrar": "Sign in",
    "Crear una cuenta": "Create an account",
    "Correo electrónico": "Email",
    "Contraseña": "Password",
    "¿Ya tienes cuenta?": "Already have an account?",
    "¿Todavía no tienes cuenta?": "Don't have an account yet?",
    "Te hemos mandado un correo para confirmar que eres tú.":
      "We've sent you an email to confirm it's you.",
    "Ese correo o esa contraseña no nos cuadran.":
      "That email or password doesn't look right.",

    /* ---------- Inicio ---------- */
    "Hola": "Hello",
    "Un momento…": "One moment…",
    "Todo al día. No le caduca nada por ahora.":
      "All up to date. Nothing expiring for now.",
    "Una cosa que caduca": "One thing expiring",
    "Cosas que caducan": "Things expiring",
    "ya venció": "already expired",
    "vence hoy": "expires today",
    "vence mañana": "expires tomorrow",
    "Quedan {dias} días": "{dias} days left",
    "Instalar la aplicación": "Install the app",

    /* ---------- Reservar ---------- */
    "¿Quién viene?": "Who's coming?",
    "¿Qué días?": "Which days?",
    "Lo dejas el": "Drop-off",
    "Lo recoges el": "Pick-up",
    "Mínimo dos noches.": "Two nights minimum.",
    "¿Y si no puedo a esas horas?": "What if I can't make those times?",
    "Háblanos por WhatsApp": "Message us on WhatsApp",
    "Esto es lo que costaría": "Here's what it would cost",
    "Mirando si hay sitio…": "Checking availability…",
    "Reservar estas fechas": "Book these dates",
    "Antes de reservar tenemos que conocer a tu perro.":
      "Before booking, we need to meet your dog.",
    "noche": "night",
    "noches": "nights",
    "Se puede, avisando antes. Se cobra por cada movimiento: si lo dejas y lo recoges fuera de hora, son dos recargos.":
      "It's possible, just tell us beforehand. It's charged per movement: dropping off and picking up outside hours means two surcharges.",

    /* ---------- Mis reservas ---------- */
    "Falta el justificante": "Payment receipt missing",
    "Estamos mirándolo": "We're checking it",
    "Confirmada": "Confirmed",
    "Está dentro": "Staying with us",
    "Está aquí ahora": "Here right now",
    "Terminada": "Finished",
    "Cancelada": "Cancelled",
    "Caducó sin pagar": "Expired unpaid",
    "Nos falta el justificante de la transferencia.":
      "We're still missing your bank transfer receipt.",
    "Subir el justificante": "Upload the receipt",
    "Lo hemos recibido.": "We've got it.",
    "Todavía no tienes ninguna reserva.": "You don't have any bookings yet.",

    /* ---------- Los perros ---------- */
    "Un perro nuevo": "A new dog",
    "Editar": "Edit",
    "Volver": "Back",
    "Guardar": "Save",
    "Siguiente": "Next",
    "Atrás": "Back",
    "Guardar y seguir luego": "Save and finish later",
    "Vacunas y desparasitaciones": "Vaccinations and worming",
    "Antiparasitario externo": "External parasite treatment",
    "Puede llevar varios a la vez. Te avisamos cuando se le acabe el último que le quede.":
      "They can wear several at once. We'll remind you when the last one runs out.",
    "Añadir otro antiparasitario": "Add another treatment",
    "Se lo puse el": "Applied on",
    "y dura": "and lasts",
    "meses": "months",
    "o caduca el": "or expires on",
    "Quitar": "Remove",
    "Avísame": "Remind me",
    "días antes": "days before",
    "Es la primera vez": "First time",
    "Cómo come": "How they eat",
    "Cuidados": "Special care",
    "La cartilla y los papeles": "Vaccination card and paperwork",
    "Subir foto": "Upload a photo",
    "Añadir otra": "Add another",
    "Ver": "View",
    "sin raza anotada": "breed not recorded",
    "Chip": "Microchip",

    /* ---------- Mi ficha ---------- */
    "Tus datos": "Your details",
    "Nombre": "First name",
    "Apellidos": "Surname",
    "Teléfono": "Phone",
    "Domicilio": "Address",
    "Guardado.": "Saved.",

    /* ---------- Zapatilla ---------- */
    "Escríbeme…": "Write to me…",
    "por aquí ando": "I'm around",
    "Cerrar": "Close",
  },
};

/* El idioma vivo. Se guarda en el navegador: cada uno en el
   suyo, sin tocar nada del servidor. */
let actual = "es";

const HUECO = "amigomio-idioma";

function guardado() {
  try { return localStorage.getItem(HUECO); } catch { return null; }
}

/* Si nunca ha elegido, se mira el idioma del teléfono. A quien
   tiene el móvil en inglés se le enseña en inglés sin que tenga
   que buscar dónde se cambia. */
function delTelefono() {
  const suyo = globalThis.navigator?.language || "";
  return suyo.toLowerCase().startsWith("en") ? "en" : "es";
}

export function arrancarIdioma() {
  actual = guardado() || delTelefono();
  if (!IDIOMAS.some(i => i.id === actual)) actual = "es";
  marcarEnLaPagina();
  return actual;
}

export const idiomaActual = () => actual;

export function ponerIdioma(id) {
  if (!IDIOMAS.some(i => i.id === id)) return;
  actual = id;
  try { localStorage.setItem(HUECO, id); } catch { /* modo privado */ }
  marcarEnLaPagina();
}

/* El `lang` del documento importa más de lo que parece: de él
   dependen el corrector del teclado, cómo lee un lector de
   pantalla y dónde parte las palabras el navegador. */
function marcarEnLaPagina() {
  if (globalThis.document) document.documentElement.lang = actual;
}

/**
 * Traduce. La clave es la frase en español.
 *
 * Si no hay traducción devuelve el español: ver la frase en
 * castellano es infinitamente mejor que ver una clave suelta.
 */
export function t(frase, piezas) {
  const tabla = DICCIONARIO[actual];
  let salida = (tabla && tabla[frase]) || frase;

  if (piezas) {
    for (const [nombre, valor] of Object.entries(piezas))
      salida = salida.replaceAll(`{${nombre}}`, valor);
  }
  return salida;
}
