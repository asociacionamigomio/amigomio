/* ============================================================
   Lo que entra cada mes.

   Cuatro columnas y no una, porque un solo número no sería
   dinero:

     COBRADO      — estancias ya hechas. Esto es facturación.
     COMPROMETIDO — pagadas, pero todavía no han pasado.
     EN EL AIRE   — sin pagar. Puede que no lleguen a ser nada.
     PERDIDO      — caducadas y canceladas. Si esta columna
                    crece, algo falla antes del pago.

   El mes se cuenta por la ENTRADA, no por cuándo se reservó:
   una reserva de agosto hecha en febrero es facturación de
   agosto, que es cuando ocupa el box.
   ============================================================ */
import { ingresosPorMes } from "../datos.js";

const esc = t => String(t ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const euros = n => Number(n || 0).toLocaleString("es-ES",
  { style: "currency", currency: "EUR", minimumFractionDigits: 0 });

const nombreMes = iso => new Date(iso + "T00:00:00")
  .toLocaleDateString("es-ES", { month: "long", year: "numeric" });

export async function render(contenedor) {
  let anio = new Date().getFullYear();

  await pintar();

  async function pintar(aviso = "", clase = "aviso") {
    contenedor.innerHTML = `<p class="cargando">Echando cuentas…</p>`;

    const r = await ingresosPorMes(anio);
    if (!r.ok) { contenedor.innerHTML = `<div class="error">${esc(r.mensaje)}</div>`; return; }

    const meses = r.meses;
    const suma = campo => meses.reduce((t, m) => t + Number(m[campo] || 0), 0);
    const cobrado = suma("cobrado");
    const comprometido = suma("comprometido");
    const enElAire = suma("en_el_aire");
    const perdido = suma("perdido");
    const noches = meses.reduce((t, m) => t + Number(m.noches || 0), 0);

    /* La barra de cada mes se mide contra el mejor mes del año,
       no contra un número inventado: así se ve de un vistazo cuál
       es agosto y cuál es febrero. */
    const techo = Math.max(1, ...meses.map(m =>
      Number(m.cobrado) + Number(m.comprometido)));

    contenedor.innerHTML = `
      <div class="cabecera-seccion">
        <h2>Las cuentas de ${anio}</h2>
        <div class="botonera">
          <button class="boton fantasma pequeno" data-anio="${anio - 1}">← ${anio - 1}</button>
          <button class="boton fantasma pequeno" data-anio="${anio + 1}">${anio + 1} →</button>
        </div>
      </div>

      ${aviso ? `<div class="${clase}">${esc(aviso)}</div>` : ""}

      <div class="resumen-cuentas">
        <div class="cifra cobrado">
          <p class="rotulo">Cobrado</p>
          <p class="dato">${euros(cobrado)}</p>
          <p class="flojo">estancias ya hechas</p>
        </div>
        <div class="cifra comprometido">
          <p class="rotulo">Comprometido</p>
          <p class="dato">${euros(comprometido)}</p>
          <p class="flojo">pagadas, todavía por venir</p>
        </div>
        <div class="cifra aire">
          <p class="rotulo">En el aire</p>
          <p class="dato">${euros(enElAire)}</p>
          <p class="flojo">sin justificante todavía</p>
        </div>
        <div class="cifra perdido">
          <p class="rotulo">Se escapó</p>
          <p class="dato">${euros(perdido)}</p>
          <p class="flojo">caducadas y canceladas</p>
        </div>
      </div>

      <p class="flojo">${noches} noche${noches === 1 ? "" : "s"} vendidas en ${anio}.
         El mes cuenta por el día de <strong>entrada</strong>, que es cuando ocupa el box.</p>

      ${meses.length === 0 ? `
        <div class="tarjeta vacio"><p>En ${anio} no hay nada todavía.</p></div>` : `
        <div class="tarjeta">
          <div class="meses">
            ${meses.map(m => {
              const hecho = Number(m.cobrado);
              const porVenir = Number(m.comprometido);
              return `
              <div class="mes">
                <div class="mes-nombre">
                  <strong>${esc(nombreMes(m.mes))}</strong>
                  <span class="flojo">${m.estancias} estancia${m.estancias === 1 ? "" : "s"}
                    · ${m.noches} noche${m.noches === 1 ? "" : "s"}</span>
                </div>
                <div class="mes-barra">
                  <span class="trozo cobrado" style="width:${hecho / techo * 100}%"></span>
                  <span class="trozo comprometido" style="width:${porVenir / techo * 100}%"></span>
                </div>
                <div class="mes-cifra">
                  <strong>${euros(hecho + porVenir)}</strong>
                  ${Number(m.en_el_aire) > 0
                    ? `<span class="flojo">+${euros(m.en_el_aire)} en el aire</span>` : ""}
                </div>
              </div>`;
            }).join("")}
          </div>
        </div>`}`;

    contenedor.querySelectorAll("[data-anio]").forEach(b =>
      b.addEventListener("click", () => { anio = Number(b.dataset.anio); pintar(); }));
  }
}
