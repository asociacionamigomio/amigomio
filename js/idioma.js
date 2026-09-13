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
    /* ---------- Cómo llegar ---------- */
    "Cómo llegar": "Getting here",
    "Estamos en El Marquesado, Puerto Real (Cádiz).":
      "We're in El Marquesado, Puerto Real (Cádiz).",
    "Llévame hasta allí": "Take me there",
    "Se abre el mapa del móvil con la ruta desde donde estés.":
      "Your phone's map app opens with directions from wherever you are.",
    "Sólo ver dónde está": "Just show me where it is",
    "Un par de cosas del camino": "A couple of things about the drive",
    "El último tramo es un carril de tierra. Se pasa bien con cualquier coche, pero no corras.":
      "The last stretch is a dirt track. Any car gets through fine — just don't speed.",
    "En el aparcamiento hay sitio de sobra. Intenta no pegarte a otros coches: así todos podemos abrir las puertas y sacar al perro con calma.":
      "There's plenty of room to park. Try not to pull up tight against other cars, so everyone can open their doors and get their dog out calmly.",
    "La puerta está cerrada, pero no tiene candado.":
      "The gate is shut, but it isn't padlocked.",
    "Ábrela, pasa y ciérrala detrás de ti.":
      "Open it, drive in, and close it behind you.",
    "No es desconfianza: es la barrera que hay entre un perro que se suelta y la carretera. Por eso, hasta que la puerta no esté cerrada, no bajes al tuyo del coche.":
      "It's not that we don't trust you: that gate is what stands between a loose dog and the road. So don't let yours out of the car until it's shut.",
    "¿Te has liado?": "Lost?",
    "Pasa, y no es culpa tuya: por aquí los mapas se hacen un lío con los caminos. Háblanos y te vamos guiando.":
      "It happens, and it's not your fault: maps get confused by the tracks around here. Message us and we'll talk you in.",

    /* ---------- Clicker y el móvil ---------- */
    "Toca para empezar": "Tap to start",
    "1 clic": "1 click",
    "{n} clics": "{n} clicks",
    "El sonido": "The sound",
    "Tócalos para oírlos. Se queda el que elijas.":
      "Tap them to hear them. The one you pick stays.",
    "Toca el botón de Compartir y luego «Añadir a pantalla de inicio». Ábrela desde ahí y aquí te saldrá el botón.":
      "Tap Share and then \u00abAdd to Home Screen\u00bb. Open it from there and the button will show up here.",

    /* ---------- Mis reservas ---------- */
    "Buscando tus reservas…": "Looking for your bookings…",
    "No hemos podido cargarlas.": "We couldn't load them.",
    "Todavía no has reservado nada.": "You haven't booked anything yet.",
    "Reservar unos días": "Book a few days",
    "Estancias anteriores": "Past stays",
    "Tu reserva": "Your booking",
    " y ": " and ",
    "Del": "From",
    "al": "to",
    "Tienes hasta el": "You have until",
    "a las": "at",
    "El anterior no nos valía:": "The last one didn't work for us:",
    "¿No tienes el número de cuenta?": "Don't have the account number?",
    "Pídenoslo por WhatsApp": "Ask us on WhatsApp",
    "Lo miramos y te confirmamos. No tienes que hacer nada más.":
      "We'll check it and confirm. Nothing else for you to do.",
    "Cancelar (te devolvemos todo)": "Cancel (full refund)",
    "Quedan menos de 7 días: ya no se puede cancelar por aquí. Si ha pasado algo, háblanos y lo vemos.":
      "Less than 7 days to go: it can't be cancelled here any more. If something's come up, talk to us and we'll sort it.",

    /* ---------- La puerta (js/vistas/entrada.js) ---------- */
    "Tu mejor amig@ también se va de vacaciones":
      "Your best friend deserves a holiday too",
    "Tu correo": "Your email",
    "Tu contraseña": "Your password",
    "Al menos 8 caracteres": "At least 8 characters",
    "Crear cuenta": "Create account",
    "¿Primera vez por aquí?": "First time here?",
    "He olvidado la contraseña": "I've forgotten my password",
    "Dinos tu correo y te mandamos un enlace para poner una nueva.":
      "Tell us your email and we'll send you a link to set a new one.",
    "Mándame el enlace": "Send me the link",
    "Volver a entrar": "Back to sign in",

    /* ---------- Mi ficha ---------- */
    "No hemos podido cargar tus datos.": "We couldn't load your details.",
    "Tu foto": "Your photo",
    "Cambiar la foto": "Change photo",
    "Poner una foto": "Add a photo",
    "No hace falta, pero ayuda a que os reconozcáis.":
      "Not required, but it helps us recognise each other.",
    "Estos datos no son curiosidad nuestra: la ley nos obliga a anotarlos en el libro de registro de la residencia.":
      "We're not being nosy: the law requires us to record these in the kennel's register.",
    "Nombre": "First name",
    "Apellidos": "Surname",
    "DNI o NIE": "ID or passport number",
    "Dirección": "Address",
    "Calle, número, población": "Street, number, town",
    "Teléfono": "Phone",
    "¿Puede recogerlo alguien más?": "Can anyone else pick them up?",
    "Opcional. Si lo rellenas, a esa persona se le pide el DNI al entregarle el perro. Si no, solo te lo entregamos a ti.":
      "Optional. If you fill this in, we'll ask that person for ID when we hand your dog over. If not, we'll only hand them to you.",
    "Su nombre y apellidos": "Their full name",
    "Su DNI": "Their ID number",
    "Acepto que AmigoMío guarde estos datos y los de mis perros para gestionar las estancias y llevar el libro de registro que exige la normativa.":
      "I agree to AmigoMío keeping these details, and my dogs', to manage stays and to keep the register the law requires.",
    "Puedes pedirnos que los borremos cuando quieras.":
      "You can ask us to delete them whenever you like.",
    "Avisadme por correo de lo importante: si a mi perro le caduca algo de la cartilla, si falta el justificante de una reserva, o el recordatorio de la víspera.":
      "Email me about what matters: if something in my dog's health record is running out, if a booking is missing its payment slip, or the reminder the day before.",
    "Si lo quitas dejamos de escribirte. Nada más: las reservas siguen igual.":
      "Turn it off and we'll stop writing. Nothing else changes: your bookings work just the same.",
    "Que los demás clientes de AmigoMío puedan ver mi perfil.":
      "Let other AmigoMío clients see my profile.",
    "Verían tu nombre de pila, tu foto y tus perros (nombre, raza y foto). No verían tus apellidos, ni tu DNI, ni tu dirección, ni tu teléfono, ni el chip de tus perros, ni sus datos de salud. Puedes quitarlo cuando quieras.":
      "They'd see your first name, your photo and your dogs (name, breed and photo). They would not see your surname, ID, address or phone, nor your dogs' microchip or health details. You can turn it off whenever you like.",
    "Avisarme en el móvil": "Notify me on my phone",
    "Lo mismo que te contamos por correo, pero en el momento: si a tu perro le caduca algo, si falta el justificante de una reserva o la víspera de la entrada.":
      "The same things we email you about, but straight away: something running out, a booking missing its payment slip, or the day before drop-off.",
    "Guardar": "Save",
    "Este navegador no sabe mandar avisos al móvil. Seguirás recibiendo los correos.":
      "This browser can't send phone notifications. You'll still get the emails.",
    "En iPhone hay que instalar la aplicación primero.":
      "On iPhone you have to install the app first.",
    "Es cosa de Apple, no nuestra: en Safari normal no deja.":
      "That's Apple's rule, not ours: plain Safari won't allow it.",
    "Encendidos en este móvil. ✓": "On for this phone. ✓",
    "Quitar los avisos": "Turn notifications off",
    "Avisarme en este móvil": "Notify me on this phone",
    "Se enciende en cada móvil por separado.": "You turn it on separately on each phone.",

    /* ---------- Los vecinos ---------- */
    "Los vecinos": "The neighbours",
    "Quienes pasan por AmigoMío y han querido presentarse.":
      "People who come to AmigoMío and wanted to say hello.",
    "Tú también sales, porque lo activaste en tu ficha.":
      "You're in here too, because you turned it on in your details.",
    "Si quieres salir tú, enciéndelo en «Mi ficha».":
      "If you'd like to appear too, turn it on in \u00abMy details\u00bb.",
    "Todavía no se ha presentado nadie.": "Nobody has said hello yet.",
    "Puedes ser el primero: enciéndelo en tu ficha.":
      "You could be the first: turn it on in your details.",
    "Ir a mi ficha": "Go to my details",

    /* ---------- Educación y deporte ---------- */
    "Educación y deporte": "Training and dog sport",
    "AmigoMío no es sólo residencia. Si te apetece hacer algo más con tu perro, dínoslo y hablamos.":
      "AmigoMío isn't only boarding. If you fancy doing something more with your dog, tell us and we'll talk.",
    "Educación canina": "Dog training",
    "Grupos para trabajar lo de todos los días: que venga cuando le llamas, que pasee sin tirar, que sepa estar en un bar, que no se coma lo que encuentra por la calle.":
      "Group classes for everyday things: coming when called, walking without pulling, settling in a bar, not eating whatever they find in the street.",
    "No hace falta que tu perro sea un problema para venir. La mayoría vienen porque quieren entenderse mejor con él.":
      "Your dog doesn't have to be a problem to come along. Most people come because they want to understand each other better.",
    "Quiero que me contéis": "Tell me more",
    "Qué te gustaría mejorar, la edad que tiene…": "What you'd like to work on, how old they are…",
    "Deporte con tu perro": "Dog sport",
    "El grupo de trabajo entrena aquí. Se hace obediencia, rastro y defensa deportiva — lo que se ve en las pruebas de IGP.":
      "The working group trains here: obedience, tracking and sport protection — what you see at IGP trials.",
    "Antes de nada, vente a ver un entrenamiento.":
      "Before anything else, come and watch a training session.",
    "No hay que llevar al perro ni comprometerse a nada.":
      "No need to bring your dog, and no commitment at all.",
    "Quiero ver un entrenamiento": "I'd like to watch a session",
    "Si has hecho algo antes, qué raza tiene…": "Anything you've done before, what breed they are…",
    "¿De qué perro hablamos?": "Which dog are we talking about?",
    "Todavía no lo sé": "I don't know yet",
    "¿Quieres contarnos algo?": "Anything you'd like to tell us?",
    "Te escribimos o te llamamos.": "We'll write or call you.",
    "Ya no me interesa": "I'm no longer interested",
    "Lo tenemos apuntado": "We've got it noted down",
    "Hemos hablado contigo": "We've spoken with you",
    "Ya estás dentro": "You're in",
    "De momento lo dejamos": "We'll leave it for now",
    "Lo miramos y te decimos algo. ¿Tienes prisa?":
      "We'll look at it and get back to you. In a hurry?",

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
