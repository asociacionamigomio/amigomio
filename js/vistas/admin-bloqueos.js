/* ============================================================
   Bloquear fechas.

   Fechas en las que un alojamiento —o todos— no se puede
   reservar: obras, desinfección, vacaciones, una avería.

   Y la razón por la que se hizo ahora: MIENTRAS WIX SIGA
   VENDIENDO, los boxes que se le dejan a él se bloquean aquí.
   Así los dos sistemas no venden la misma noche, que es lo que
   pasaría si no, y no se descubre hasta que llegan dos perros
   al mismo box.
   ============================================================ */
import { alojamientos, bloqueos, bloquearFechas, quitarBloqueo } from "../datos.js";
import { enCristiano } from "../sanidad.js";

const esc = t => String(t ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const hoy = () => new Date().toISOString().slice(0, 10);

export async function render(contenedor) {
  const elegidos = new Set();
  let todos = true;

  await pintar();

  async function pintar(aviso = "", clase = "aviso") {
    contenedor.innerHTML = `<p class="cargando">Un momento…</p>`;

    const [boxes, puestos] = await Promise.all([alojamientos(), bloqueos()]);
    const vivos = puestos.filter(b => b.hasta >= hoy());
    const pasados = puestos.filter(b => b.hasta < hoy());

    contenedor.innerHTML = `
      <h2>Bloquear fechas</h2>
      <p class="flojo">Días en los que un alojamiento no se puede reservar: obras,
         desinfección, vacaciones. <strong>Y los boxes que le dejes a Wix</strong>
         mientras los dos sistemas convivan, para que no vendáis la misma noche
         dos veces.</p>

      ${aviso ? `<div class="${clase}">${esc(aviso)}</div>` : ""}

      <div class="tarjeta">
        <h3>Bloquear</h3>

        <div class="fechas">
          <div><label for="b-desde">Desde</label>
            <input type="date" id="b-desde" min="${hoy()}" max="2100-12-31" value="${hoy()}"></div>
          <div><label for="b-hasta">Hasta (incluido)</label>
            <input type="date" id="b-hasta" min="${hoy()}" max="2100-12-31" value="${hoy()}"></div>
        </div>

        <label for="b-motivo">¿Por qué?</label>
        <input id="b-motivo" placeholder="Desinfección · Reservado en Wix · Obras">
        <p class="flojo">Lo verás tú en el cuadrante. El cliente sólo ve que no hay sitio.</p>

        <p class="rotulo" style="margin-top:1rem">¿Cuáles?</p>
        <label class="casilla">
          <input type="checkbox" id="b-todos" ${todos ? "checked" : ""}>
          <span><strong>Todos</strong> — cierro la residencia esos días.
            <br><span class="flojo">Incluye los boxes que se den de alta más
              adelante.</span></span>
        </label>

        <div class="boxes ${todos ? "apagados" : ""}" id="b-boxes">
          ${boxes.map(a => `
            <label class="box-elegir">
              <input type="checkbox" data-aloj="${a.id}"
                     ${elegidos.has(a.id) ? "checked" : ""} ${todos ? "disabled" : ""}>
              <span>${esc(a.nombre)}${a.tipo === "especial" ? " <em>(especial)</em>" : ""}</span>
            </label>`).join("")}
        </div>

        <button class="boton" id="b-poner" style="margin-top:.8rem">Bloquear estas fechas</button>
      </div>

      <div class="tarjeta" style="margin-top:1rem">
        <h3>Lo que hay bloqueado</h3>
        ${vivos.length === 0 ? `<p class="flojo">Nada por ahora.</p>` : `
          <div class="lista-bloqueos">${vivos.map(fila).join("")}</div>`}

        ${pasados.length ? `
          <details style="margin-top:1rem">
            <summary class="flojo">${pasados.length} bloqueo${pasados.length === 1 ? "" : "s"} que ya pasaron</summary>
            <div class="lista-bloqueos">${pasados.map(fila).join("")}</div>
          </details>` : ""}
      </div>`;

    const casillaTodos = contenedor.querySelector("#b-todos");
    casillaTodos.addEventListener("change", () => {
      todos = casillaTodos.checked;
      if (todos) elegidos.clear();
      pintar();
    });

    contenedor.querySelectorAll("[data-aloj]").forEach(c =>
      c.addEventListener("change", () => {
        const id = Number(c.dataset.aloj);
        if (c.checked) elegidos.add(id); else elegidos.delete(id);
      }));

    contenedor.querySelector("#b-poner").addEventListener("click", async e => {
      if (!todos && elegidos.size === 0)
        return pintar("Marca al menos un alojamiento, o pon «Todos».", "error");

      e.target.disabled = true;
      const r = await bloquearFechas(
        todos ? [] : [...elegidos],
        contenedor.querySelector("#b-desde").value,
        contenedor.querySelector("#b-hasta").value,
        contenedor.querySelector("#b-motivo").value.trim());
      elegidos.clear();
      await pintar(r.mensaje, r.ok ? "aviso" : "error");
    });

    contenedor.querySelectorAll("[data-quitar]").forEach(b =>
      b.addEventListener("click", async () => {
        const r = await quitarBloqueo(b.dataset.quitar);
        await pintar(r.mensaje, r.ok ? "aviso" : "error");
      }));
  }

  function fila(b) {
    const cuales = b.alojamiento?.nombre
      ? esc(b.alojamiento.nombre)
      : `<strong>todos los alojamientos</strong>`;
    const unDia = b.desde === b.hasta;
    return `
      <div class="bloqueo">
        <div>
          <strong>${unDia ? `El ${enCristiano(b.desde)}`
                          : `Del ${enCristiano(b.desde)} al ${enCristiano(b.hasta)}`}</strong>
          <p class="flojo">${cuales}${b.motivo ? ` · ${esc(b.motivo)}` : ""}</p>
        </div>
        <button class="enlace quitar" data-quitar="${b.id}">Quitar</button>
      </div>`;
  }
}
