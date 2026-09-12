/* ============================================================
   El botón flotante de Zapatilla.

   Está en TODAS las pantallas: no es una sección a la que se
   entra, es alguien que está ahí.

   Aquí no hay ni una regla de negocio. Esto solo pinta la
   conversación y la manda a la función, que es donde vive
   Zapatilla y donde están las comprobaciones.
   ============================================================ */
import { supabase } from "./sesion.js";

const esc = t => String(t ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* Lo que escribe Zapatilla puede traer saltos de línea y algún
   **negrita**. Nada más: no se interpreta HTML venga de donde venga. */
function aTexto(t) {
  return esc(t)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
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
  const esperando = escribe("zapatilla pensando", "<span></span><span></span><span></span>");

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
      "o llama al 673 229 399 y te atendemos.");
  } finally {
    hablando = false;
    caja.focus();
  }
}
