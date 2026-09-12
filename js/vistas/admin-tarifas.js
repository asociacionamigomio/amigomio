/* ============================================================
   Tarifas, festivos, extras y ajustes.

   Esta pantalla existe para que Santiago cambie precios sin
   llamar a nadie. Si algún día hay que publicar una versión
   nueva de la web para subir la noche 2 €, esta pantalla ha
   fracasado.
   ============================================================ */
import { tarifas, guardarTarifa, festivos, anadirFestivo, quitarFestivo,
         extras, guardarExtra, ajustes, guardarAjuste,
         promociones, guardarPromocion, borrarPromocion,
         caducarReservas } from "../datos.js";

const esc = t => String(t ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const dia = iso => new Date(iso + "T00:00:00")
  .toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

const PESTANAS = [
  { id: "precios",  texto: "Precios" },
  { id: "festivos", texto: "Festivos" },
  { id: "extras",   texto: "Extras" },
  { id: "promos",   texto: "Promociones" },
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

    await ({ precios: verPrecios, festivos: verFestivos, extras: verExtras,
             promos: verPromociones, ajustes: verAjustes })[donde]();
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
  /* ----------------------------------------------------------
     Promociones: un descuento para todos, entre dos fechas.

     No se acumulan con el del cliente fijo ni con el de estancia
     larga: de los tres se queda el mayor. Se dice aquí porque si
     no, se pone un 20 % creyendo que se suma al 10 % del
     habitual y no es así.
     ---------------------------------------------------------- */
  async function verPromociones() {
    const lista = await promociones();
    const hoy = new Date().toISOString().slice(0, 10);

    const fila = p => {
      const viva = p.activa && p.desde <= hoy && p.hasta >= hoy;
      const pasada = p.hasta < hoy;
      return `
        <div class="promo ${viva ? "viva" : ""} ${pasada ? "pasada" : ""}">
          <div>
            <strong>${esc(p.nombre)}</strong>
            <span class="etiqueta ${viva ? "verde" : ""}">−${esc(p.pct)} %</span>
            ${viva ? `<span class="flojo">· aplicándose ahora</span>`
                   : pasada ? `<span class="flojo">· ya pasó</span>`
                   : `<span class="flojo">· todavía no empieza</span>`}
            <p class="flojo">Del ${dia(p.desde)} al ${dia(p.hasta)}</p>
          </div>
          <div class="promo-botones">
            <button class="boton fantasma pequeno" data-promo-activa="${p.id}:${p.activa ? "no" : "si"}">
              ${p.activa ? "Apagar" : "Encender"}
            </button>
            <button class="enlace quitar" data-promo-fuera="${p.id}">Quitar</button>
          </div>
        </div>`;
    };

    panel().innerHTML = `
      <div class="tarjeta">
        <h3>Promociones</h3>
        <p class="flojo">Un descuento para todo el mundo, entre dos fechas. Cuenta
           el día de <strong>entrada</strong>. <strong>No se suman</strong>: si el
           cliente ya tiene su descuento fijo o le toca el de estancia larga, se le
           aplica el mayor de los tres, no los tres.</p>
        <div class="lista-promos">
          ${lista.length ? lista.map(fila).join("")
            : `<p class="flojo">Todavía no hay ninguna.</p>`}
        </div>
      </div>

      <div class="tarjeta" style="margin-top:1rem">
        <h3>Una nueva</h3>
        <label for="p-nombre">Cómo se llama</label>
        <input id="p-nombre" placeholder="Octubre tranquilo">
        <p class="flojo">Esto lo ve el cliente en su presupuesto.</p>

        <div class="fechas">
          <div><label for="p-desde">Desde</label>
            <input type="date" id="p-desde" value="${hoy}"></div>
          <div><label for="p-hasta">Hasta</label>
            <input type="date" id="p-hasta" value="${hoy}"></div>
        </div>

        <label class="mini">Descuenta
          <input type="number" min="1" max="100" class="dias" id="p-pct" value="10"> %</label>

        <button class="boton" id="p-crear" style="margin-top:.8rem">Crear promoción</button>
      </div>`;

    panel().querySelector("#p-crear").addEventListener("click", async () => {
      const r = await guardarPromocion({
        nombre: panel().querySelector("#p-nombre").value.trim(),
        pct:    panel().querySelector("#p-pct").value,
        desde:  panel().querySelector("#p-desde").value,
        hasta:  panel().querySelector("#p-hasta").value,
      });
      pintar(r.mensaje, r.ok ? "aviso" : "error");
    });

    panel().querySelectorAll("[data-promo-activa]").forEach(b =>
      b.addEventListener("click", async () => {
        const [id, valor] = b.dataset.promoActiva.split(":");
        const p = lista.find(x => String(x.id) === id);
        const r = await guardarPromocion({ ...p, activa: valor === "si" });
        pintar(r.mensaje, r.ok ? "aviso" : "error");
      }));

    panel().querySelectorAll("[data-promo-fuera]").forEach(b =>
      b.addEventListener("click", async () => {
        const r = await borrarPromocion(b.dataset.promoFuera);
        pintar(r.mensaje, r.ok ? "aviso" : "error");
      }));
  }

  async function verAjustes() {
    const lista = await ajustes();
    panel().innerHTML = `
      <div class="tarjeta">
        ${lista.map(a => `
          <label for="a-${a.clave}">${esc(etiqueta(a.clave))}</label>
          <input id="a-${a.clave}" value="${esc(a.valor)}" data-ajuste="${a.clave}"
                 ${a.clave === "iban" ? 'placeholder="ESxx xxxx xxxx xxxx xxxx xxxx"' : ""}>
          <p class="flojo">${esc(a.nota)}</p>`).join("")}
      </div>

      <div class="tarjeta" style="margin-top:1rem">
        <h3>El reloj de las 24 horas</h3>
        <p class="flojo">Cada diez minutos el servidor suelta las reservas que no
           han mandado el justificante a tiempo. Si te falla y ves alojamientos
           ocupados por reservas que nadie pagó, púlsalo aquí.</p>
        <button class="boton fantasma pequeno" id="pasar-reloj">Pasar el reloj ahora</button>
      </div>`;

    panel().querySelector("#pasar-reloj").addEventListener("click", async e => {
      e.target.disabled = true;
      const r = await caducarReservas();
      pintar(r.mensaje, r.ok ? "aviso" : "error");
    });

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
