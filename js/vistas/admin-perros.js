/* ============================================================
   Los perros de los clientes.

   «Mis perros» son los del que ha entrado, también si es
   administración: mezclarlos ensuciaba hasta los avisos de
   vacunas del inicio. Ésta es la otra puerta.

   Lo que se viene a hacer aquí es una de dos cosas: buscar un
   perro concreto («este chip, ¿de quién es?») o mirar a quién
   se le está caducando algo. Por eso hay buscador y por eso los
   avisos se ven de un vistazo.
   ============================================================ */
import { perrosBuscando } from "../datos.js";
import { avisosDelPerro, enCristiano } from "../sanidad.js";

const esc = t => String(t ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export async function render(contenedor) {
  let busca = "";
  let soloConAvisos = false;

  await pintar();

  async function pintar() {
    contenedor.innerHTML = `
      <div class="cabecera-seccion">
        <h2>Perros de los clientes</h2>
      </div>
      <input id="buscar" placeholder="Nombre del perro, chip, o nombre del dueño"
             value="${esc(busca)}">
      <label class="casilla pequena">
        <input type="checkbox" id="solo-avisos" ${soloConAvisos ? "checked" : ""}>
        Sólo los que tienen algo caducado o a punto
      </label>
      <div id="resultado"><p class="cargando">Buscando…</p></div>`;

    const caja = contenedor.querySelector("#buscar");
    caja.addEventListener("input", () => {
      busca = caja.value;
      clearTimeout(caja._t);
      caja._t = setTimeout(listar, 300);
    });
    contenedor.querySelector("#solo-avisos").addEventListener("change", e => {
      soloConAvisos = e.target.checked;
      listar();
    });

    await listar();
  }

  async function listar() {
    const hueco = contenedor.querySelector("#resultado");
    let perros = await perrosBuscando(busca);

    /* Los avisos se calculan aquí, con el mismo motor que la
       ficha del cliente: una sola regla, no dos que se
       contradicen. */
    const conAvisos = perros.map(p => ({ perro: p, avisos: avisosDelPerro(p) }));
    const lista = soloConAvisos ? conAvisos.filter(x => x.avisos.length) : conAvisos;

    if (lista.length === 0) {
      hueco.innerHTML = `<div class="tarjeta vacio"><p>${
        busca || soloConAvisos ? "Nada con eso." : "Todavía no hay perros dados de alta."
      }</p></div>`;
      return;
    }

    hueco.innerHTML = `
      <p class="flojo">${lista.length} perro${lista.length === 1 ? "" : "s"}</p>
      <div class="lista-perros">${lista.map(fila).join("")}</div>`;
  }

  function fila({ perro: p, avisos }) {
    const dueno = `${p.cliente?.nombre ?? ""} ${p.cliente?.apellidos ?? ""}`.trim();
    const vencido = avisos.find(a => a.estado === "caducado");
    return `
      <div class="tarjeta perro-admin ${vencido ? "con-vencido" : ""}">
        <div class="fila-cliente">
          <div>
            <h3>${esc(p.nombre)}</h3>
            <p class="flojo">${esc(p.raza) || "sin raza"} · chip ${esc(p.chip)}</p>
            <p class="flojo">${esc(dueno) || "sin nombre"}${
              p.cliente?.telefono ? ` · ${esc(p.cliente.telefono)}` : ""}</p>
          </div>
          <div class="marcas-perro">
            ${p.agresivo_con_personas
              ? `<span class="etiqueta roja">alojamiento aparte</span>` : ""}
            ${p.es_ppp ? `<span class="etiqueta">PPP</span>` : ""}
            ${p.borrador ? `<span class="etiqueta">alta a medias</span>` : ""}
          </div>
        </div>

        ${avisos.length ? `
          <div class="lista-avisos">
            ${avisos.slice(0, 3).map(a => `
              <div class="aviso-linea ${a.estado === "caducado" ? "vencido" : ""}">
                <span class="punto"></span>
                <div><p>${esc(a.nombre)}</p>
                     <span class="cuando">${a.dias < 0
                       ? `venció el ${enCristiano(a.caduca)}`
                       : a.dias === 0 ? "vence hoy"
                       : `quedan ${a.dias} días`}</span></div>
              </div>`).join("")}
            ${avisos.length > 3
              ? `<p class="flojo">y ${avisos.length - 3} más</p>` : ""}
          </div>` : ""}
      </div>`;
  }
}
