/* ============================================================
   El alta del perro, en tres pasos cortos.

   Todo lo de aquí es lógica pura: recibe lo que hay escrito en
   el formulario y dice qué falta. No toca el navegador, para
   poder probarlo.

   Por qué en pasos: es el formulario más largo de la app y de
   una sentada la gente lo abandona. Tres pantallas cortas, y se
   puede dejar a medias y seguir mañana.
   ============================================================ */
import { chipValido } from "./perro.js";

export const PASOS = [
  { id: "quien-es",  titulo: "¿Quién es?",
    campos: ["chip", "nombre", "fecha_nacimiento", "sexo", "raza", "capa", "castrado", "foto"] },
  { id: "como-come", titulo: "¿Cómo come y qué cuidados necesita?",
    campos: ["pautas_alimentacion", "cuidados", "sanidad"] },
  { id: "como-es",   titulo: "¿Cómo es?",
    campos: ["agresivo_con_personas", "sociable", "timido", "comilon",
             "polidipsia", "destroyer", "actividad", "es_ppp",
             "ppp_licencia_hasta", "ppp_seguro_hasta"] },
];

const vacio = v => v === undefined || v === null || String(v).trim() === "";

export function validarPaso(numeroPaso, datos, hoy = new Date().toISOString().slice(0, 10)) {
  const faltan = [];
  const falta = (campo, mensaje) => faltan.push({ campo, mensaje });

  if (numeroPaso === 0) {
    if (vacio(datos.nombre)) falta("nombre", "¿Cómo se llama?");

    if (vacio(datos.chip))            falta("chip", "Nos falta el número de chip, el de la cartilla.");
    else if (!chipValido(datos.chip)) falta("chip", "Ese chip no cuadra: son 15 dígitos seguidos.");

    if (vacio(datos.fecha_nacimiento))
      falta("fecha_nacimiento", "¿Cuándo nació? Si no lo sabes exacto, aproxima.");
    else if (datos.fecha_nacimiento > hoy)
      falta("fecha_nacimiento", "Esa fecha está en el futuro. ¿Has bailado el día con el mes?");

    if (vacio(datos.sexo)) falta("sexo", "¿Es macho o hembra?");
  }

  /* El paso 2 no obliga a nada: comida y cuidados son texto libre,
     y hay perros que no necesitan nada especial. */

  if (numeroPaso === 2) {
    if (vacio(datos.sociable))  falta("sociable", "¿Cómo se lleva con otros perros?");
    if (vacio(datos.actividad)) falta("actividad", "¿Es de moverse mucho o de tumbarse al sol?");

    if (datos.es_ppp === true) {
      if (vacio(datos.ppp_licencia_hasta))
        falta("ppp_licencia_hasta",
              "Como es un perro potencialmente peligroso, nos hace falta hasta cuándo vale tu licencia.");
      if (vacio(datos.ppp_seguro_hasta))
        falta("ppp_seguro_hasta",
              "Y hasta cuándo vale el seguro de responsabilidad civil.");
    }
  }

  return { ok: faltan.length === 0, faltan };
}
