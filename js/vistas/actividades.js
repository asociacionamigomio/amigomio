/* ============================================================
   Educación y deporte.

   Dos cosas distintas y el cliente pide cosas distintas en cada
   una:

   - DEPORTE: quiere venir a VER. Nadie se apunta a IGP sin
     haber visto un entrenamiento — es una decisión que se toma
     de pie en el campo, no leyendo una pantalla. Por eso el
     botón dice «quiero ver un entrenamiento» y no «apuntarme».
   - EDUCACIÓN: quiere que le cuenten. Grupos, horarios, qué se
     hace.

   Y no se promete ningún plazo. «Te contestamos en 24 horas» es
   una promesa que se rompe el primer fin de semana con la
   residencia llena, y entonces ya no se cree nada más.
   ============================================================ */
import { misPerros, mostrarInteres, misIntereses, retirarInteres } from "../datos.js";

const esc = t => String(t ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const COMO_VA = {
  nueva:      "Lo tenemos apuntado",
  hablada:    "Hemos hablado contigo",
  apuntado:   "Ya estás dentro",
  descartada: "De momento lo dejamos",
};

export async function render(contenedor) {
  let perros = [];
  let pedidos = [];

  await pintar();

  async function pintar(aviso = "", clase = "aviso") {
    contenedor.innerHTML = `<p class="cargando">Un momento…</p>`;
    [perros, pedidos] = await Promise.all([misPerros(), misIntereses()]);

    const yaPedido = tipo => pedidos.find(p =>
      p.tipo === tipo && ["nueva", "hablada"].includes(p.estado));

    const elegirPerro = id => perros.length === 0 ? "" : `
      <label class="mini" for="perro-${id}">¿De qué perro hablamos?
        <select id="perro-${id}">
          <option value="">Todavía no lo sé</option>
          ${perros.filter(p => !p.borrador).map(p =>
            `<option value="${p.id}">${esc(p.nombre)}</option>`).join("")}
        </select>
      </label>`;

    const bloque = (tipo, titulo, texto, botonTexto, pista) => {
      const pedido = yaPedido(tipo);
      return `
      <div class="tarjeta actividad ${pedido ? "pedida" : ""}">
        <h3>${titulo}</h3>
        ${texto}

        ${pedido ? `
          <div class="aviso">
            <strong>${esc(COMO_VA[pedido.estado] || "")}.</strong>
            Te escribimos o te llamamos.
            <br><button class="enlace" data-retirar="${pedido.id}">Ya no me interesa</button>
          </div>` : `
          ${elegirPerro(tipo)}
          <label class="mini" for="msg-${tipo}">¿Quieres contarnos algo?
            <textarea id="msg-${tipo}" rows="2" placeholder="${esc(pista)}"></textarea>
          </label>
          <button class="boton" data-pedir="${tipo}">${botonTexto}</button>`}
      </div>`;
    };

    contenedor.innerHTML = `
      <h2>Educación y deporte</h2>
      <p class="flojo">AmigoMío no es sólo residencia. Si te apetece hacer algo más
         con tu perro, dínoslo y hablamos.</p>

      ${aviso ? `<div class="${clase}">${esc(aviso)}</div>` : ""}

      ${bloque("educacion", "Educación canina",
        `<p>Grupos para trabajar lo de todos los días: que venga cuando le llamas,
            que pasee sin tirar, que sepa estar en un bar, que no se coma lo que
            encuentra por la calle.</p>
         <p class="flojo">No hace falta que tu perro sea un problema para venir.
            La mayoría vienen porque quieren entenderse mejor con él.</p>`,
        "Quiero que me contéis",
        "Qué te gustaría mejorar, la edad que tiene…")}

      ${bloque("deporte", "Deporte con tu perro",
        `<p>El grupo de trabajo entrena aquí. Se hace obediencia, rastro y
            defensa deportiva — lo que se ve en las pruebas de IGP.</p>
         <p><strong>Antes de nada, vente a ver un entrenamiento.</strong>
            No hay que llevar al perro ni comprometerse a nada.</p>`,
        "Quiero ver un entrenamiento",
        "Si has hecho algo antes, qué raza tiene…")}

      <p class="flojo">Lo miramos y te decimos algo. Si tienes prisa,
         escríbenos por WhatsApp al 673 229 399.</p>`;

    contenedor.querySelectorAll("[data-pedir]").forEach(b =>
      b.addEventListener("click", async () => {
        const tipo = b.dataset.pedir;
        b.disabled = true;
        const r = await mostrarInteres(
          tipo,
          contenedor.querySelector(`#perro-${tipo}`)?.value || null,
          contenedor.querySelector(`#msg-${tipo}`)?.value.trim() || "");
        await pintar(r.mensaje, r.ok ? "aviso" : "error");
      }));

    contenedor.querySelectorAll("[data-retirar]").forEach(b =>
      b.addEventListener("click", async () => {
        const r = await retirarInteres(b.dataset.retirar);
        await pintar(r.mensaje, r.ok ? "aviso" : "error");
      }));
  }
}
