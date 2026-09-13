/* ============================================================
   Cómo llegar.

   Santiago, 13/09/2026: «crea en el menú un cómo llegar».

   Parece una tontería y es de lo más útil que hay: el día de la
   entrada el cliente va conduciendo, con el perro detrás y a
   veces con los niños, y necesita UNA cosa — que el móvil le
   lleve. No un mapa que mirar y traducir: que le lleve.

   Por eso el botón abre la RUTA desde donde esté, no un mapa
   suelto. Es lo que se hace con el coche parado en la puerta de
   casa, y es un toque en vez de cuatro.

   ------------------------------------------------------------
   LA DIRECCIÓN EXACTA NO ESTÁ AQUÍ, Y NO PUEDE ESTAR.

   El repositorio es público (regla 4 del CLAUDE.md): ahí no
   entran datos personales ni la dirección exacta del núcleo.

   Así que el destino sale de un ajuste de la base
   (`mapa_destino`), que administración pone y cambia sin tocar
   código. Y si todavía no está puesto, se busca por el NOMBRE
   del sitio — que es público, tiene su ficha en Google, y no es
   una dirección.

   La zona sí se dice, porque ya está publicada en la web de
   AmigoMío y porque saber que es Puerto Real y no Jerez cambia
   cómo se planifica el viaje.
   ============================================================ */
import { ajustePublico } from "../datos.js";
import { botonWhatsApp } from "../contacto.js";
import { t } from "../idioma.js";

const esc = t2 => String(t2 ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* Sin ajuste, el nombre del sitio. Google lo resuelve igual y
   aquí no queda escrita ninguna dirección. */
const POR_DEFECTO = "AmigoMío Residencia Canina, Puerto Real";

export async function render(contenedor) {
  contenedor.innerHTML = `<p class="cargando">${t("Un momento…")}</p>`;

  /* Si la base todavía no tiene el ajuste, se sigue adelante con
     el nombre. Lo que no puede pasar es quedarse sin pantalla.
     EL NAVEGADOR SE DESPLIEGA ANTES QUE LA BASE. SIEMPRE. */
  let destino = POR_DEFECTO;
  try {
    const puesto = await ajustePublico("mapa_destino");
    if (puesto && puesto.trim()) destino = puesto.trim();
  } catch { /* con el nombre vale */ }

  const ruta = "https://www.google.com/maps/dir/?api=1&destination="
             + encodeURIComponent(destino);
  const verlo = "https://www.google.com/maps/search/?api=1&query="
             + encodeURIComponent(destino);

  contenedor.innerHTML = `
    <h2>${t("Cómo llegar")}</h2>

    <div class="tarjeta">
      <p>${t("Estamos en El Marquesado, Puerto Real (Cádiz).")}</p>

      <!-- El botón gordo, y el primero: es a lo que se viene. -->
      <a class="boton" href="${esc(ruta)}" target="_blank" rel="noopener">
        ${t("Llévame hasta allí")}
      </a>
      <p class="flojo">${t("Se abre el mapa del móvil con la ruta desde donde estés.")}</p>

      <a class="boton fantasma" href="${esc(verlo)}" target="_blank" rel="noopener">
        ${t("Sólo ver dónde está")}
      </a>
    </div>

    <div class="tarjeta">
      <p class="rotulo">${t("Un par de cosas del camino")}</p>
      <ul class="cosas">
        <li>${t("El último tramo es de campo. Se llega bien con cualquier coche, pero sin prisa.")}</li>
        <li>${t("Si vienes con el perro suelto en el maletero, párate antes de llegar y ponle la correa: aquí hay otros perros.")}</li>
        <li>${t("Hay sitio de sobra para aparcar dentro.")}</li>
      </ul>
    </div>

    <div class="tarjeta">
      <p class="rotulo">${t("¿Te has liado?")}</p>
      <p class="flojo">${t("Pasa, y no es culpa tuya: por aquí los mapas se hacen un lío con los caminos. Háblanos y te vamos guiando.")}</p>
      ${botonWhatsApp(t("Háblanos por WhatsApp"),
        "Hola, voy de camino a AmigoMío y no encuentro la entrada. ")}
    </div>`;
}
