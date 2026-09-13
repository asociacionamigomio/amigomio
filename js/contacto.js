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

/**
 * Un enlace de WhatsApp a OTRA persona: al dueño de un perro,
 * normalmente, desde el panel de administración.
 *
 * En la ficha la gente escribe el teléfono como le sale:
 * «673229399», «673 22 93 99», «+34 673 229 399». WhatsApp
 * necesita sólo dígitos y con prefijo de país, así que:
 *
 *   - se quita todo lo que no sea número,
 *   - y si quedan nueve cifras —un móvil español— se le pone el
 *     34 delante. Sin eso, WhatsApp no encuentra a nadie y el
 *     botón parece roto.
 *
 * Devuelve null si no hay un número con el que trabajar: quien
 * llama decide qué enseñar, que es mejor que un enlace a
 * ninguna parte.
 */
export function enlaceWhatsAppA(telefono, mensaje = "") {
  const numero = String(telefono ?? "").replace(/\D/g, "");
  if (numero.length < 9) return null;

  const conPrefijo = numero.length === 9 ? "34" + numero : numero;
  return `https://wa.me/${conPrefijo}` +
         (mensaje ? `?text=${encodeURIComponent(mensaje)}` : "");
}
