/* ============================================================
   La ficha de una estancia.

   Sale al pinchar un perro en el cuadro: cuándo llegó, cuándo
   se va, quién puede recogerlo y qué ha pasado estos días.
   ============================================================ */
import { unaEstancia, incidenciasDe, anotarIncidencia, cambiarEstado, cuadrante,
         moverDeAlojamiento, documentosDe, verDocumento,
         verJustificante, validarJustificante, rechazarJustificante } from "../datos.js";
import { tipoDocumento } from "../documentos.js";

const esc = t => String(t ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const euros = n => Number(n).toLocaleString("es-ES",
  { style: "currency", currency: "EUR", minimumFractionDigits: 0 });

const cuando = iso => new Date(iso).toLocaleString("es-ES",
  { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const ROTULOS = {
  pendiente: "Falta el justificante", revisando: "Justificante por revisar",
  confirmada: "Confirmada",
  en_curso: "Está dentro", finalizada: "Terminada",
  cancelada: "Cancelada", caducada: "Caducó sin pagar",
};

export async function render(contenedor, { reservaId } = {}) {
  const id = reservaId || window.__estancia;
  if (!id) { contenedor.innerHTML = `<div class="aviso">Pincha una reserva en el cuadrante.</div>`; return; }

  await pintar();

  async function pintar(aviso = "", clase = "aviso") {
    contenedor.innerHTML = `<p class="cargando">Un momento…</p>`;

    const r = await unaEstancia(id);
    if (!r) { contenedor.innerHTML = `<div class="error">No encontramos esa reserva.</div>`; return; }

    const diario = await incidenciasDe(id);
    const perros = (r.reserva_perro || []).map(x => x.perro).filter(Boolean);
    const noches = Math.round((new Date(r.salida) - new Date(r.entrada)) / 86400000);
    const dentro = r.estado === "en_curso";
    const nocheActual = dentro
      ? Math.max(1, Math.ceil((Date.now() - new Date(r.entrada)) / 86400000)) : null;

    contenedor.innerHTML = `
      <div class="cabecera-seccion">
        <button class="boton fantasma pequeno" data-ir="cuadrante">← Al cuadrante</button>
      </div>

      <div class="estancia-cabeza">
        <div>
          <h2>${esc(perros.map(p => p.nombre).join(" y ")) || "Estancia"}</h2>
          <p>${perros.map(p => esc(p.raza) || "sin raza").join(" · ")}</p>
        </div>
        <div class="estancia-estado">
          <span class="etiqueta ${["pendiente","revisando"].includes(r.estado) ? "" : "azul"}">${ROTULOS[r.estado] || r.estado}</span>
          <p>${esc(r.alojamiento?.nombre || "")}${dentro ? ` · noche ${nocheActual} de ${noches}` : ""}</p>
        </div>
      </div>

      <div class="estancia-datos">
        <div><p class="rotulo">Llegó</p><p class="dato">${cuando(r.entrada)}</p></div>
        <div><p class="rotulo">Se va</p><p class="dato">${cuando(r.salida)}</p></div>
        <div><p class="rotulo">La recoge</p>
          <p class="dato">${esc(r.cliente?.recoge_nombre) || "Solo el propietario"}</p>
          ${r.cliente?.recoge_dni ? `<p class="flojo">DNI ${esc(r.cliente.recoge_dni)} · pedirlo</p>` : ""}</div>
        <div><p class="rotulo">Estancia</p><p class="dato">${euros(r.total)}</p>
          <p class="flojo">${esc(r.cliente?.telefono) || "sin teléfono"}</p></div>
      </div>

      ${["pendiente","revisando"].includes(r.estado) ? bloqueJustificante(r) : ""}

      ${perros.map(p => `
        <div class="tarjeta" style="margin-top:1rem">
          <h3>${esc(p.nombre)} <span class="flojo">· chip ${esc(p.chip)}</span></h3>
          ${p.agresivo_con_personas ? `<div class="error" style="margin:.6rem 0">
            <strong>Manejo de peligrosidad.</strong> Alojamiento propio y siempre solo.</div>` : ""}
          ${p.pautas_alimentacion ? `<p><b>Come:</b> ${esc(p.pautas_alimentacion)}</p>` : ""}
          ${p.cuidados ? `<p><b>Cuidados:</b> ${esc(p.cuidados)}</p>` : ""}
          <div class="papeles-de" data-papeles="${p.id}"></div>
        </div>`).join("")}

      <div class="tarjeta" style="margin-top:1rem">
        <div class="cabecera-seccion">
          <h3>Lo que ha pasado</h3>
        </div>
        <div class="anotar">
          <input id="texto" placeholder="Come bien, tres paseos hechos…">
          <select id="tipo">
            <option value="nota">Nota</option>
            <option value="salud">Salud</option>
            <option value="comida">Comida</option>
            <option value="paseo">Paseo</option>
            <option value="rotura">Rotura</option>
          </select>
          <button class="boton pequeno" id="anotar">Anotar</button>
        </div>
        ${aviso ? `<div class="${clase}" style="margin-top:.6rem">${esc(aviso)}</div>` : ""}

        <div class="diario">
          ${diario.length === 0 ? `<p class="flojo">Todavía no hay nada anotado.</p>`
            : diario.map(i => `
              <div class="diario-linea">
                <span class="diario-cuando">${cuando(i.cuando)}</span>
                <p><span class="marca">${esc(i.tipo)}</span> ${esc(i.texto)}</p>
              </div>`).join("")}
        </div>
      </div>

      <div class="botonera" style="margin-top:1rem">
        ${r.estado === "confirmada" ? `<button class="boton" data-estado="en_curso">Ha llegado</button>` : ""}
        ${r.estado === "en_curso" ? `<button class="boton" data-estado="finalizada">Dar la salida</button>` : ""}
        <button class="boton fantasma" id="mover">Cambiar de alojamiento</button>
      </div>`;

    contenedor.querySelectorAll("[data-ir]").forEach(b =>
      b.addEventListener("click", () => window.irA?.(b.dataset.ir)));

    contenedor.querySelector("#anotar").addEventListener("click", async () => {
      const texto = contenedor.querySelector("#texto").value.trim();
      if (!texto) return pintar("Escribe algo antes.", "error");
      const res = await anotarIncidencia({
        reservaId: id, perroId: perros[0]?.id,
        tipo: contenedor.querySelector("#tipo").value, texto,
      });
      pintar(res.mensaje, res.ok ? "aviso" : "error");
    });

    contenedor.querySelectorAll("[data-estado]").forEach(b =>
      b.addEventListener("click", async () => {
        const res = await cambiarEstado(id, b.dataset.estado);
        pintar(res.mensaje, res.ok ? "aviso" : "error");
      }));

    contenedor.querySelector("#mover").addEventListener("click", () => elegirAlojamiento(r));

    papelesDeLosPerros();

    contenedor.querySelector("#ver-justificante")?.addEventListener("click", async b => {
      const url = await verJustificante(r.justificante);
      if (url) window.open(url, "_blank", "noopener");
      else pintar("No hemos podido abrirlo.", "error");
    });

    contenedor.querySelector("#validar")?.addEventListener("click", async () => {
      const res = await validarJustificante(id);
      pintar(res.mensaje, res.ok ? "aviso" : "error");
    });

    contenedor.querySelector("#rechazar")?.addEventListener("click", async () => {
      const motivo = contenedor.querySelector("#motivo")?.value.trim();
      if (!motivo)
        return pintar("Dile POR QUÉ no vale, o volverá a mandar la misma foto.", "error");
      const res = await rechazarJustificante(id, motivo);
      pintar(res.mensaje, res.ok ? "aviso" : "error");
    });
  }

  /* El papel de la transferencia.

     Que esté subido NO significa que el dinero haya llegado: una
     foto puede ser de cualquier cosa. Se mira la cuenta y se
     confirma aquí. Rechazarlo no mata la reserva: le da otras 24
     horas, porque perder un cliente por una foto movida es
     perderlo por nada. */
  function bloqueJustificante(r) {
    if (r.estado === "pendiente") {
      const quedan = r.expira
        ? Math.round((new Date(r.expira) - Date.now()) / 3600000) : null;
      return `
        <div class="tarjeta justificante" style="margin-top:1rem">
          <p class="rotulo">El pago</p>
          <p>Todavía no ha mandado el justificante.
             ${quedan !== null ? (quedan > 0
               ? `<strong>Le quedan ${quedan} hora${quedan === 1 ? "" : "s"}</strong>
                  y el sitio se suelta solo.`
               : `<strong>Se le pasó el plazo</strong>: el reloj la soltará en cuanto pase.`)
               : ""}</p>
          ${r.justificante_nota ? `<p class="flojo">Le rechazamos el anterior:
             «${esc(r.justificante_nota)}»</p>` : ""}
          <button class="boton pequeno" id="validar">Ya ha pagado, confirmar</button>
          <p class="flojo">Úsalo si te lo ha pagado por otro camino o lo has visto en la cuenta.</p>
        </div>`;
    }

    return `
      <div class="tarjeta justificante mirar" style="margin-top:1rem">
        <p class="rotulo">El pago</p>
        <p>Mandó el justificante${r.justificante_subido
          ? ` el ${cuando(r.justificante_subido)}` : ""}.
          <strong>Míralo en la cuenta antes de confirmar</strong>: la foto no es el dinero.</p>

        <div class="botonera" style="margin-top:.6rem">
          <button class="boton fantasma pequeno" id="ver-justificante">Ver el justificante</button>
          <button class="boton pequeno" id="validar">He visto el dinero, confirmar</button>
        </div>

        <div class="rechazo">
          <input id="motivo" placeholder="Si no vale, por qué (lo lee el cliente)">
          <button class="enlace quitar" id="rechazar">No vale</button>
        </div>
        <p class="flojo">Rechazarlo no cancela la reserva: le da otras 24 horas
           para mandar otro.</p>
      </div>`;
  }

  /* La cartilla que haya subido el cliente. Se pide DESPUÉS de
     pintar: son varias consultas y no vale la pena hacer esperar
     la ficha entera por ellas. Si no hay nada subido, no aparece
     ni el rótulo. */
  async function papelesDeLosPerros() {
    for (const caja of contenedor.querySelectorAll("[data-papeles]")) {
      const papeles = await documentosDe(caja.dataset.papeles);
      if (!papeles.length) continue;

      caja.innerHTML = `<p class="rotulo" style="margin-top:.6rem">Cartilla</p>
        <div class="papel-subidos">
          ${papeles.map(x => `
            <button class="marca enlace" data-ver="${x.id}" data-ruta="${esc(x.ruta)}"
            >${esc(tipoDocumento(x.tipo)?.nombre || x.tipo)}</button>`).join("")}
        </div>`;

      caja.querySelectorAll("[data-ver]").forEach(b =>
        b.addEventListener("click", async () => {
          const url = await verDocumento(b.dataset.ruta);
          if (url) window.open(url, "_blank", "noopener");
        }));
    }
  }

  async function elegirAlojamiento(r) {
    const datos = await cuadrante(r.entrada.slice(0, 10), r.salida.slice(0, 10));
    const ocupados = new Set(datos.reservas.filter(x => x.id !== r.id).map(x => x.alojamiento));
    const libres = datos.alojamientos.filter(a => a.activo && !ocupados.has(a.id));

    contenedor.innerHTML = `
      <div class="cabecera-seccion">
        <h2>¿A dónde lo movemos?</h2>
        <button class="boton fantasma pequeno" id="volver">Volver</button>
      </div>
      <p class="flojo">Los que salen están libres todas las noches de esta estancia.
         Si intentas uno ocupado, la base de datos lo rechaza.</p>
      <div class="rejilla-alojamientos">
        ${libres.map(a => `
          <button class="aloj ${a.id === r.alojamiento_id ? "actual" : ""}" data-aloj="${a.id}">
            ${esc(a.nombre)}<span>${esc(a.tipo)}</span>
          </button>`).join("")}
      </div>`;

    contenedor.querySelector("#volver").addEventListener("click", () => pintar());
    contenedor.querySelectorAll("[data-aloj]").forEach(b =>
      b.addEventListener("click", async () => {
        const res = await moverDeAlojamiento(id, Number(b.dataset.aloj));
        pintar(res.mensaje, res.ok ? "aviso" : "error");
      }));
  }
}
