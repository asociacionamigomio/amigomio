/* ============================================================
   Quién quiere educación o deporte.

   Lo que llega por «Educación y deporte». No son reservas: son
   conversaciones que empiezan, y la mayoría se resuelven con
   una llamada o un WhatsApp.

   Por eso el botón de escribirle está AQUÍ y no en otra
   pantalla: si hay que ir a buscar el teléfono a la ficha del
   cliente, la solicitud se queda sin contestar.
   ============================================================ */
import { intereses, atenderInteres } from "../datos.js";
import { enlaceWhatsAppA } from "../contacto.js";

const esc = t => String(t ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const cuando = iso => new Date(iso).toLocaleDateString("es-ES",
  { day: "numeric", month: "long" });

const QUE_ES = {
  deporte:   { texto: "Deporte · quiere ver un entrenamiento", clase: "azul" },
  educacion: { texto: "Educación canina",                      clase: "verde" },
};

const ESTADOS = [
  { id: "hablada",    texto: "Ya he hablado con él" },
  { id: "apuntado",   texto: "Se ha apuntado" },
  { id: "descartada", texto: "No sigue adelante" },
];

export async function render(contenedor) {
  let verTodo = false;

  await pintar();

  async function pintar(aviso = "", clase = "aviso") {
    contenedor.innerHTML = `<p class="cargando">Un momento…</p>`;
    const todos = await intereses();

    const nuevas = todos.filter(i => i.estado === "nueva");
    const enCurso = todos.filter(i => i.estado === "hablada");
    const cerradas = todos.filter(i => ["apuntado", "descartada"].includes(i.estado));

    contenedor.innerHTML = `
      <h2>Educación y deporte</h2>
      <p class="flojo">Quién ha dicho que le interesa. La mayoría se resuelven con
         una llamada.</p>

      ${aviso ? `<div class="${clase}">${esc(aviso)}</div>` : ""}

      ${nuevas.length ? `
        <h4>Sin contestar todavía (${nuevas.length})</h4>
        ${nuevas.map(fila).join("")}` : `
        <div class="tarjeta vacio"><p>Nada pendiente. Todo contestado.</p></div>`}

      ${enCurso.length ? `
        <h4>Hablado, pendiente de decidir</h4>
        ${enCurso.map(fila).join("")}` : ""}

      ${cerradas.length ? `
        <details style="margin-top:1rem">
          <summary class="flojo">${cerradas.length} cerradas</summary>
          ${cerradas.map(fila).join("")}
        </details>` : ""}`;

    contenedor.querySelectorAll("[data-estado]").forEach(b =>
      b.addEventListener("click", async () => {
        const [id, estado] = b.dataset.estado.split(":");
        const nota = contenedor.querySelector(`#nota-${id}`)?.value.trim() || "";
        b.disabled = true;
        const r = await atenderInteres(id, estado, nota);
        await pintar(r.mensaje, r.ok ? "aviso" : "error");
      }));
  }

  function fila(i) {
    const quien = `${i.cliente?.nombre ?? ""} ${i.cliente?.apellidos ?? ""}`.trim();
    const que = QUE_ES[i.tipo] || { texto: i.tipo, clase: "" };
    const url = enlaceWhatsAppA(i.cliente?.telefono,
      i.tipo === "deporte"
        ? `Hola${i.cliente?.nombre ? " " + i.cliente.nombre : ""}, soy de AmigoMío. ` +
          `Me dices que te gustaría ver un entrenamiento del grupo de trabajo. `
        : `Hola${i.cliente?.nombre ? " " + i.cliente.nombre : ""}, soy de AmigoMío. ` +
          `Me dices que te interesa lo de educación canina. `);

    const cerrada = ["apuntado", "descartada"].includes(i.estado);

    return `
      <div class="tarjeta interes ${i.estado}">
        <div class="fila-cliente">
          <div>
            <h3>${esc(quien) || "Alguien sin nombre todavía"}</h3>
            <p class="flojo">${esc(i.cliente?.telefono) || "sin teléfono"}
               · lo pidió el ${cuando(i.creada)}</p>
            ${i.perro ? `<p class="flojo">Por ${esc(i.perro.nombre)}${
              i.perro.raza ? ` · ${esc(i.perro.raza)}` : ""}</p>` : ""}
          </div>
          <span class="etiqueta ${que.clase}">${esc(que.texto)}</span>
        </div>

        ${i.mensaje ? `<p class="dice">«${esc(i.mensaje)}»</p>` : ""}
        ${i.nota ? `<p class="flojo">Tu nota: ${esc(i.nota)}</p>` : ""}

        ${cerrada ? "" : `
          <div class="botonera" style="margin-top:.6rem">
            ${url ? `<a class="boton whatsapp pequeno" target="_blank" rel="noopener"
                        href="${url}">Escribirle</a>`
                  : `<span class="flojo">Sin teléfono en su ficha</span>`}
          </div>

          <input id="nota-${i.id}" placeholder="Apunta lo que habléis"
                 value="${esc(i.nota)}" style="margin-top:.5rem">

          <div class="botonera" style="margin-top:.5rem">
            ${ESTADOS.map(e => `
              <button class="boton fantasma pequeno" data-estado="${i.id}:${e.id}">
                ${e.texto}
              </button>`).join("")}
          </div>`}
      </div>`;
  }
}
