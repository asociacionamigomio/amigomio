/* ============================================================
   Solicitudes de cambio de chip o nombre, pendientes de tu
   visto bueno.

   Aprobar cambia el dato del perro de verdad, no sólo marca la
   solicitud. Por eso conviene mirar antes de dar al botón.
   ============================================================ */
import { solicitudesPendientes, resolverSolicitud } from "../datos.js";

const esc = t => String(t ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const fecha = iso => new Date(iso).toLocaleDateString("es-ES",
  { day: "numeric", month: "long", year: "numeric" });

export async function render(contenedor) {
  contenedor.innerHTML = `<p class="cargando">Buscando solicitudes…</p>`;

  let lista;
  try { lista = await solicitudesPendientes(); }
  catch { contenedor.innerHTML = `<div class="error">No hemos podido cargarlas.</div>`; return; }

  if (lista.length === 0) {
    contenedor.innerHTML = `
      <h2>Solicitudes</h2>
      <div class="tarjeta vacio"><p>Nada pendiente. Todo al día.</p></div>`;
    return;
  }

  contenedor.innerHTML = `
    <h2>Solicitudes <span class="cuenta">${lista.length}</span></h2>
    <div class="lista-perros">${lista.map(tarjeta).join("")}</div>`;

  contenedor.querySelectorAll("[data-resolver]").forEach(b =>
    b.addEventListener("click", async () => {
      const [id, accion] = b.dataset.resolver.split(":");
      b.disabled = true;
      b.textContent = "Un momento…";
      const r = await resolverSolicitud(id, { aprobar: accion === "aprobar" });
      if (!r.ok) { b.disabled = false; b.textContent = "Reintentar"; alerta(contenedor, r.mensaje); return; }
      render(contenedor);
    }));
}

function tarjeta(s) {
  const quien = `${esc(s.cliente?.nombre)} ${esc(s.cliente?.apellidos)}`.trim() || "Sin nombre";
  return `
    <div class="tarjeta solicitud">
      <p class="flojo">${fecha(s.creada)} · ${quien}
         ${s.cliente?.telefono ? `· ${esc(s.cliente.telefono)}` : ""}</p>
      <h3>${esc(s.perro?.nombre)}</h3>
      <p>Pide cambiar <strong>${s.campo === "chip" ? "el número de chip" : "el nombre"}</strong>:</p>
      <div class="cambio">
        <span class="viejo">${esc(s.valor_actual)}</span>
        <span class="flecha">→</span>
        <span class="nuevo">${esc(s.valor_nuevo)}</span>
      </div>
      ${s.motivo ? `<p class="motivo">«${esc(s.motivo)}»</p>` : ""}
      <div class="botonera">
        <button class="boton fantasma" data-resolver="${s.id}:rechazar">Rechazar</button>
        <button class="boton" data-resolver="${s.id}:aprobar">Aprobar y aplicar</button>
      </div>
    </div>`;
}

function alerta(contenedor, mensaje) {
  const d = document.createElement("div");
  d.className = "error";
  d.textContent = mensaje;
  contenedor.prepend(d);
}
