/* ============================================================
   Mis reservas: las que vienen, las pendientes de pagar y el
   historial de estancias.
   ============================================================ */
import { misReservas, cancelarReserva } from "../datos.js";

const esc = t => String(t ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const euros = n => Number(n).toLocaleString("es-ES",
  { style: "currency", currency: "EUR", minimumFractionDigits: 0 });

const dia = iso => new Date(iso).toLocaleDateString("es-ES",
  { day: "numeric", month: "long", year: "numeric" });

const ROTULOS = {
  pendiente:   { texto: "Falta el justificante", clase: "amarilla" },
  confirmada:  { texto: "Confirmada",            clase: "azul" },
  en_curso:    { texto: "Está aquí ahora",       clase: "azul" },
  finalizada:  { texto: "Terminada",             clase: "" },
  cancelada:   { texto: "Cancelada",             clase: "" },
  caducada:    { texto: "Caducó sin pagar",      clase: "roja" },
};

export async function render(contenedor) {
  contenedor.innerHTML = `<p class="cargando">Buscando tus reservas…</p>`;

  let lista;
  try { lista = await misReservas(); }
  catch { contenedor.innerHTML = `<div class="error">No hemos podido cargarlas.</div>`; return; }

  if (lista.length === 0) {
    contenedor.innerHTML = `
      <h2>Mis reservas</h2>
      <div class="tarjeta vacio">
        <p>Todavía no has reservado nada.</p>
        <button class="boton" data-ir="reservar">Reservar unos días</button>
      </div>`;
    enganchar();
    return;
  }

  const ahora = new Date().toISOString();
  const proximas  = lista.filter(r => r.salida >= ahora &&
                      ["pendiente","confirmada","en_curso"].includes(r.estado));
  const pasadas   = lista.filter(r => !proximas.includes(r));

  contenedor.innerHTML = `
    <h2>Mis reservas</h2>
    ${proximas.length ? `<div class="lista-perros">${proximas.map(tarjeta).join("")}</div>` : ""}
    ${pasadas.length ? `
      <h3 class="separador">Estancias anteriores</h3>
      <div class="lista-perros">${pasadas.map(tarjeta).join("")}</div>` : ""}`;

  enganchar();

  function enganchar() {
    contenedor.querySelectorAll("[data-ir]").forEach(b =>
      b.addEventListener("click", () => window.irA?.(b.dataset.ir)));

    contenedor.querySelectorAll("[data-cancelar]").forEach(b =>
      b.addEventListener("click", async () => {
        b.disabled = true;
        await cancelarReserva(b.dataset.cancelar);
        render(contenedor);
      }));
  }
}

function tarjeta(r) {
  const rotulo = ROTULOS[r.estado] || { texto: r.estado, clase: "" };
  const perros = (r.reserva_perro || []).map(x => x.perro?.nombre).filter(Boolean);
  const quedan = Math.ceil((new Date(r.entrada) - Date.now()) / 86400000);
  const sePuedeCancelar = ["pendiente","confirmada"].includes(r.estado) && quedan >= 7;

  return `
    <div class="tarjeta">
      <span class="etiqueta ${rotulo.clase}">${rotulo.texto}</span>
      <h3>${perros.length ? esc(perros.join(" y ")) : "Tu reserva"}</h3>
      <p class="flojo">Del ${dia(r.entrada)} al ${dia(r.salida)}
         · ${esc(r.alojamiento?.nombre || "")}</p>
      <p><strong>${euros(r.total)}</strong></p>

      ${r.estado === "pendiente" ? `
        <div class="aviso">
          <strong>Nos falta el justificante de la transferencia.</strong>
          ${r.expira ? `<br>Tienes hasta el ${dia(r.expira)} a las
            ${new Date(r.expira).toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}.` : ""}
          <br>Pídenos el número de cuenta si no lo tienes: 673 229 399.
        </div>` : ""}

      ${sePuedeCancelar
        ? `<button class="enlace" data-cancelar="${r.id}">Cancelar (te devolvemos todo)</button>`
        : ["pendiente","confirmada"].includes(r.estado)
          ? `<p class="flojo">Quedan menos de 7 días: ya no se puede cancelar por aquí.
               Si ha pasado algo, llámanos.</p>` : ""}
    </div>`;
}
