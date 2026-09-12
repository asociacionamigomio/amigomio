/* ============================================================
   Reservar.

   La pantalla NO calcula nada: pregunta al motor y enseña lo
   que responde. Si algún día el precio de aquí y el de la base
   de datos no coinciden, es que alguien ha hecho cuentas donde
   no debía.
   ============================================================ */
import { misPerros, presupuesto, haySitio, crearReserva, reservasAbiertas } from "../datos.js";
import { puedenCompartir } from "../perro.js";

const esc = t => String(t ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const euros = n => Number(n).toLocaleString("es-ES",
  { style: "currency", currency: "EUR", minimumFractionDigits: 0 });

/* Horario de AmigoMío. El motor cobra recargo fuera de estas
   franjas; aquí solo se ofrecen para que nadie lo pague sin
   querer. */
const HORAS = ["10:00", "11:00", "12:00", "16:30", "17:30", "18:30"];

export async function render(contenedor, { ficha } = {}) {
  contenedor.innerHTML = `<p class="cargando">Un momento…</p>`;

  const [perros, abiertas] = await Promise.all([misPerros(), reservasAbiertas()]);
  const disponibles = perros.filter(p => !p.borrador);

  const elegidos = new Set();
  let entrada = "", salida = "", horaEntrada = "11:00", horaSalida = "11:00";
  let cuentas = null, sitio = null, calculando = false;

  pintar();

  function pintar(aviso = "", clase = "aviso") {
    if (disponibles.length === 0) {
      contenedor.innerHTML = `
        <h2>Reservar</h2>
        <div class="tarjeta vacio">
          <p>Antes de reservar tenemos que conocer a tu perro.</p>
          <button class="boton" data-ir="perros">Dar de alta un perro</button>
        </div>`;
      enganchar();
      return;
    }

    contenedor.innerHTML = `
      <h2>Reservar</h2>

      ${!abiertas && ficha?.es_admin ? `
        <div class="aviso">Las reservas están cerradas al público. Tú puedes reservar
          porque eres administración.</div>` : ""}

      ${aviso ? `<div class="${clase}">${esc(aviso)}</div>` : ""}

      <div class="tarjeta">
        <h3>¿Quién viene?</h3>
        <p class="flojo">Si vienen varios, comparten alojamiento. Hasta tres.</p>
        <div class="lista-elegir">
          ${disponibles.map(p => `
            <label class="elegir ${elegidos.has(p.id) ? "puesto" : ""}">
              <input type="checkbox" data-perro="${p.id}" ${elegidos.has(p.id) ? "checked" : ""}>
              <span class="avatar">${p.foto ? `<img src="${esc(p.foto)}" alt="">` : "🐕"}</span>
              <span>
                <strong>${esc(p.nombre)}</strong>
                ${p.agresivo_con_personas
                  ? `<br><span class="flojo">alojamiento propio, siempre solo</span>` : ""}
              </span>
            </label>`).join("")}
        </div>
      </div>

      <div class="tarjeta">
        <h3>¿Qué días?</h3>
        <div class="fechas">
          <div>
            <label for="e">Lo dejas el</label>
            <input type="date" id="e" value="${entrada}" min="${hoy()}">
            <select id="he">${HORAS.map(h =>
              `<option ${h === horaEntrada ? "selected" : ""}>${h}</option>`).join("")}</select>
          </div>
          <div>
            <label for="s">Lo recoges el</label>
            <input type="date" id="s" value="${salida}" min="${entrada || hoy()}">
            <select id="hs">${HORAS.map(h =>
              `<option ${h === horaSalida ? "selected" : ""}>${h}</option>`).join("")}</select>
          </div>
        </div>
        <p class="flojo">Mínimo dos noches. Fuera de estos horarios hay recargo:
           llámanos y lo vemos.</p>
      </div>

      ${calculando ? `<p class="cargando">Mirando si hay sitio…</p>` : ""}
      ${sitio && !sitio.hay ? `<div class="error">${esc(sitio.motivo)}</div>` : ""}

      ${cuentas && sitio?.hay ? `
        <div class="tarjeta presupuesto">
          <h3>Esto es lo que costaría</h3>
          <div class="tabla-tarifas">
            ${cuentas.lineas.map(l => `
              <div class="fila-tarifa">
                <span>${esc(l.concepto)}</span>
                <strong>${euros(l.importe)}</strong>
              </div>`).join("")}
            <div class="fila-tarifa total">
              <span><strong>Total</strong></span>
              <strong>${euros(cuentas.total)}</strong>
            </div>
          </div>
          ${cuentas.aparte?.length ? `
            <p class="flojo">Aparte, y lo factura la clínica, no nosotros:
              ${cuentas.aparte.map(a => esc(a.concepto)).join(", ")}.</p>` : ""}
          <button class="boton" id="confirmar">Reservar por ${euros(cuentas.total)}</button>
          <p class="flojo">Después te diremos dónde transferir. Tienes 24 horas para
             mandarnos el justificante.</p>
        </div>` : ""}`;

    enganchar();
  }

  function enganchar() {
    contenedor.querySelectorAll("[data-ir]").forEach(b =>
      b.addEventListener("click", () => window.irA?.(b.dataset.ir)));

    contenedor.querySelectorAll("[data-perro]").forEach(i =>
      i.addEventListener("change", () => {
        const id = i.dataset.perro;
        if (i.checked) elegidos.add(id); else elegidos.delete(id);
        const problema = revisarCompañía();
        if (problema) { elegidos.delete(id); return pintar(problema, "error"); }
        recalcular();
      }));

    const cambia = (id, fn) => contenedor.querySelector(id)?.addEventListener("change", e => {
      fn(e.target.value); recalcular();
    });
    cambia("#e",  v => { entrada = v; if (salida && salida <= v) salida = ""; });
    cambia("#s",  v => salida = v);
    cambia("#he", v => horaEntrada = v);
    cambia("#hs", v => horaSalida = v);

    contenedor.querySelector("#confirmar")?.addEventListener("click", confirmar);
  }

  /* Aviso temprano, para no dejar que elija y luego le rebote el
     motor. La comprobación de verdad la hace crear_reserva. */
  function revisarCompañía() {
    const lista = [...elegidos].map(id => disponibles.find(p => p.id === id));
    if (lista.length > 3) return "En un alojamiento caben tres como mucho.";
    for (let i = 0; i < lista.length; i++)
      for (let j = i + 1; j < lista.length; j++) {
        const r = puedenCompartir(aFormaSimple(lista[i]), aFormaSimple(lista[j]));
        if (!r.si) return r.motivo;
      }
    return null;
  }

  const aFormaSimple = p => ({
    nombre: p.nombre, sexo: p.sexo, sociable: p.sociable,
    agresivoConPersonas: p.agresivo_con_personas,
  });

  async function recalcular() {
    cuentas = null; sitio = null;
    if (elegidos.size === 0 || !entrada || !salida) return pintar();

    calculando = true; pintar();

    const cuando = { entrada: `${entrada} ${horaEntrada}`, salida: `${salida} ${horaSalida}` };
    const hayAgresivo = [...elegidos]
      .some(id => disponibles.find(p => p.id === id)?.agresivo_con_personas);
    const tipo = hayAgresivo ? "especial" : "normal";

    sitio = await haySitio({ ...cuando, tipo, perros: elegidos.size });
    if (sitio.hay) {
      const r = await presupuesto({ ...cuando, tipo, perros: elegidos.size });
      cuentas = r.ok ? r : null;
      if (!r.ok) sitio = { hay: false, motivo: r.mensaje };
    }

    calculando = false; pintar();
  }

  async function confirmar() {
    const boton = contenedor.querySelector("#confirmar");
    boton.disabled = true;
    boton.textContent = "Un momento…";

    const r = await crearReserva({
      perros: [...elegidos],
      entrada: `${entrada} ${horaEntrada}`,
      salida: `${salida} ${horaSalida}`,
    });

    if (!r.ok) { boton.disabled = false; return pintar(r.mensaje, "error"); }

    elegidos.clear(); cuentas = null; sitio = null;
    pintar(r.estado === "confirmada"
      ? "¡Listo! Tu reserva está confirmada. Nos vemos."
      : "¡Hecho! Ya tienes el sitio guardado. Mira en «Mis reservas» dónde transferir: " +
        "tienes 24 horas.", "aviso");
  }
}

const hoy = () => new Date().toISOString().slice(0, 10);
