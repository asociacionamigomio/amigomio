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

   3. GRACIOSO SIN PASARSE. Esto se lee TODOS los días. Un chiste
      que se repite mucho deja de hacer gracia y empieza a
      estorbar, así que: frases cortas, de andar por casa, y
      ninguna a costa del cliente. Si algún día cansan, se quitan
      y no pasa nada.
   ============================================================ */

/* De qué hora a qué hora. Se coge la PRIMERA que encaje, así que
   el orden importa y `desde` va de menos a más. */
export const FRANJAS = [
  {
    id: "madrugada",          // 00:00 – 06:59
    desde: 0,
    frases: [
      "¿Todavía despierto? Aquí sólo ronca el que tiene cuatro patas.",
      "A estas horas hasta los perros duermen. Casi todos.",
      "De madrugada, y pensando en tu perro. Eso es amor.",
    ],
  },
  {
    id: "temprano",           // 07:00 – 09:59
    desde: 7,
    frases: [
      "Buenos días. Aquí ya se ha repartido el primer desayuno.",
      "Buenos días. A esta hora esto parece una guardería, pero con más pelo.",
      "Buenos días. El primer paseo ya está dado y las colas también.",
    ],
  },
  {
    id: "manana",             // 10:00 – 13:59
    desde: 10,
    frases: [
      "Buenos días. Por aquí hay más juego que faena.",
      "Buenos días. Los patios están en plena hora punta.",
      "Buenos días. Ya se ha perdido la primera pelota del día.",
    ],
  },
  {
    id: "sobremesa",          // 14:00 – 17:59
    desde: 14,
    frases: [
      "Buenas tardes. Aquí es la hora de la siesta general.",
      "Buenas tardes. En esta casa, después de comer, nadie se mueve.",
      "Buenas tardes. Silencio absoluto: están todos roque.",
    ],
  },
  {
    id: "tarde",              // 18:00 – 21:29
    desde: 18,
    frases: [
      "Buenas tardes. Última ronda de patio y a cenar.",
      "Buenas tardes. Ahora mismo esto es todo colas y barullo.",
      "Buenas tardes. Se acerca la cena y aquí se nota en el ambiente.",
    ],
  },
  {
    id: "noche",              // 21:30 – 23:59
    desde: 21.5,
    frases: [
      "Buenas noches. Por aquí ya están todos recogidos.",
      "Buenas noches. Cenados, paseados y durmiendo como troncos.",
      "Buenas noches. Aquí ya no se oye ni un ladrido.",
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
