/* ============================================================
   Por dónde se nos habla.

   Está aquí y no repartido por las pantallas porque el día que
   cambie el número hay que cambiarlo en un sitio, no en seis.

   Se dice «háblanos», no «llámanos»: hay gente que no coge el
   teléfono ni queriendo, y el WhatsApp lo abre todo el mundo.
   ============================================================ */

/* En internacional: sin el +34 el enlace no abre nada fuera de
   España, y a la residencia viene gente de fuera. */
export const TELEFONO = "+34673229399";

/* El mismo, para leerlo. */
export const TELEFONO_BONITO = "673 229 399";

/** El enlace de WhatsApp, con el mensaje ya empezado si se quiere. */
export function enlaceWhatsApp(mensaje = "") {
  const numero = TELEFONO.replace(/\D/g, "");   // wa.me no quiere ni + ni espacios
  return `https://wa.me/${numero}` +
         (mensaje ? `?text=${encodeURIComponent(mensaje)}` : "");
}

/** El botón de hablar, ya montado, para no repetirlo en cada vista. */
export function botonWhatsApp(texto = "Escríbenos por WhatsApp", mensaje = "") {
  return `<a class="boton whatsapp" target="_blank" rel="noopener"
             href="${enlaceWhatsApp(mensaje)}">${texto}</a>`;
}
