/* ============================================================
   Clientes: buscar, ver sus perros y autorizar el pago en
   persona.
   ============================================================ */
import { clientes, perrosDe, autorizarPagoEnPersona } from "../datos.js";

const esc = t => String(t ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export async function render(contenedor) {
  let busqueda = "";
  let abierto = null;

  await pintar();

  async function pintar(aviso = "") {
    contenedor.innerHTML = `
      <h2>Clientes</h2>
      ${aviso ? `<div class="aviso">${esc(aviso)}</div>` : ""}
      <input id="buscar" placeholder="Nombre, teléfono o DNI" value="${esc(busqueda)}">
      <div id="resultado"><p class="cargando">Buscando…</p></div>`;

    const caja = contenedor.querySelector("#buscar");
    caja.addEventListener("input", () => {
      busqueda = caja.value;
      clearTimeout(caja._t);
      caja._t = setTimeout(listar, 300);
    });

    await listar();
  }

  async function listar() {
    const hueco = contenedor.querySelector("#resultado");
    let lista;
    try { lista = await clientes(busqueda); }
    catch { hueco.innerHTML = `<div class="error">No hemos podido buscar.</div>`; return; }

    if (lista.length === 0) {
      hueco.innerHTML = `<div class="tarjeta vacio"><p>Nadie con eso.</p></div>`;
      return;
    }

    hueco.innerHTML = `<div class="lista-perros">${lista.map(tarjeta).join("")}</div>`;

    hueco.querySelectorAll("[data-abrir]").forEach(el =>
      el.addEventListener("click", async e => {
        if (e.target.closest("[data-pago]")) return;
        abierto = abierto === el.dataset.abrir ? null : el.dataset.abrir;
        await listar();
        if (abierto) await pintarPerros(abierto);
      }));

    hueco.querySelectorAll("[data-pago]").forEach(b =>
      b.addEventListener("click", async e => {
        e.stopPropagation();
        const [id, valor] = b.dataset.pago.split(":");
        b.disabled = true;
        const r = await autorizarPagoEnPersona(id, valor === "si");
        await pintar(r.mensaje);
      }));

    if (abierto) await pintarPerros(abierto);
  }

  function tarjeta(c) {
    const nombre = `${esc(c.nombre)} ${esc(c.apellidos)}`.trim() || "(sin nombre todavía)";
    const abiertoAhora = abierto === c.id;
    return `
      <div class="tarjeta cliente" data-abrir="${c.id}">
        <div class="fila-cliente">
          <div>
            <h3>${nombre} ${c.es_admin ? `<span class="etiqueta azul">administración</span>` : ""}</h3>
            <p class="flojo">${esc(c.telefono) || "sin teléfono"} · ${esc(c.dni) || "sin DNI"}</p>
          </div>
          <button class="boton ${c.paga_en_persona ? "" : "fantasma"} pequeno"
                  data-pago="${c.id}:${c.paga_en_persona ? "no" : "si"}">
            ${c.paga_en_persona ? "Paga en persona" : "Autorizar pago en persona"}
          </button>
        </div>
        ${abiertoAhora ? `<div class="perros-de" id="perros-${c.id}">
            <p class="cargando">Buscando sus perros…</p></div>` : ""}
      </div>`;
  }

  async function pintarPerros(clienteId) {
    const hueco = contenedor.querySelector(`#perros-${clienteId}`);
    if (!hueco) return;
    const perros = await perrosDe(clienteId);
    hueco.innerHTML = perros.length === 0
      ? `<p class="flojo">Todavía no ha dado de alta ningún perro.</p>`
      : perros.map(p => `
          <div class="perro-mini">
            <strong>${esc(p.nombre)}</strong>
            <span class="flojo">${esc(p.raza) || "sin raza"} · chip ${esc(p.chip)}</span>
            ${p.agresivo_con_personas ? `<span class="etiqueta roja">alojamiento aparte</span>` : ""}
            ${p.es_ppp ? `<span class="etiqueta">PPP</span>` : ""}
          </div>`).join("");
  }
}
