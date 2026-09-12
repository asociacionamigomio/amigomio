/* ============================================================
   Mis perros: la lista y el alta en tres pasos.

   El alta se puede guardar a medias (borrador). Es el formulario
   más largo de la app y de una sentada la gente lo abandona.
   ============================================================ */
import { PASOS, validarPaso } from "../formularios.js";
import { misPerros, guardarPerro, unPerro, borrarPerro } from "../datos.js";
import { camposSanidad, estadoRequisito, REQUISITOS, enCristiano } from "../sanidad.js";

const esc = t => String(t ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ------------------------------------------------------------
   Lista
   ------------------------------------------------------------ */
export async function render(contenedor) {
  contenedor.innerHTML = `<p class="cargando">Buscando a tus perros…</p>`;
  let perros = [];
  try { perros = await misPerros(); }
  catch { contenedor.innerHTML = `<div class="error">No hemos podido cargar tus perros.</div>`; return; }

  contenedor.innerHTML = `
    <div class="cabecera-seccion">
      <h2>Mis perros</h2>
      <button class="boton" id="nuevo">Dar de alta un perro</button>
    </div>
    ${perros.length === 0
      ? `<div class="tarjeta vacio">
           <p>Todavía no nos has presentado a nadie.</p>
           <p class="flojo">Da de alta a tu perro y ya no tendrás que repetir
              sus datos cada vez que reserves.</p>
         </div>`
      : `<div class="lista-perros">${perros.map(tarjetaPerro).join("")}</div>`}`;

  contenedor.querySelector("#nuevo").addEventListener("click",
    () => formulario(contenedor, null));

  contenedor.querySelectorAll("[data-abrir]").forEach(el =>
    el.addEventListener("click", () => formulario(contenedor, el.dataset.abrir)));
}

function tarjetaPerro(p) {
  const edad = p.fecha_nacimiento
    ? new Date(p.fecha_nacimiento).getFullYear() : "";
  return `
    <div class="tarjeta perro" data-abrir="${p.id}">
      <div class="avatar">${p.foto ? `<img src="${esc(p.foto)}" alt="">` : "🐕"}</div>
      <div>
        <h3>${esc(p.nombre)} ${p.borrador ? `<span class="etiqueta">a medias</span>` : ""}</h3>
        <p class="flojo">${esc(p.raza) || "Sin raza anotada"}${edad ? ` · ${edad}` : ""}</p>
        <p class="flojo chip">Chip ${esc(p.chip)}</p>
      </div>
    </div>`;
}

/* ------------------------------------------------------------
   Alta y edición, en tres pasos
   ------------------------------------------------------------ */
async function formulario(contenedor, id) {
  let datos = id ? (await unPerro(id)) || {} : { sociable: "todos", actividad: "normal", sanidad: {} };
  let paso = 0;
  const esNuevo = !datos.id;

  function pintar(faltan = [], aviso = "") {
    const p = PASOS[paso];
    const error = campo => {
      const f = faltan.find(x => x.campo === campo);
      return f ? `<p class="error-campo">${esc(f.mensaje)}</p>` : "";
    };

    contenedor.innerHTML = `
      <div class="cabecera-seccion">
        <h2>${esNuevo ? "Un perro nuevo" : esc(datos.nombre)}</h2>
        <button class="boton fantasma" id="volver">Volver</button>
      </div>

      <div class="pasos">
        ${PASOS.map((x, i) => `<span class="${i === paso ? "activo" : ""}">${i + 1}</span>`).join("")}
      </div>

      <div class="tarjeta">
        <h3>${p.titulo}</h3>
        ${aviso ? `<div class="aviso">${esc(aviso)}</div>` : ""}
        ${[cuerpoPaso0, cuerpoPaso1, cuerpoPaso2][paso](datos, error, esNuevo)}

        <div class="botonera">
          ${paso > 0 ? `<button class="boton fantasma" id="atras">Atrás</button>` : ""}
          <button class="boton" id="siguiente">
            ${paso < PASOS.length - 1 ? "Siguiente" : "Guardar"}
          </button>
        </div>
        <button class="enlace" id="luego">Guardar y seguir luego</button>
      </div>`;

    contenedor.querySelector("#volver").addEventListener("click", () => render(contenedor));
    contenedor.querySelector("#atras")?.addEventListener("click", () => { recoger(); paso--; pintar(); });
    contenedor.querySelector("#siguiente").addEventListener("click", siguiente);
    contenedor.querySelector("#luego").addEventListener("click", aMedias);

    contenedor.querySelector("#es_ppp")?.addEventListener("change", () => { recoger(); pintar(); });
  }

  /* Recoge lo escrito en pantalla y lo mete en `datos`. */
  function recoger() {
    contenedor.querySelectorAll("[data-campo]").forEach(el => {
      const c = el.dataset.campo;
      datos[c] = el.type === "checkbox" ? el.checked : el.value;
    });
    const sanidad = { ...(datos.sanidad || {}) };
    contenedor.querySelectorAll("[data-sanidad]").forEach(el => {
      const [id, prop] = el.dataset.sanidad.split(":");
      sanidad[id] = sanidad[id] || {};
      sanidad[id][prop] = el.type === "checkbox" ? el.checked : el.value;
    });
    if (Object.keys(sanidad).length) datos.sanidad = sanidad;
  }

  async function siguiente() {
    recoger();
    const r = validarPaso(paso, datos);
    if (!r.ok) return pintar(r.faltan);

    if (paso < PASOS.length - 1) { paso++; return pintar(); }

    const g = await guardarPerro(limpiar(datos), { borrador: false });
    if (!g.ok) return pintar([], g.mensaje);
    render(contenedor);
  }

  async function aMedias() {
    recoger();
    /* Para guardar a medias sólo hace falta lo mínimo que la base
       de datos exige: chip y nombre. El resto puede faltar. */
    const r = validarPaso(0, datos);
    const imprescindible = r.faltan.filter(f => f.campo === "chip" || f.campo === "nombre");
    if (imprescindible.length)
      return pintar(imprescindible, "Para poder guardarlo a medias nos hace falta al menos esto.");

    const g = await guardarPerro(limpiar(datos), { borrador: true });
    if (!g.ok) return pintar([], g.mensaje);
    render(contenedor);
  }

  pintar();   // sin esto se define todo y no se pinta nada
}

/* Quita lo que no es columna de la tabla. */
function limpiar(d) {
  const fuera = new Set(["foto_archivo"]);
  const salida = {};
  for (const [k, v] of Object.entries(d)) if (!fuera.has(k)) salida[k] = v === "" ? null : v;
  /* Los textos vacíos son '' en la base, no null. */
  for (const k of ["raza", "capa", "estado_reproductivo", "pautas_alimentacion", "cuidados"])
    if (salida[k] == null) salida[k] = "";
  return salida;
}

/* ------------------------------------------------------------
   Los tres pasos
   ------------------------------------------------------------ */
function cuerpoPaso0(d, error, esNuevo) {
  return `
    <label for="nombre">Nombre</label>
    ${esNuevo
      ? `<input id="nombre" data-campo="nombre" value="${esc(d.nombre)}" placeholder="Luna">`
      : `<input value="${esc(d.nombre)}" disabled>
         <p class="flojo">El nombre y el chip solo se cambian con nuestro visto bueno.</p>`}
    ${error("nombre")}

    <label for="chip">Número de chip</label>
    ${esNuevo
      ? `<input id="chip" data-campo="chip" inputmode="numeric"
                value="${esc(d.chip)}" placeholder="941 0000 1234 5678">`
      : `<input value="${esc(d.chip)}" disabled>`}
    ${error("chip")}

    <label for="fecha_nacimiento">Fecha de nacimiento</label>
    <input id="fecha_nacimiento" type="date" data-campo="fecha_nacimiento"
           value="${esc(d.fecha_nacimiento)}">
    ${error("fecha_nacimiento")}

    <label for="sexo">Sexo</label>
    <select id="sexo" data-campo="sexo">
      <option value="">Elige…</option>
      <option value="macho"  ${d.sexo === "macho"  ? "selected" : ""}>Macho</option>
      <option value="hembra" ${d.sexo === "hembra" ? "selected" : ""}>Hembra</option>
    </select>
    ${error("sexo")}

    <label for="raza">Raza</label>
    <input id="raza" data-campo="raza" value="${esc(d.raza)}" placeholder="Pastor belga malinois">

    <label for="capa">Capa</label>
    <input id="capa" data-campo="capa" value="${esc(d.capa)}" placeholder="Carbonado">

    <label class="casilla">
      <input type="checkbox" data-campo="castrado" ${d.castrado ? "checked" : ""}>
      Está castrado o esterilizado
    </label>`;
}

function cuerpoPaso1(d) {
  const campos = camposSanidad(d);
  const fila = c => `
    <div class="requisito ${c.obligatorio ? "" : "recomendado"}">
      <span class="nombre-req">${esc(c.nombre)}${c.obligatorio ? "" : " <em>(recomendada)</em>"}</span>
      <input type="date" data-sanidad="${c.id}:fecha" value="${esc(c.fecha)}">
      <label class="casilla pequena">
        <input type="checkbox" data-sanidad="${c.id}:primovacunacion" ${c.primovacunacion ? "checked" : ""}>
        Es la primera vez
      </label>
    </div>`;

  return `
    <label for="pautas">¿Cómo come?</label>
    <textarea id="pautas" data-campo="pautas_alimentacion" rows="4"
      placeholder="Dos tomas, 300 g de pienso de cordero. No le des pollo.">${esc(d.pautas_alimentacion)}</textarea>

    <label for="cuidados">¿Necesita algún cuidado especial?</label>
    <textarea id="cuidados" data-campo="cuidados" rows="4"
      placeholder="Pastilla para la artrosis con la cena. Le cuesta subir escalones.">${esc(d.cuidados)}</textarea>

    <h4>Vacunas y desparasitaciones</h4>
    <p class="flojo">Las fechas de la cartilla. Si algo caduca antes de una estancia,
       te avisamos con tiempo para que lo tengas listo.</p>
    <div class="requisitos">${campos.map(fila).join("")}</div>`;
}

function cuerpoPaso2(d, error) {
  const sel = (v, o) => v === o ? "selected" : "";
  const casilla = (campo, texto) => `
    <label class="casilla">
      <input type="checkbox" data-campo="${campo}" ${d[campo] ? "checked" : ""}>
      ${texto}
    </label>`;

  return `
    <label for="sociable">¿Cómo se lleva con otros perros?</label>
    <select id="sociable" data-campo="sociable">
      <option value="todos"   ${sel(d.sociable, "todos")}>Bien con todos</option>
      <option value="machos"  ${sel(d.sociable, "machos")}>Solo con machos</option>
      <option value="hembras" ${sel(d.sociable, "hembras")}>Solo con hembras</option>
      <option value="ninguno" ${sel(d.sociable, "ninguno")}>Mejor solo</option>
    </select>
    ${error("sociable")}

    <label for="actividad">¿Cuánta marcha tiene?</label>
    <select id="actividad" data-campo="actividad">
      <option value="activo"     ${sel(d.actividad, "activo")}>Mucha, no para</option>
      <option value="normal"     ${sel(d.actividad, "normal")}>Normal</option>
      <option value="sedentario" ${sel(d.actividad, "sedentario")}>Tranquilo, de tumbarse al sol</option>
    </select>
    ${error("actividad")}

    <h4>Cosas que nos ayudan a cuidarlo mejor</h4>
    ${casilla("timido",     "Es tímido o miedoso")}
    ${casilla("comilon",    "Es muy comilón")}
    ${casilla("polidipsia", "Bebe muchísima agua")}
    ${casilla("destroyer",  "Rompe cosas: camas, juguetes…")}

    <h4>Cosas importantes</h4>
    <label class="casilla">
      <input type="checkbox" data-campo="agresivo_con_personas" ${d.agresivo_con_personas ? "checked" : ""}>
      <span><strong>Ha tenido problemas de agresividad con personas</strong>
        <br><span class="flojo">Si es así, va a un alojamiento aparte y siempre solo.
        Dínoslo aunque te dé apuro: es por su seguridad y la de todos.</span></span>
    </label>

    <label class="casilla">
      <input type="checkbox" id="es_ppp" data-campo="es_ppp" ${d.es_ppp ? "checked" : ""}>
      Es un perro potencialmente peligroso (PPP)
    </label>

    ${d.es_ppp ? `
      <label for="lic">¿Hasta cuándo vale tu licencia?</label>
      <input id="lic" type="date" data-campo="ppp_licencia_hasta" value="${esc(d.ppp_licencia_hasta)}">
      ${error("ppp_licencia_hasta")}

      <label for="seg">¿Y el seguro de responsabilidad civil?</label>
      <input id="seg" type="date" data-campo="ppp_seguro_hasta" value="${esc(d.ppp_seguro_hasta)}">
      ${error("ppp_seguro_hasta")}` : ""}`;
}
