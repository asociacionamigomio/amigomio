/* ============================================================
   El botón flotante de Zapatilla.

   Está en TODAS las pantallas: no es una sección a la que se
   entra, es alguien que está ahí.

   Aquí no hay ni una regla de negocio. Esto solo pinta la
   conversación y la manda a la función, que es donde vive
   Zapatilla y donde están las comprobaciones.
   ============================================================ */
import { supabase } from "./sesion.js";
import { TELEFONO_BONITO } from "./contacto.js";

const esc = t => String(t ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* Lo que escribe Zapatilla puede traer saltos de línea, alguna
   **negrita** y enlaces. Nada más: NO se interpreta HTML venga de
   donde venga — lo que escribe un modelo es texto de fuera, y se
   escapa entero antes de tocar nada.

   Los enlaces hicieron falta el 13/09/2026. Santiago: «el enlace
   de whatsapp que da zapatilla va mal». Y el número estaba bien:
   lo que pasaba es que salía escrito y NO SE PODÍA TOCAR. En un
   móvil, un enlace que no se toca no es un enlace — es un número
   que hay que copiar a mano.

   Sólo `http` y `https`. `javascript:` en un enlace que escribe
   un modelo es exactamente la razón por la que esto se escapaba
   entero, y no se enlaza jamás. */

/* Una sola pasada con las dos formas a la vez. En dos pasadas, la
   segunda entraría a destrozar el `href` que acaba de escribir la
   primera. */
const ENLACES = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(\bhttps?:\/\/[^\s<>"')]+)/g;

/* Zapatilla escribe «(https://wa.me/34673229399).» y esos signos
   no son de la dirección. Si se cuelan, WhatsApp no encuentra a
   nadie: la forma más tonta de que un enlace falle. */
const quitarElRabo = url => url.replace(/[.,;:!?]+$/, "");

function enlazar(texto, url) {
  const limpia = quitarElRabo(url);
  return `<a href="${limpia}" target="_blank" rel="noopener noreferrer">` +
         `${texto || limpia}</a>`;
}

/* Exportada para poder probarla de verdad, no leyendo el código. */
export function aTexto(t) {
  /* Escapar SIEMPRE primero: a partir de aquí no queda ni un `<`
     ni una comilla capaz de romper un atributo. */
  return esc(t)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(ENLACES, (entero, texto, urlMarkdown, urlSuelta) =>
      enlazar(texto, urlMarkdown || urlSuelta))
    .replace(/\n/g, "<br>");
}

let historia = [];
let hablando = false;

export function montar() {
  if (document.getElementById("zapatilla-boton")) return;

  const boton = document.createElement("button");
  boton.id = "zapatilla-boton";
  boton.className = "zapatilla-boton";
  boton.setAttribute("aria-label", "Hablar con Zapatilla");
  boton.innerHTML = `<img src="assets/zapatilla.png" alt="">`;
  boton.addEventListener("click", abrir);
  document.body.appendChild(boton);

  const panel = document.createElement("div");
  panel.id = "zapatilla-panel";
  panel.className = "zapatilla-panel";
  panel.hidden = true;
  panel.innerHTML = `
    <header>
      <img src="assets/zapatilla.png" alt="">
      <div>
        <strong>Zapatilla</strong>
        <span>por aquí ando</span>
      </div>
      <button class="cerrar" aria-label="Cerrar">×</button>
    </header>
    <div class="charla" id="zapatilla-charla"></div>
    <form class="escribir" id="zapatilla-form">
      <input id="zapatilla-texto" placeholder="Escríbeme…" autocomplete="off">
      <button type="submit" aria-label="Enviar">→</button>
    </form>`;
  document.body.appendChild(panel);

  panel.querySelector(".cerrar").addEventListener("click", cerrar);
  panel.querySelector("#zapatilla-form").addEventListener("submit", enviar);
}

function abrir() {
  const panel = document.getElementById("zapatilla-panel");
  panel.hidden = false;
  document.getElementById("zapatilla-boton").hidden = true;

  if (historia.length === 0) {
    escribe("zapatilla",
      "¡Hola! Soy Zapatilla. Llevo aquí toda la vida, así que pregúntame lo " +
      "que sea: fechas, precios, o si quieres te guardo el sitio directamente.");
  }
  document.getElementById("zapatilla-texto").focus();
}

function cerrar() {
  document.getElementById("zapatilla-panel").hidden = true;
  document.getElementById("zapatilla-boton").hidden = false;
}

function escribe(quien, texto) {
  const charla = document.getElementById("zapatilla-charla");
  const d = document.createElement("div");
  d.className = `globo ${quien}`;
  d.innerHTML = aTexto(texto);
  charla.appendChild(d);
  charla.scrollTop = charla.scrollHeight;
  return d;
}

/* Los tres puntitos del «está escribiendo».
   Va por su propia puerta y no por escribe(), porque ahí TODO se
   escapa —a propósito: lo que dice Zapatilla viene de un modelo
   que ha leído datos escritos por clientes—. Si le pasas etiquetas
   como texto, te las enseña tal cual, que es justo lo que pasó. */
function puntitos() {
  const charla = document.getElementById("zapatilla-charla");
  const d = document.createElement("div");
  d.className = "globo zapatilla pensando";
  for (let i = 0; i < 3; i++) d.appendChild(document.createElement("span"));
  charla.appendChild(d);
  charla.scrollTop = charla.scrollHeight;
  return d;
}

async function enviar(e) {
  e.preventDefault();
  if (hablando) return;

  const caja = document.getElementById("zapatilla-texto");
  const texto = caja.value.trim();
  if (!texto) return;

  caja.value = "";
  escribe("yo", texto);
  historia.push({ role: "user", content: texto });

  hablando = true;
  const esperando = puntitos();

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("sin sesión");

    const r = await fetch(`${window.CONFIG.SUPABASE_URL}/functions/v1/zapatilla`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mensajes: historia }),
    });

    const datos = await r.json();
    esperando.remove();

    if (datos.error) return escribe("zapatilla", datos.error);

    historia = datos.historia || historia;
    escribe("zapatilla", datos.texto);

    /* Si ha creado o cambiado algo, la pantalla de debajo está
       vieja. Se recarga sola para que no haya que adivinarlo. */
    if (/reserv|dado de alta|apuntad/i.test(datos.texto || "")) window.refrescar?.();

  } catch {
    esperando.remove();
    escribe("zapatilla",
      "Uy, se me ha ido el santo al cielo. Inténtalo otra vez, " +
      `o escríbenos al WhatsApp ${TELEFONO_BONITO} y te atendemos.`);
  } finally {
    hablando = false;
    caja.focus();
  }
}
