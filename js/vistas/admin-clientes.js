/* ============================================================
   Clientes: buscar, ver sus perros y autorizar el pago en
   persona.
   ============================================================ */
import { clientes, perrosDe, autorizarPagoEnPersona, ponerDescuento,
         guardarCliente, escribirACliente } from "../datos.js";

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
        if (e.target.closest("[data-pago], .descuento-cliente, .ficha-admin, .aviso-cliente")) return;
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

    hueco.querySelectorAll("[data-dto]").forEach(b =>
      b.addEventListener("click", async e => {
        e.stopPropagation();
        const id = b.dataset.dto;
        b.disabled = true;
        const r = await ponerDescuento(
          id,
          contenedor.querySelector(`#dto-${id}`).value,
          contenedor.querySelector(`#nota-${id}`).value.trim());
        await pintar(r.mensaje);
      }));

    hueco.querySelectorAll("[data-guardar]").forEach(b =>
      b.addEventListener("click", async e => {
        e.stopPropagation();
        const id = b.dataset.guardar;
        const datos = {};
        contenedor.querySelectorAll(`[id$="-${id}"][data-campo-cliente]`).forEach(i =>
          datos[i.dataset.campoCliente] = i.value.trim());
        b.disabled = true;
        const r = await guardarCliente(id, datos);
        await pintar(r.mensaje);
      }));

    hueco.querySelectorAll("[data-escribir]").forEach(b =>
      b.addEventListener("click", async e => {
        e.stopPropagation();
        const id = b.dataset.escribir;
        b.disabled = true;
        const r = await escribirACliente(
          id,
          contenedor.querySelector(`#asunto-${id}`).value,
          contenedor.querySelector(`#cuerpo-${id}`).value);
        if (!r.ok) b.disabled = false;
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

        ${Number(c.descuento_pct) > 0 ? `
          <p class="etiqueta verde descuento-puesto">−${esc(c.descuento_pct)} %${
            c.descuento_nota ? ` · ${esc(c.descuento_nota)}` : ""}</p>` : ""}

        ${abiertoAhora ? `
          <div class="ficha-admin">
            <p class="rotulo">Sus datos</p>
            <p class="flojo">Para corregir un teléfono mal apuntado sin tener que
               llamarle. El correo con el que entra no se cambia desde aquí.</p>
            <div class="rejilla-datos">
              ${[["nombre","Nombre"],["apellidos","Apellidos"],["dni","DNI"],
                 ["telefono","Teléfono"],["domicilio","Domicilio"],
                 ["recoge_nombre","Quién más puede recoger"],
                 ["recoge_dni","DNI de esa persona"]].map(([campo, rotulo]) => `
                <label>${esc(rotulo)}
                  <input id="c-${campo}-${c.id}" data-campo-cliente="${campo}"
                         value="${esc(c[campo])}"></label>`).join("")}
            </div>
            <button class="boton pequeno" data-guardar="${c.id}">Guardar datos</button>
          </div>

          <div class="aviso-cliente">
            <p class="rotulo">Escribirle</p>
            ${c.quiere_correos === false ? `
              <p class="flojo">Ha pedido que no le escribamos. No se le puede mandar
                 nada por correo; háblale por teléfono o WhatsApp.</p>` : `
              <p class="flojo">Le llega por correo. Se manda desde el servidor, así
                 que puedes cerrar esto en cuanto le des a mandar.</p>
              <input id="asunto-${c.id}" placeholder="Asunto">
              <textarea id="cuerpo-${c.id}" rows="4"
                placeholder="Hola: te escribimos porque…"></textarea>
              <button class="boton pequeno" data-escribir="${c.id}">Mandar el aviso</button>`}
          </div>

          <div class="descuento-cliente">
            <p class="rotulo">Descuento de cliente fijo</p>
            <p class="flojo">Se le aplica solo en cada reserva. No se suma a las
               promociones ni al de estancia larga: se queda el mayor de los tres.</p>
            <div class="fila-descuento">
              <label class="mini">Descuenta
                <input type="number" min="0" max="100" class="dias"
                       id="dto-${c.id}" value="${esc(c.descuento_pct ?? 0)}"> %</label>
              <input id="nota-${c.id}" placeholder="Por qué (sale en la factura)"
                     value="${esc(c.descuento_nota)}">
              <button class="boton pequeno" data-dto="${c.id}">Guardar</button>
            </div>
          </div>
          <div class="perros-de" id="perros-${c.id}">
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
          <button class="perro-mini" data-perro="${p.id}">
            <strong>${esc(p.nombre)}</strong>
            <span class="flojo">${esc(p.raza) || "sin raza"} · chip ${esc(p.chip)}</span>
            ${p.agresivo_con_personas ? `<span class="etiqueta roja">alojamiento aparte</span>` : ""}
            ${p.es_ppp ? `<span class="etiqueta">PPP</span>` : ""}
            <span class="flojo abrir">Ver su ficha →</span>
          </button>`).join("");

  /* A la ficha del perro, la misma que ve el cliente. */
  hueco.querySelectorAll("[data-perro]").forEach(b =>
    b.addEventListener("click", e => {
      e.stopPropagation();
      window.verPerro?.(b.dataset.perro);
    }));
  }
}
