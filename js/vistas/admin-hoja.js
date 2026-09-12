/* ============================================================
   La hoja del día.

   Pensada para IMPRIMIRSE y colgarla en la nave, no para
   mirarla en el móvil. Por eso lleva casillas que se marcan a
   boli y hueco para firmar.

   El programa sanitario exige observación mínima dos veces al
   día anotando ingesta, agua, heces, actitud y movilidad: esto
   es el papel donde se hace.
   ============================================================ */
import { hojaDelDia } from "../datos.js";

const esc = t => String(t ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const iso = d => d.toISOString().slice(0, 10);

export async function render(contenedor) {
  let dia = iso(new Date());
  await pintar();

  async function pintar() {
    contenedor.innerHTML = `<p class="cargando">Un momento…</p>`;

    let h;
    try { h = await hojaDelDia(dia); }
    catch { contenedor.innerHTML = `<div class="error">No hemos podido cargarla.</div>`; return; }

    const fecha = new Date(dia + "T00:00:00")
      .toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    /* Los que necesitan algo hoy, arriba del todo: si hay que
       pinchar a alguien, eso no puede quedar enterrado en la
       tercera línea de su párrafo. */
    const conCuidados = h.dentro.filter(p => p.curas || p.en_celo || p.peligrosidad);

    const movimiento = (lista, cual) => lista.length
      ? lista.map(x => `<strong>${esc(x.quienes)}</strong> ${esc(x.hora)}`).join(" · ")
      : `<span class="flojo">Nadie ${cual}</span>`;

    contenedor.innerHTML = `
      <div class="cabecera-seccion no-imprimir">
        <h2>La hoja del día</h2>
        <div class="mando-cuadro">
          <input type="date" id="dia" value="${dia}">
          <button class="boton pequeno" id="imprimir">Imprimir</button>
        </div>
      </div>

      <div class="hoja">
        <div class="hoja-cabeza">
          <div>
            <h1>Hoja del día</h1>
            <p>${fecha} · ${h.dentro.length} ${h.dentro.length === 1 ? "perro dentro" : "perros dentro"}</p>
          </div>
          <div class="hoja-marca">
            <p class="rotulo">AmigoMío</p>
            <p>Mañana ___:___ · Tarde ___:___</p>
          </div>
        </div>

        <div class="hoja-movimientos">
          <div><p class="rotulo">Entran hoy</p><p>${movimiento(h.entran, "entra")}</p></div>
          <div><p class="rotulo">Se van hoy</p><p>${movimiento(h.salen, "se va")}</p></div>
        </div>

        ${conCuidados.length ? `
          <div class="hoja-ojo">
            <p class="rotulo">Hoy, ojo con</p>
            <p>${conCuidados.map(p => {
              const q = [];
              if (p.curas) q.push("curas");
              if (p.en_celo) q.push("en celo");
              if (p.peligrosidad) q.push("manejo aparte");
              return `<strong>${esc(p.perro)}</strong> (${q.join(", ")})`;
            }).join(" · ")}</p>
          </div>` : ""}

        <p class="rotulo separa">Los que están dentro</p>

        ${h.dentro.length === 0
          ? `<p class="flojo">Hoy no hay nadie.</p>`
          : h.dentro.map(p => `
            <div class="hoja-perro ${p.peligrosidad ? "ojo" : ""}">
              <div class="hoja-box">${esc(p.alojamiento)}</div>
              <div class="hoja-datos">
                <div class="hoja-nombre">
                  <strong>${esc(p.perro)}</strong>
                  ${p.peligrosidad ? `<span class="marca roja">manejo de peligrosidad</span>` : ""}
                  ${p.curas ? `<span class="marca roja">curas o inyectables</span>` : ""}
                  ${p.en_celo ? `<span class="marca roja">EN CELO</span>` : ""}
                  ${p.se_le_espera_celo && !p.en_celo ? `<span class="marca">se le espera el celo</span>` : ""}
                  ${(p.marcas || []).map(m => `<span class="marca">${esc(m)}</span>`).join("")}
                  ${p.peso ? `<span class="marca">${esc(p.peso)} kg</span>` : ""}
                </div>

                ${p.curas ? `<p class="cuidado-fuerte"><b>Curas o inyectables hoy.</b>
                   Anotar producto, dosis, vía y hora en el libro de tratamientos.</p>` : ""}

                ${p.en_celo ? `<p class="cuidado-fuerte"><b>Está en celo.</b>
                   No sale al patio con machos ni coincide con ellos en el pasillo.</p>` : ""}

                ${p.come ? `<p><b>Come:</b> ${esc(p.come)}</p>` : ""}
                ${p.cuidados ? `<p><b>Cuidados:</b> ${esc(p.cuidados)}</p>` : ""}
                ${p.esta_vez ? `<p><b>Esta vez además:</b> ${esc(p.esta_vez)}</p>` : ""}
                ${p.peligrosidad ? `<p class="ojo-texto"><b>Siempre solo.</b> No coincide con nadie,
                   ni separado por valla. Lo maneja Santi o Elena.</p>` : ""}
              </div>
              <div class="hoja-casillas"><i></i><i></i><i></i></div>
            </div>`).join("")}

        <div class="hoja-pie">
          <p>Las tres casillas son los tres paseos. Marca al hacerlos.</p>
          <p>Firma: ______________________</p>
        </div>
      </div>`;

    contenedor.querySelector("#dia").addEventListener("change", e => { dia = e.target.value; pintar(); });
    contenedor.querySelector("#imprimir").addEventListener("click", () => window.print());
  }
}
