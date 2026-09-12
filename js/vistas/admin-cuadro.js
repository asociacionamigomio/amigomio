/* ============================================================
   El cuadrante.

   La pantalla que se mira cada mañana: los alojamientos en
   vertical, los días en horizontal, y abajo cuántos perros hay
   cada noche.

   Los alojamientos de aislamiento y cachorros salen separados:
   no se reservan, se asignan.
   ============================================================ */
import { cuadrante } from "../datos.js";

const esc = t => String(t ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const DIA = 86400000;
const iso = d => d.toISOString().slice(0, 10);
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

const COLOR = {
  pendiente:  { fondo: "var(--amarillo)", letra: "#5C4A06" },
  confirmada: { fondo: "var(--azul)",     letra: "#fff" },
  en_curso:   { fondo: "#2B4152",         letra: "#fff" },
};

export async function render(contenedor) {
  /* Arranca el lunes de esta semana: así se ve el finde entero,
     que es cuando se llena. */
  let lunes = new Date();
  lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
  lunes.setHours(0, 0, 0, 0);
  let cuantosDias = 7;
  let mes = false;          // vista de calendario

  await pintar();

  async function pintar(aviso = "") {
    if (mes) return pintarMes();
    contenedor.innerHTML = `<p class="cargando">Montando el cuadrante…</p>`;

    const desde = iso(lunes);
    const hasta = iso(new Date(+lunes + cuantosDias * DIA));

    let datos;
    try { datos = await cuadrante(desde, hasta); }
    catch (e) { contenedor.innerHTML = `<div class="error">No hemos podido cargarlo.</div>`; return; }

    const dias = [...Array(cuantosDias)].map((_, i) => new Date(+lunes + i * DIA));
    const reservables = datos.alojamientos.filter(a => ["normal", "especial"].includes(a.tipo));
    const aparte      = datos.alojamientos.filter(a => !["normal", "especial"].includes(a.tipo));
    const hoyIso      = iso(new Date());

    const filas = lista => lista.map(a => {
      const suyas = datos.reservas.filter(r => r.alojamiento === a.id);
      const celdas = [];
      let i = 0;
      while (i < cuantosDias) {
        const d = iso(dias[i]);
        const r = suyas.find(x => x.entrada.slice(0, 10) <= d && x.salida.slice(0, 10) > d);
        if (!r) { celdas.push(`<div class="hueco"></div>`); i++; continue; }
        let largo = 0;
        while (i + largo < cuantosDias) {
          const dd = iso(dias[i + largo]);
          if (!(r.entrada.slice(0, 10) <= dd && r.salida.slice(0, 10) > dd)) break;
          largo++;
        }
        const c = COLOR[r.estado] || COLOR.confirmada;
        celdas.push(`
          <div class="barra ${r.atencion ? "ojo" : ""}" data-reserva="${r.id}"
               style="grid-column: span ${largo}; background: ${c.fondo}; color: ${c.letra};"
               title="${esc(r.quienes)}">${esc(r.quienes) || "Sin nombre"}</div>`);
        i += largo;
      }
      return `<div class="nombre-aloj ${a.activo ? "" : "parado"}">${esc(a.nombre)}</div>${celdas.join("")}`;
    }).join("");

    contenedor.innerHTML = `
      <div class="cabecera-seccion">
        <div>
          <h2>El cuadrante</h2>
          <p class="flojo">Del ${dias[0].toLocaleDateString("es-ES",{day:"numeric",month:"long"})}
             al ${dias[cuantosDias-1].toLocaleDateString("es-ES",{day:"numeric",month:"long"})}</p>
        </div>
        <div class="mando-cuadro">
          <button class="boton fantasma pequeno" data-mover="-7">←</button>
          <button class="boton fantasma pequeno" data-mover="hoy">Hoy</button>
          <button class="boton fantasma pequeno" data-mover="7">→</button>
          <select id="cuantos">
            <option value="7"  ${cuantosDias === 7  ? "selected" : ""}>Semana</option>
            <option value="14" ${cuantosDias === 14 ? "selected" : ""}>Dos semanas</option>
            <option value="mes">Mes</option>
          </select>
        </div>
      </div>

      ${aviso ? `<div class="aviso">${esc(aviso)}</div>` : ""}

      <div class="leyenda">
        <span><i style="background: var(--azul)"></i>Confirmada</span>
        <span><i style="background: var(--amarillo)"></i>Falta justificante</span>
        <span><i style="background: #2B4152"></i>Está dentro</span>
        <span><i class="ojo-muestra"></i>Manejo de peligrosidad</span>
      </div>

      <div class="cuadro" style="--dias: ${cuantosDias}">
        <div class="cuadro-cabeza">
          <div></div>
          ${dias.map(d => `
            <div class="dia ${iso(d) === hoyIso ? "hoy" : ""}">
              <span>${DIAS[d.getDay()]}</span><strong>${d.getDate()}</strong>
            </div>`).join("")}
        </div>

        <div class="cuadro-filas">${filas(reservables)}</div>

        ${aparte.length ? `
          <p class="cuadro-aparte">No se reservan, se asignan</p>
          <div class="cuadro-filas">${filas(aparte)}</div>` : ""}

        <div class="cuadro-pie">
          <div>Perros</div>
          ${dias.map(d => {
            const n = datos.ocupacion[iso(d)] ?? 0;
            return `<div class="cuenta-dia ${n >= 18 ? "lleno" : ""}">${n}</div>`;
          }).join("")}
        </div>
      </div>`;

    contenedor.querySelectorAll("[data-mover]").forEach(b =>
      b.addEventListener("click", () => {
        if (b.dataset.mover === "hoy") {
          lunes = new Date();
          lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
          lunes.setHours(0, 0, 0, 0);
        } else {
          lunes = new Date(+lunes + Number(b.dataset.mover) * DIA);
        }
        pintar();
      }));

    contenedor.querySelector("#cuantos").addEventListener("change", e => {
      if (e.target.value === "mes") { mes = true; return pintar(); }
      mes = false; cuantosDias = Number(e.target.value); pintar();
    });

    contenedor.querySelectorAll("[data-reserva]").forEach(b =>
      b.addEventListener("click", () => window.verEstancia?.(b.dataset.reserva)));
  }

  /* ---------------------------------------------------------- */
  async function pintarMes() {
    contenedor.innerHTML = `<p class="cargando">Montando el mes…</p>`;

    const primero = new Date(lunes.getFullYear(), lunes.getMonth(), 1);
    const finMes  = new Date(lunes.getFullYear(), lunes.getMonth() + 1, 1);

    let datos;
    try { datos = await cuadrante(iso(primero), iso(finMes)); }
    catch { contenedor.innerHTML = `<div class="error">No hemos podido cargarlo.</div>`; return; }

    const reservables = datos.alojamientos.filter(a =>
      a.activo && ["normal", "especial"].includes(a.tipo)).length;

    const libresEn = d => reservables - datos.reservas.filter(r =>
      r.entrada.slice(0, 10) <= d && r.salida.slice(0, 10) > d).length;

    const celdas = mesDe(primero).map(d => {
      if (!d) return `<div class="dia-mes vacio"></div>`;
      const s = iso(d);
      const perros = datos.ocupacion[s] ?? 0;
      const libres = libresEn(s);
      const lleno = libres === 0;
      const apurado = libres > 0 && libres <= 3;
      return `
        <div class="dia-mes ${s === iso(new Date()) ? "hoy" : ""} ${lleno ? "lleno" : apurado ? "apurado" : ""}"
             data-dia="${s}">
          <span class="numero">${d.getDate()}</span>
          ${perros > 0 || libres < reservables ? `
            <span class="libres">${lleno ? "COMPLETO" : `${libres} libres`}</span>
            <span class="perros">${perros} ${perros === 1 ? "perro" : "perros"}</span>` : ""}
        </div>`;
    }).join("");

    contenedor.innerHTML = `
      <div class="cabecera-seccion">
        <div>
          <h2>El cuadrante</h2>
          <p class="flojo">${primero.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}</p>
        </div>
        <div class="mando-cuadro">
          <button class="boton fantasma pequeno" data-mes="-1">←</button>
          <button class="boton fantasma pequeno" data-mes="hoy">Hoy</button>
          <button class="boton fantasma pequeno" data-mes="1">→</button>
          <select id="cuantos">
            <option value="7">Semana</option>
            <option value="14">Dos semanas</option>
            <option value="mes" selected>Mes</option>
          </select>
        </div>
      </div>

      <div class="leyenda">
        <span><i style="background: #EFE6D8"></i>Hay sitio de sobra</span>
        <span><i style="background: var(--amarillo)"></i>Quedan 3 o menos</span>
        <span><i style="background: var(--rojo)"></i>Completo</span>
      </div>

      <div class="calendario">
        ${["lun","mar","mié","jue","vie","sáb","dom"]
          .map(d => `<div class="cabeza-mes">${d}</div>`).join("")}
        ${celdas}
      </div>
      <p class="flojo">Pincha un día y se abre esa semana.</p>`;

    contenedor.querySelectorAll("[data-mes]").forEach(b =>
      b.addEventListener("click", () => {
        if (b.dataset.mes === "hoy") lunes = new Date();
        else lunes = new Date(lunes.getFullYear(), lunes.getMonth() + Number(b.dataset.mes), 1);
        pintarMes();
      }));

    contenedor.querySelector("#cuantos").addEventListener("change", e => {
      if (e.target.value === "mes") return;
      mes = false; cuantosDias = Number(e.target.value); pintar();
    });

    contenedor.querySelectorAll("[data-dia]").forEach(c =>
      c.addEventListener("click", () => {
        const d = new Date(c.dataset.dia + "T00:00:00");
        d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        lunes = d; mes = false; cuantosDias = 7; pintar();
      }));
  }
}

/* ============================================================
   LA VISTA DE MES

   Treinta días en horizontal no hay quien los lea. En el mes lo
   que importa no es qué perro está en qué box, sino QUÉ DÍAS
   APRIETA: para eso vale un calendario, no una tira.

   Cada día dice cuántos alojamientos quedan libres y cuántos
   perros hay. Se pincha un día y se abre esa semana en el cuadrante
   de siempre.
   ============================================================ */
export function mesDe(primero, datos, alojamientosLibres) {
  const dias = [];
  const inicio = new Date(primero);
  /* El calendario empieza en lunes, así que se rellenan los
     huecos de la semana anterior. */
  const antes = (inicio.getDay() + 6) % 7;
  for (let i = 0; i < antes; i++) dias.push(null);

  const ultimo = new Date(primero.getFullYear(), primero.getMonth() + 1, 0).getDate();
  for (let d = 1; d <= ultimo; d++)
    dias.push(new Date(primero.getFullYear(), primero.getMonth(), d));

  while (dias.length % 7) dias.push(null);
  return dias;
}
