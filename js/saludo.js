/* ============================================================
   El saludo de la entrada.

   Santiago, 13/09/2026: «da un mensaje de bienvenida adaptado a
   la hora del día, debe ser gracioso y familiar».

   Es lo primero que ve el cliente cada vez que abre. Un «¡Hola,
   Santiago!» a secas no está mal, pero tampoco dice nada — y esto
   es una residencia canina de pueblo, no un banco.

   Tres reglas, y las tres tienen su motivo:

   1. LA HORA MANDA. Dar los «buenos días» a las once de la noche
      es exactamente lo que hace que una aplicación parezca una
      máquina.

   2. VARÍA POR DÍA, NO POR PARPADEO. Si cambiara cada vez que se
      repinta la pantalla —y se repinta al cambiar de sección—
      marearía. Se elige con el día del año: hoy siempre la misma,
      mañana otra.

   3. GRACIOSO SIN PASARSE, Y SOBRE TODO TRANQUILO. Esto se lee
      TODOS los días. Un chiste que se repite mucho deja de hacer
      gracia y empieza a estorbar, así que: frases cortas, de
      andar por casa, y ninguna a costa del cliente.

      Y la imagen que se da es de PAZ. Santiago, 13/09/2026: «no
      me gusta eso de colas y barullo, prefiero dar una imagen de
      paz, nos acabamos de despertar de la siesta... cosas así».
      Tiene razón, y no es sólo estética: quien deja aquí a su
      perro se está imaginando dónde está. Si lo que le contamos
      es jaleo, se lo imagina agobiado. Nada de «hora punta» ni de
      «barullo» — sol, sombra, siesta y poca prisa.
   ============================================================ */

/* De qué hora a qué hora. Se coge la PRIMERA que encaje, así que
   el orden importa y `desde` va de menos a más. */
export const FRANJAS = [
  {
    id: "madrugada",          // 00:00 – 06:59
    desde: 0,
    frases: [
      "A estas horas aquí no se mueve ni una oreja.",
      "Todos dormidos. Hasta el que ronca.",
      "De madrugada, y pensando en tu perro. Eso es amor.",
    ],
  },
  {
    id: "temprano",           // 07:00 – 09:59
    desde: 7,
    frases: [
      "Buenos días. Aquí se desayuna despacio.",
      "Buenos días. Los primeros ya están tomando el sol.",
      "Buenos días. Empieza el día con calma, que es como mejor sale.",
    ],
  },
  {
    id: "manana",             // 10:00 – 13:59
    desde: 10,
    frases: [
      "Buenos días. Mañana tranquila: sol, sombra y poco más.",
      "Buenos días. Unos juegan y otros miran. Cada uno a lo suyo.",
      "Buenos días. Por aquí nadie tiene prisa.",
    ],
  },
  {
    id: "sobremesa",          // 14:00 – 17:59
    desde: 14,
    frases: [
      "Buenas tardes. Nos acabamos de despertar de la siesta.",
      "Buenas tardes. A esta hora aquí sólo se oye el viento.",
      "Buenas tardes. Siesta larga y sin remordimientos.",
    ],
  },
  {
    id: "tarde",              // 18:00 – 21:29
    desde: 18,
    frases: [
      "Buenas tardes. Última vuelta por el campo, sin prisa.",
      "Buenas tardes. Cae la tarde y aquí baja el ritmo.",
      "Buenas tardes. Se va la luz y esto se queda en calma.",
    ],
  },
  {
    id: "noche",              // 21:30 – 23:59
    desde: 21.5,
    frases: [
      "Buenas noches. Aquí ya no se oye ni un ladrido.",
      "Buenas noches. Cenados y cada uno en su sitio.",
      "Buenas noches. Todo tranquilo hasta mañana.",
    ],
  },
];

/* Qué día es, contado desde una fecha cualquiera. Sirve para
   elegir una frase que no cambie hasta mañana. */
function numeroDeDia(fecha) {
  return Math.floor(fecha.getTime() / 86400000);
}

function franjaDe(fecha) {
  const hora = fecha.getHours() + fecha.getMinutes() / 60;
  let cual = FRANJAS[0];
  for (const f of FRANJAS) if (hora >= f.desde) cual = f;
  return cual;
}

/**
 * El saludo de hoy, a esta hora.
 *
 * @param nombre  cómo se llama; si no lo sabemos, se saluda igual
 * @param fecha   para poder probarlo sin esperar a que sea de noche
 */
export function saludo(nombre, fecha = new Date()) {
  const franja = franjaDe(fecha);

  /* La misma frase durante todo el día, y distinta mañana. Se
     suma el número de franja para que dos franjas del mismo día
     no digan lo mismo. */
  const i = (numeroDeDia(fecha) + FRANJAS.indexOf(franja)) % franja.frases.length;

  const quien = String(nombre ?? "").trim();
  return quien
    ? `¡Hola, ${quien}! ${franja.frases[i]}`
    : `¡Hola! ${franja.frases[i]}`;
}
