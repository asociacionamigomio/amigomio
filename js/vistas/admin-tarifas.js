/* ============================================================
   Tarifas, festivos, extras y ajustes.

   Esta pantalla existe para que Santiago cambie precios sin
   llamar a nadie. Si algún día hay que publicar una versión
   nueva de la web para subir la noche 2 €, esta pantalla ha
   fracasado.
   ============================================================ */
import { tarifas, guardarTarifa, festivos, anadirFestivo, quitarFestivo,
         extras, guardarExtra, ajustes, guardarAjuste } from "../datos.js";

const esc = t => String(t ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const dia = iso => new Date(iso + "T00:00:00")
  .toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

const PESTANAS = [
  { id: "precios",  texto: "Precios" },
  { id: "festivos", texto: "Festivos" },
  { id: "extras",   texto: "Extras" },
  { id: "ajustes",  texto: "Ajustes" },
];

export async function render(contenedor) {
  let donde = "precios";
  let anio = new Date().getFullYear();

  /* Declarado ANTES de llamar a pintar(): con `const`, usarlo antes
     de esta línea revienta con «Cannot access before initialization».
     Las funciones declaradas con `function` sí se pueden usar antes;
     las flechas asignadas a const, no. */
  const panel = () => contenedor.querySelector("#panel");

  await pintar();

  async function pintar(aviso = "", clase = "aviso") {
    contenedor.innerHTML = `
      <h2>Tarifas y ajustes</h2>
      ${aviso ? `<div class="${clase}">${esc(aviso)}</div>` : ""}
      <div class="subpestanas">
        ${PESTANAS.map(p => `<button class="pestana ${p.id === donde ? "activa" : ""}"
           data-sub="${p.id}">${p.texto}</button>`).join("")}
      </div>
      <div id="panel"><p class="cargando">Un momento…</p></div>`;

    contenedor.querySelectorAll("[data-sub]").forEach(b =>
      b.addEventListener("click", () => { donde = b.dataset.sub; pintar(); }));

    await ({ precios: verPrecios, festivos: verFestivos,
             extras: verExtras, ajustes: verAjustes })[donde]();
  }

  /* ---------------------------------------------------------- */
  async function verPrecios() {
    const lista = await tarifas();
    panel().innerHTML = `
      <div class="tarjeta">
        <p class="flojo">Cambia un importe y pulsa fuera. Se aplica a las reservas
           <strong>nuevas</strong>: las ya confirmadas mantienen lo pactado.</p>
        <div class="tabla-tarifas">
          ${lista.map(t => `
            <div class="fila-tarifa">
              <div>
                <strong>${esc(etiqueta(t.clave))}</strong>
                <p class="flojo">${esc(t.nota)}</p>
              </div>
              <div class="importe">
                <input type="number" step="0.01" value="${t.importe}" data-tarifa="${t.id}">
                <span>${t.clave === "minimo_noches" ? "noches" : "€"}</span>
              </div>
            </div>`).join("")}
        </div>
      </div>`;

    panel().querySelectorAll("[data-tarifa]").forEach(i =>
      i.addEventListener("change", async () => {
        const r = await guardarTarifa(i.dataset.tarifa, i.value);
        pintar(r.mensaje, r.ok ? "aviso" : "error");
      }));
  }

  /* ---------------------------------------------------------- */
  async function verFestivos() {
    const lista = await festivos(anio);
    const siguiente = await festivos(anio + 1);

    panel().innerHTML = `
      ${siguiente.length === 0 && new Date().getMonth() >= 9 ? `
        <div class="aviso">
          <strong>No has cargado los festivos de ${anio + 1}.</strong>
          Sin ellos, el motor cobrará 15 € noches que deberían ser 18 €.
        </div>` : ""}

      <div class="tarjeta">
        <div class="cabecera-seccion">
          <h3>Festivos de ${anio}</h3>
          <div>
            <button class="boton fantasma pequeno" data-anio="${anio - 1}">← ${anio - 1}</button>
            <button class="boton fantasma pequeno" data-anio="${anio + 1}">${anio + 1} →</button>
          </div>
        </div>
        <p class="flojo">Los festivos <strong>y sus vísperas</strong> se cobran a tarifa de
           fin de semana. Nacionales, de Andalucía y locales de Puerto Real.</p>

        ${lista.length === 0
          ? `<p class="flojo">Todavía no hay ninguno de ${anio}.</p>`
          : `<div class="lista-festivos">${lista.map(f => `
              <div class="fila-festivo">
                <div><strong>${dia(f.fecha)}</strong>
                  <p class="flojo">${esc(f.nombre) || "sin nombre"} · ${f.ambito}</p></div>
                <button class="enlace" data-quitar="${f.fecha}">Quitar</button>
              </div>`).join("")}</div>`}

        <h4>Añadir uno</h4>
        <div class="anadir-festivo">
          <input type="date" id="f-fecha" value="${anio}-01-01">
          <input id="f-nombre" placeholder="Cómo se llama">
          <select id="f-ambito">
            <option value="local">Local de Puerto Real</option>
            <option value="andalucia">De Andalucía</option>
            <option value="nacional">Nacional</option>
          </select>
          <button class="boton pequeno" id="f-anadir">Añadir</button>
        </div>
      </div>`;

    panel().querySelectorAll("[data-anio]").forEach(b =>
      b.addEventListener("click", () => { anio = Number(b.dataset.anio); pintar(); }));

    panel().querySelectorAll("[data-quitar]").forEach(b =>
      b.addEventListener("click", async () => {
        await quitarFestivo(b.dataset.quitar);
        pintar("Quitado.");
      }));

    panel().querySelector("#f-anadir").addEventListener("click", async () => {
      const r = await anadirFestivo({
        fecha:  panel().querySelector("#f-fecha").value,
        nombre: panel().querySelector("#f-nombre").value.trim(),
        ambito: panel().querySelector("#f-ambito").value,
      });
      pintar(r.mensaje, r.ok ? "aviso" : "error");
    });
  }

  /* ---------------------------------------------------------- */
  async function verExtras() {
    const lista = await extras();
    const mios  = lista.filter(e => e.lo_cobra === "amigomio");
    const suyos = lista.filter(e => e.lo_cobra === "veterinaria");

    const fila = e => `
      <div class="fila-tarifa">
        <div>
          <strong>${esc(e.nombre)}</strong>
          <p class="flojo">${esc(e.nota)}${e.en_verano ? "" : " · no disponible en verano"}</p>
        </div>
        <div class="importe">
          <input type="number" step="0.01" value="${e.importe}" data-extra="${e.id}">
          <span>€ ${e.por_noche ? "/noche" : ""}</span>
        </div>
      </div>`;

    panel().innerHTML = `
      <div class="tarjeta">
        <h3>Los que cobras tú</h3>
        <p class="flojo">A 0 € no se le enseñan al cliente todavía.</p>
        <div class="tabla-tarifas">${mios.map(fila).join("")}</div>
      </div>
      <div class="tarjeta" style="margin-top:1rem">
        <h3>Los que factura la clínica</h3>
        <p class="flojo">Estos <strong>no</strong> entran en el importe que el cliente
           te transfiere. Se le muestran aparte, como orientación.</p>
        <div class="tabla-tarifas">${suyos.map(fila).join("")}</div>
      </div>`;

    panel().querySelectorAll("[data-extra]").forEach(i =>
      i.addEventListener("change", async () => {
        const r = await guardarExtra(i.dataset.extra, { importe: i.value });
        pintar(r.mensaje, r.ok ? "aviso" : "error");
      }));
  }

  /* ---------------------------------------------------------- */
  async function verAjustes() {
    const lista = await ajustes();
    panel().innerHTML = `
      <div class="tarjeta">
        ${lista.map(a => `
          <label for="a-${a.clave}">${esc(etiqueta(a.clave))}</label>
          <input id="a-${a.clave}" value="${esc(a.valor)}" data-ajuste="${a.clave}"
                 ${a.clave === "iban" ? 'placeholder="ESxx xxxx xxxx xxxx xxxx xxxx"' : ""}>
          <p class="flojo">${esc(a.nota)}</p>`).join("")}
      </div>`;

    panel().querySelectorAll("[data-ajuste]").forEach(i =>
      i.addEventListener("change", async () => {
        const r = await guardarAjuste(i.dataset.ajuste, i.value.trim());
        pintar(r.mensaje, r.ok ? "aviso" : "error");
      }));
  }
}

function etiqueta(clave) {
  return {
    base_entre_semana:    "Noche de lunes a jueves",
    base_finde:           "Noche de viernes, sábado o domingo",
    base_festivo:         "Noche de festivo o víspera",
    base_navidad:         "Nochebuena, Navidad, Nochevieja y Año Nuevo",
    especial_dia:         "Alojamiento especial (tarifa plana)",
    perro_adicional:      "Cada perro de más en el mismo alojamiento, por noche",
    curas_dia:            "Curas o inyectables, por perro y noche",
    fuera_horario_semana: "Fuera de horario, entre semana",
    fuera_horario_finde:  "Fuera de horario, sábado o domingo",
    fuera_horario_noche:  "Fuera de horario, de 21:00 a 7:30",
    minimo_noches:        "Reserva mínima",
    tope_perros_simultaneos: "Tope de perros a la vez",
    reservas_abiertas:    "¿Reservas abiertas al público?",
    iban:                 "IBAN donde se transfiere",
    dias_cancelacion_gratis: "Días de antelación para cancelar sin coste",
  }[clave] || clave;
}
