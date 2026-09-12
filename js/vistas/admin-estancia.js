/* ============================================================
   La ficha de una estancia.

   Sale al pinchar un perro en el cuadro: cuándo llegó, cuándo
   se va, quién puede recogerlo y qué ha pasado estos días.
   ============================================================ */
import { unaEstancia, incidenciasDe, anotarIncidencia, cambiarEstado, cuadrante,
         moverDeAlojamiento } from "../datos.js";

const esc = t => String(t ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const euros = n => Number(n).toLocaleString("es-ES",
  { style: "currency", currency: "EUR", minimumFractionDigits: 0 });

const cuando = iso => new Date(iso).toLocaleString("es-ES",
  { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const ROTULOS = {
  pendiente: "Falta el justificante", confirmada: "Confirmada",
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
          <span class="etiqueta ${r.estado === "pendiente" ? "" : "azul"}">${ROTULOS[r.estado] || r.estado}</span>
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

      ${perros.map(p => `
        <div class="tarjeta" style="margin-top:1rem">
          <h3>${esc(p.nombre)} <span class="flojo">· chip ${esc(p.chip)}</span></h3>
          ${p.agresivo_con_personas ? `<div class="error" style="margin:.6rem 0">
            <strong>Manejo de peligrosidad.</strong> Alojamiento propio y siempre solo.</div>` : ""}
          ${p.pautas_alimentacion ? `<p><b>Come:</b> ${esc(p.pautas_alimentacion)}</p>` : ""}
          ${p.cuidados ? `<p><b>Cuidados:</b> ${esc(p.cuidados)}</p>` : ""}
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
