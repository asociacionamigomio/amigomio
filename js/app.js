/* ============================================================
   Arranque y navegación.

   Una sola página: según quién eres y dónde estás, se pinta una
   vista u otra dentro del mismo hueco.
   ============================================================ */
import { sesionActual, salir, puedeReservar, supabase } from "./sesion.js";
import { t, arrancarIdioma, idiomaActual, ponerIdioma, IDIOMAS } from "./idioma.js";
import { miFicha, misPerros, misReservas, pendientes } from "./datos.js";
import { avisosDeTodos } from "./sanidad.js";
import { saludo } from "./saludo.js";
import { render as renderEntrada } from "./vistas/entrada.js";
import { render as renderContrasenaNueva } from "./vistas/contrasena-nueva.js";
import { render as renderPerros }  from "./vistas/perros.js";
import { render as renderMiFicha } from "./vistas/mi-ficha.js";
import { render as renderSolicitudes } from "./vistas/admin-solicitudes.js";
import { render as renderAdminClientes } from "./vistas/admin-clientes.js";
import { render as renderTarifas } from "./vistas/admin-tarifas.js";
import { render as renderLibro }    from "./vistas/admin-libro.js";
import { render as renderCuentas }  from "./vistas/admin-cuentas.js";
import { render as renderBloqueos } from "./vistas/admin-bloqueos.js";
import { render as renderAdminPerros } from "./vistas/admin-perros.js";
import { fichaDePerro as renderFichaPerro } from "./vistas/perros.js";
import { render as renderValidar } from "./vistas/admin-validar.js";
import { render as renderCuadro } from "./vistas/admin-cuadro.js";
import { render as renderHoja } from "./vistas/admin-hoja.js";
import { render as renderEstancia } from "./vistas/admin-estancia.js";
import { render as renderReservar } from "./vistas/reservar.js";
import { render as renderMisReservas } from "./vistas/mis-reservas.js";
import { render as renderVecinos } from "./vistas/vecinos.js";
import { render as renderComoLlegar } from "./vistas/como-llegar.js";
import { render as renderActividades } from "./vistas/actividades.js";
import { render as renderIntereses } from "./vistas/admin-intereses.js";
import { render as renderClicker } from "./vistas/clicker.js";
import { montar as montarZapatilla } from "./zapatilla.js";

const app = document.getElementById("app");
let ficha = null;

const esc = t => String(t ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* `admin: true` sólo decide si se enseña. Lo que de verdad
   protege es RLS: aunque alguien llegue a la pantalla, la base de
   datos le rechaza la operación.

   Todas las opciones van en el menú de la izquierda, sin «Más»:
   en vertical caben de sobra, que es justo lo que no pasaba con
   nueve pestañas en horizontal. */
const SECCIONES = [
  { id: "inicio",      texto: "Inicio",       render: renderInicio,        icono: "casa" },
  { id: "reservar",    texto: "Reservar",     render: renderReservar,      icono: "calendario" },
  { id: "reservas",    texto: "Mis reservas", render: renderMisReservas,   icono: "lista" },
  { id: "perros",      texto: "Mis perros",   render: renderPerros,        icono: "corazon" },
  { id: "actividades", texto: "Educación y deporte", render: renderActividades, icono: "silbato" },
  { id: "vecinos",     texto: "Los vecinos",  render: renderVecinos,       icono: "gente" },
  { id: "llegar",      texto: "Cómo llegar",  render: renderComoLlegar,    icono: "mapa" },
  { id: "clicker",     texto: "Clicker",      render: renderClicker,       icono: "circulo" },
  { id: "ficha",       texto: "Mi ficha",     render: renderMiFicha,       icono: "persona" },
  /* La PRIMERA de administración a propósito: es lo que hay que
     mirar al entrar. Santiago, 13/09/2026: «no me salen las cosas
     para validar». No salían — había que ir al cuadrante y pinchar
     las reservas una por una. */
  { id: "validar",     texto: "Por validar",   render: renderValidar,       admin: true, icono: "sello" },
  { id: "cuadrante",   texto: "El cuadrante",    render: renderCuadro,        admin: true, icono: "rejilla" },
  { id: "hoja",        texto: "Hoja del día", render: renderHoja,          admin: true, icono: "papel" },
  { id: "estancia",    texto: "Estancia",     render: renderEstancia,      admin: true, icono: "lista", oculta: true },
  { id: "solicitudes", texto: "Solicitudes",  render: renderSolicitudes,   admin: true, icono: "sobre" },
  { id: "intereses",   texto: "Educación y deporte", render: renderIntereses, admin: true, icono: "silbato" },
  { id: "clientes",    texto: "Clientes",     render: renderAdminClientes, admin: true, icono: "gente" },
  { id: "perros-todos", texto: "Perros de clientes", render: renderAdminPerros, admin: true, icono: "corazon" },
  { id: "perro",       texto: "Ficha del perro", render: renderFichaPerro,  admin: true, icono: "corazon", oculta: true },
  { id: "tarifas",     texto: "Tarifas",      render: renderTarifas,       admin: true, icono: "euro" },
  { id: "bloqueos",    texto: "Bloquear fechas", render: renderBloqueos,   admin: true, icono: "candado" },
  { id: "cuentas",     texto: "Las cuentas",  render: renderCuentas,       admin: true, icono: "grafico" },
  { id: "libro",       texto: "Libro de registro", render: renderLibro,    admin: true, icono: "libro" },
];

/* `oculta` no sale en el menú: se llega a ella desde otra
   pantalla, como la ficha de una estancia desde el cuadro. */
const visibles = () => SECCIONES.filter(s => (!s.admin || ficha?.es_admin) && !s.oculta);
const cualquiera = id => SECCIONES.find(s => s.id === id);

const ICONOS = {
  casa:       '<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9.8V20h13V9.8"/>',
  calendario: '<path d="M8 2v3M16 2v3M3.5 9h17"/><rect x="3.5" y="5" width="17" height="16" rx="3"/>',
  lista:      '<path d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01"/>',
  corazon:    '<path d="M12 20.5S3.5 15 3.5 9.2A4.7 4.7 0 0 1 12 6.4a4.7 4.7 0 0 1 8.5 2.8c0 5.8-8.5 11.3-8.5 11.3Z"/>',
  circulo:    '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/>',
  persona:    '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  sobre:      '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.6 6.5 8.4 6 8.4-6"/>',
  gente:      '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-5.8 6.5-5.8s6.5 2.2 6.5 5.8"/><path d="M16.5 5.2a3.5 3.5 0 0 1 0 6.6M17 14.4c2.7.5 4.5 2.5 4.5 5.6"/>',
  euro:       '<path d="M18 6.5A7 7 0 0 0 7.2 9M7.2 15A7 7 0 0 0 18 17.5M3.5 10.5h9M3.5 13.5h9"/>',
  grafico:    '<path d="M4 20V4M4 20h16"/><path d="M8 20v-6M12.5 20V8M17 20v-9"/>',
  candado:    '<rect x="4.5" y="10" width="15" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  movil:      '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 5.5h3"/><path d="M11 18.5h2"/>',
  /* Un silbato: el símbolo de quien entrena, y vale para las dos
     cosas —educación y deporte— sin decantarse por ninguna. El
     corazón que había es el de «Mis perros» y no pintaba nada
     aquí. */
  silbato:    '<path d="M3.6 9.5h8a5.5 5.5 0 1 1 0 7h-8A1.6 1.6 0 0 1 2 14.9v-3.8a1.6 1.6 0 0 1 1.6-1.6Z"/><circle cx="16.6" cy="13" r="1.7"/><path d="M12.5 9.2V6.5h3.5"/>',
  libro:      '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15H5.5A1.5 1.5 0 0 0 4 19.5Z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H19v-3"/><path d="M8 7.5h7M8 11h7"/>',
  rejilla:    '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8.5 9.5V20M14 9.5V20"/>',
  papel:      '<path d="M6 2.5h8l5 5V21a.5.5 0 0 1-.5.5h-12A.5.5 0 0 1 6 21V3a.5.5 0 0 1 .5-.5Z"/><path d="M13.5 2.8V8h5M9 12.5h6M9 16h6"/>',
  /* Un sello: lo que se pone cuando algo queda dado por bueno. */
  sello:      '<path d="M9 3.5h6a2 2 0 0 1 2 2v3.2c0 .9-.4 1.4-1 2l-1 1c-.6.6-1 1.1-1 2V15H9v-1.3c0-.9-.4-1.4-1-2l-1-1c-.6-.6-1-1.1-1-2V5.5a2 2 0 0 1 2-2Z"/><rect x="4" y="17.5" width="16" height="3" rx="1.2"/>',
  /* Una chincheta de mapa. */
  mapa:       '<path d="M12 21.5s6.5-6 6.5-10.6a6.5 6.5 0 1 0-13 0C5.5 15.5 12 21.5 12 21.5Z"/><circle cx="12" cy="10.6" r="2.4"/>',
  salida:     '<path d="M14 3.5H6.5A2.5 2.5 0 0 0 4 6v12a2.5 2.5 0 0 0 2.5 2.5H14"/><path d="m16.5 8.5 3.5 3.5-3.5 3.5M20 12H9.5"/>',
};

/* Con width y height escritos: un SVG sin medida ocupa todo lo
   que le dejen, y basta olvidarse de ponérsela en un sitio para
   que salga del tamaño de la pantalla. */
const icono = n => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="1.9" stroke-linecap="round"
  stroke-linejoin="round">${ICONOS[n] || ""}</svg>`;

/* Cuando llega desde el enlace de «he olvidado la contraseña».

   Supabase abre la sesión y avisa con PASSWORD_RECOVERY. Sin
   escuchar ese aviso, el enlace lo dejaría dentro de la
   aplicación sin ninguna pantalla donde cambiar nada, que es
   exactamente lo que no se espera al pinchar «pon una
   contraseña nueva».

   Se engancha UNA vez, al cargar el fichero, y antes de
   arrancar: el aviso puede llegar en cuanto se lee la sesión. */
let cambiandoContrasena = false;

supabase?.auth.onAuthStateChange((evento) => {
  if (evento !== "PASSWORD_RECOVERY" || cambiandoContrasena) return;
  cambiandoContrasena = true;

  /* Esto pinta por su cuenta, sin pasar por `arrancar()`: hay que
     avisar al vigía del arranque o saltaría igual. */
  window.arrancoBien?.();

  app.className = "contenedor";
  renderContrasenaNueva(app, {
    cuandoTermine: () => {
      cambiandoContrasena = false;
      /* Se limpia el enlace de la barra de direcciones: lleva el
         testigo de recuperación y no pinta nada ahí una vez
         usado. */
      history.replaceState(null, "", location.pathname);
      arrancar();
    },
  });
});

async function arrancar() {
  /* Lo primero: el idioma. De él depende hasta el `lang` del
     documento, que es lo que usan el corrector del teclado y
     los lectores de pantalla. */
  arrancarIdioma();

  /* Si está a media recuperación, no se le pinta nada encima. */
  if (cambiandoContrasena) return;

  if (!window.CONFIG?.configurado) {
    app.innerHTML = `
      <h1>AmigoMío</h1>
      <div class="aviso">
        Falta conectar la base de datos. Rellena <code>js/config.js</code>
        con los datos de Supabase.
      </div>`;
    return;
  }

  const sesion = await sesionActual();

  if (!sesion.usuario) {
    ficha = null;
    app.className = "contenedor";
    renderEntrada(app, { alEntrar: arrancar });
    return;
  }

  /* Crea la ficha de cliente si es la primera vez. Si su correo está
     en la lista de administración, el trigger la marca sola.

     Y si no se puede traer, la aplicación ABRE IGUAL. La ficha da
     el nombre y si eres administración: que no llegue es una
     molestia, que tumbe la aplicación entera no es aceptable.
     Justo eso era «no carga, no abre». */
  let fallóLaFicha = null;
  try {
    ficha = await miFicha();
  } catch (e) {
    ficha = null;
    fallóLaFicha = e;
    console.error("[AmigoMío] no se pudo traer la ficha:", e);
  }

  if (!puedeReservar(sesion)) return pintarSinConfirmar(sesion);

  pintarMarco("inicio", sesion);

  /* Se pinta primero y se avisa después: lo importante es que la
     aplicación esté ahí. Pero callarlo sería mentir — sin la
     ficha no salen las opciones de administración, y pensar que
     han desaparecido asusta más que un aviso. */
  if (fallóLaFicha) avisarDeQueFaltanDatos();
}

function avisarDeQueFaltanDatos() {
  const hueco = app.querySelector("#hueco");
  if (!hueco) return;
  const nota = document.createElement("div");
  nota.className = "aviso";
  nota.innerHTML = `No hemos podido traer tus datos, así que puede que falte
    algo en pantalla. Suele ser la cobertura.
    <button class="boton pequeno" id="recargar-ficha">Volver a probar</button>`;
  hueco.prepend(nota);
  nota.querySelector("#recargar-ficha")
    .addEventListener("click", () => location.reload());
}

/* ------------------------------------------------------------
   El punto rojo del menú.

   Santiago, 13/09/2026: «puedes hacer que aparezca un punto rojo
   en los iconos del menú cuando tenga algo pendiente que
   resolver».

   Es la diferencia entre una aplicación que hay que acordarse de
   mirar y una que te dice cuándo mirarla. Sin él, «Por validar»
   sólo funciona si entras por tu cuenta — y el día que no entres,
   un cliente lleva tres días esperando su confirmación.

   Sólo para administración: un cliente viendo un punto rojo
   porque hay justificantes que validar no entendería nada.
   ------------------------------------------------------------ */
async function ponerPuntos() {
  if (!ficha?.es_admin) return;

  try {
    const cuentas = await pendientes();

    for (const [seccion, cuantas] of Object.entries(cuentas)) {
      if (!cuantas) continue;
      const boton = app.querySelector(`[data-ir="${seccion}"]`);
      if (!boton || boton.querySelector(".punto-pendiente")) continue;

      const punto = document.createElement("span");
      punto.className = "punto-pendiente";
      /* El número dentro: «hay algo» mueve menos que «hay siete».
         Y de 10 en adelante, «+9»: lo que importa es que son
         muchos, no cuántos exactamente. */
      punto.textContent = cuantas > 9 ? "+9" : String(cuantas);
      punto.title = `${cuantas} ${cuantas === 1 ? "cosa pendiente" : "cosas pendientes"}`;
      boton.appendChild(punto);
    }
  } catch (e) {
    /* Un fallo contando no puede dejar sin menú a nadie. */
    console.error("[AmigoMío] no se pudo contar lo pendiente:", e);
  }
}

function pintarSinConfirmar(sesion) {
  app.className = "contenedor";
  app.innerHTML = `
    <div class="portada"><img src="assets/logo.png" alt="AmigoMío" class="logo"></div>
    <div class="tarjeta">
      <h2>¡Ya casi!</h2>
      <div class="aviso">
        Te falta confirmar el correo. Te mandamos un enlace cuando te diste
        de alta: píncha­lo y ya estás. Mira también la carpeta de spam.
      </div>
      <button class="boton" id="salir">Salir</button>
    </div>`;
  app.querySelector("#salir").addEventListener("click", async () => { await salir(); arrancar(); });
}

function pintarMarco(seccionId, sesion) {
  const seccion = visibles().find(s => s.id === seccionId) || cualquiera(seccionId) || SECCIONES[0];
  const mias  = visibles().filter(s => !s.admin);
  const suyas = visibles().filter(s => s.admin);

  const boton = s => `
    <button class="lateral-op ${s.id === seccion.id ? "activa" : ""}" data-ir="${s.id}">
      ${icono(s.icono)}<span>${s.admin ? s.texto : t(s.texto)}</span>
    </button>`;

  /* Con menú lateral la página ocupa todo el ancho; sin él
     —entrada, correo sin confirmar— se centra en una columna. */
  app.className = "con-lateral";

  app.innerHTML = `
    <aside class="lateral">
      <img src="assets/logo.png" alt="AmigoMío" class="lateral-logo">
      <nav class="lateral-lista">
        ${mias.map(boton).join("")}
        ${suyas.length ? `<p class="lateral-grupo">Administración</p>${suyas.map(boton).join("")}` : ""}
      </nav>
      <div id="hueco-instalar"></div>

      <div class="lateral-idioma" role="group" aria-label="Idioma">
        ${IDIOMAS.map(i => `
          <button class="${i.id === idiomaActual() ? "activa" : ""}"
                  data-idioma="${i.id}" lang="${i.id}"
                  title="${i.nombre}">${i.bandera}</button>`).join("")}
      </div>

      <button class="lateral-salir" id="salir">
        ${icono("salida")}<span>${t("Salir")}</span>
      </button>
    </aside>

    <main class="principal"><div class="contenedor" id="hueco"></div></main>`;

  app.querySelectorAll("[data-ir]").forEach(b =>
    b.addEventListener("click", () => pintarMarco(b.dataset.ir, sesion)));

  /* El punto rojo, DESPUÉS de pintar y sin esperarlo.

     Si el menú aguardara a contar lo pendiente para dibujarse,
     una consulta lenta dejaría la aplicación en blanco — que es
     exactamente el fallo que costó dos días el 13/09/2026. */
  ponerPuntos();

  app.querySelector("#salir").addEventListener("click", async () => { await salir(); arrancar(); });

  /* Cambiar de idioma repinta lo que hay, sin recargar: recargar
     perdería lo que estuviera a medias, y una ficha de perro a
     medio rellenar no se vuelve a rellenar.

     Esto vivía en `pintarSinConfirmar`, que NO TIENE botones de
     idioma — copiado al sitio equivocado. Los botones estaban a
     la vista, se podían pulsar, y no pasaba nada. Santiago,
     13/09/2026: «el idioma inglés no carga». Un botón que no hace
     nada es peor que no tener botón: parece que está rota. */
  app.querySelectorAll("[data-idioma]").forEach(b =>
    b.addEventListener("click", () => {
      ponerIdioma(b.dataset.idioma);
      pintarMarco(seccion.id, sesion);
    }));

  /* El marco se repinta entero al cambiar de sección, así que
     el botón de instalar se va con él. Si sigue haciendo falta,
     se vuelve a poner. */
  if (pedirInstalar) mostrarBotonInstalar();

  /* Para que una vista pueda mandar a otra sin conocerla. */
  window.irA = id => pintarMarco(id, sesion);
  window.refrescar = () => pintarMarco(seccion.id, sesion);
  /* Del cuadro a la ficha de una estancia concreta. */
  window.verEstancia = rid => { window.__estancia = rid; pintarMarco("estancia", sesion); };
  /* Y de la ficha del cliente a la ficha de uno de sus perros,
     igual que del cuadrante a la estancia. */
  window.verPerro = pid => { window.__perro = pid; pintarMarco("perro", sesion); };

  montarZapatilla();

  seccion.render(app.querySelector("#hueco"), { sesion, ficha });
}

async function renderInicio(contenedor, { sesion }) {
  const nombre = ficha?.nombre || sesion.usuario.email.split("@")[0];
  const fichaAMedias = !ficha?.dni || !ficha?.consiente_datos;

  /* Lo que se le caduca pronto a sus perros. Se mira al entrar,
     sin que haga falta ninguna reserva de por medio: de nada
     sirve enterarse el día que quiere reservar. */
  let avisos = [];
  try { avisos = avisosDeTodos(await misPerros()); } catch { /* ya se verá */ }

  /* Las estancias que vienen. La pantalla PROMETÍA enseñarlas
     —«Aquí irán tus estancias»— y no enseñaba ninguna, así que
     el cliente se quedaba mirando y pensando que su reserva se
     había perdido. Una promesa escrita que no se cumple es peor
     que no prometer nada.

     Sólo las que están por venir: el inicio es «qué tengo por
     delante», no el historial. Eso está en «Mis reservas». */
  let proximas = [];
  try {
    const hoy = new Date().toISOString().slice(0, 10);
    proximas = (await misReservas())
      .filter(r => r.salida.slice(0, 10) >= hoy
                && !["cancelada", "caducada"].includes(r.estado))
      .sort((a, b) => a.entrada.localeCompare(b.entrada))
      .slice(0, 3);
  } catch { /* ya se verá */ }

  const dia = iso => new Date(iso).toLocaleDateString("es-ES",
    { weekday: "long", day: "numeric", month: "long" });
  const hora = iso => new Date(iso).toLocaleTimeString("es-ES",
    { hour: "2-digit", minute: "2-digit" });

  const COMO_VA = {
    pendiente:  { texto: "Falta el justificante", clase: "amarilla" },
    revisando:  { texto: "Estamos mirándolo",     clase: "amarilla" },
    confirmada: { texto: "Confirmada",            clase: "azul" },
    en_curso:   { texto: "Está aquí ahora",       clase: "azul" },
  };

  const enCristianoDias = d =>
    d < 0  ? "ya venció"
    : d === 0 ? "vence hoy"
    : d === 1 ? "vence mañana"
    : `quedan ${d} días`;

  contenedor.innerHTML = `
    <div class="tarjeta">
      <h2>${esc(saludo(nombre))}</h2>
      ${ficha?.es_admin ? `<p class="flojo">Entras como administración.</p>` : ""}
    </div>

    ${proximas.length ? `
      <div class="tarjeta">
        <h3>${proximas.length === 1 ? "Tu próxima estancia" : "Tus próximas estancias"}</h3>
        <div class="proximas">
          ${proximas.map(r => {
            const perros = (r.reserva_perro || []).map(x => x.perro?.nombre).filter(Boolean);
            const estado = COMO_VA[r.estado] || { texto: r.estado, clase: "" };
            const faltan = Math.ceil((new Date(r.entrada) - Date.now()) / 86400000);
            return `
              <button class="proxima" data-ir="reservas">
                <div>
                  <strong>${esc(perros.join(" y ")) || "Tu reserva"}</strong>
                  <p>${dia(r.entrada)} a las ${hora(r.entrada)}
                     → ${dia(r.salida)} a las ${hora(r.salida)}</p>
                  <p class="flojo">${esc(r.alojamiento?.nombre || "")}</p>
                </div>
                <div class="proxima-estado">
                  <span class="etiqueta ${estado.clase}">${esc(estado.texto)}</span>
                  ${faltan > 0 ? `<span class="flojo">${faltan === 1
                    ? "es mañana" : `en ${faltan} días`}</span>` : ""}
                </div>
              </button>`;
          }).join("")}
        </div>
      </div>` : `
      <div class="tarjeta">
        <p>No tienes ninguna estancia por delante.</p>
        <button class="boton" data-ir="reservar">Reservar unos días</button>
      </div>`}

    ${avisos.length ? `
      <div class="tarjeta avisos-sanidad">
        <h3>${avisos.length === 1 ? "Una cosa que caduca" : "Cosas que caducan"}</h3>
        <div class="lista-avisos">
          ${avisos.slice(0, 4).map(a => `
            <div class="aviso-linea ${a.estado === "caducado" ? "vencido" : ""}">
              <span class="punto"></span>
              <div>
                <p>${esc(a.mensaje)}</p>
                <span class="cuando">${enCristianoDias(a.dias)}</span>
              </div>
            </div>`).join("")}
        </div>
        ${avisos.length > 4 ? `<p class="flojo">Y ${avisos.length - 4} más en la ficha de cada perro.</p>` : ""}
        <button class="boton fantasma" data-ir="perros">Apuntar las fechas nuevas</button>
      </div>` : ""}

    ${fichaAMedias ? `
      <div class="tarjeta aviso-tarjeta">
        <h3>Nos faltan tus datos</h3>
        <p>Antes de la primera estancia necesitamos tu DNI, tu dirección y un teléfono:
           la normativa nos obliga a anotarlos.</p>
        <button class="boton" data-ir="ficha">Rellenar mi ficha</button>
      </div>` : ""}`;

  contenedor.querySelectorAll("[data-ir]").forEach(b =>
    b.addEventListener("click", () => pintarMarco(b.dataset.ir, sesion)));
}

/* Deja constancia del fallo en el propio móvil, para que
   `revisar.html` pueda enseñarlo. Si `localStorage` no va —modo
   privado— se pierde, y tampoco pasa nada: es un extra. */
function apuntarElFallo(donde, fallo) {
  try {
    localStorage.setItem("amigomio-ultimo-fallo", JSON.stringify({
      cuando: new Date().toISOString(),
      donde,
      mensaje: fallo?.message || String(fallo),
      detalle: fallo?.code || fallo?.hint || fallo?.details || "",
    }));
  } catch { /* da igual */ }
}
window.apuntarElFallo = apuntarElFallo;

/* Y se arranca.

   Recogiendo el error: `arrancar()` es una promesa, y una promesa
   que revienta por dentro sin que nadie la recoja no hace
   absolutamente nada en la pantalla. Se queda el «Cargando…» del
   HTML, que es lo que le pasó a Santiago el 13/09/2026 en su
   móvil: «aparece cargando, pero no carga».

   `arrancoBien` lo pone `index.html`: es como se calla el vigía
   del arranque cuando ya hay algo pintado. */
arrancar()
  .then(() => window.arrancoBien?.())
  .catch(fallo => {
    console.error("No se ha podido arrancar:", fallo);

    /* Y se APUNTA, para poder leerlo después en revisar.html.
       Pedirle a una persona que copie un texto de una pantalla de
       error, en un móvil, es pedirle demasiado — y adivinar ya nos
       costó dos días (13/09/2026). */
    apuntarElFallo("al arrancar", fallo);

    window.arrancoBien?.();
    app.className = "contenedor";
    app.innerHTML = `
      <div class="portada"><img src="assets/logo.png" alt="AmigoMío" class="logo"></div>
      <div class="tarjeta">
        <h2>No hemos podido abrir</h2>
        <p>Nos hemos quedado sin conexión con el servidor. Casi siempre
           es cosa de un momento.</p>
        <button class="boton" id="otra-vez">Probar otra vez</button>
        <!-- El mensaje de verdad, en pequeño. «No hemos podido
             abrir» a secas deja igual de ciego que «Cargando…»:
             con esto delante se arregla en un rato. -->
        <p class="flojo">Si nos lo quieres contar, esto es lo que ha pasado:
           <code>${esc(fallo?.message || String(fallo))}</code></p>
        <p class="flojo">Si insiste,
           <a href="reiniciar.html">reinicia la aplicación</a>.
           No pierdes nada: tus perros y tus reservas están a salvo.</p>
      </div>`;
    app.querySelector("#otra-vez")
      .addEventListener("click", () => location.reload());
  });

/* ============================================================
   Cuando hay una versión nueva.

   El 13/09/2026 el móvil de Santiago, con la aplicación
   instalada, seguía corriendo el JavaScript de dos días antes y
   le enseñaba perros de otros clientes. Una aplicación
   instalada puede pasarse semanas sin cerrarse del todo, y los
   módulos que ya están en memoria no se recargan solos.

   Así que: se comprueba al abrir y cada media hora, y cuando
   hay algo nuevo se AVISA. No se recarga sola a propósito —
   podría estar a media ficha de un perro, y perderle lo escrito
   enfada más que el fallo que arregla.
   ============================================================ */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").then(registro => {
    /* Al abrir, y cada media hora mientras siga abierta. */
    registro.update();
    setInterval(() => registro.update(), 30 * 60 * 1000);

    registro.addEventListener("updatefound", () => {
      const nuevo = registro.installing;
      nuevo?.addEventListener("statechange", () => {
        /* `controller` distingue «se acaba de instalar por
           primera vez» de «había una y ahora hay otra». En el
           primer caso no hay nada que avisar. */
        if (nuevo.state === "installed" && navigator.serviceWorker.controller)
          avisarDeVersionNueva();
      });
    });
  }).catch(() => { /* sin service worker se vive igual */ });

  navigator.serviceWorker.addEventListener("message", e => {
    if (!e.data?.version || e.data.primera) return;
    /* Y aun así: `controller` nulo significa que a esta página
       todavía no la sirve ningún service worker, o sea que es su
       primera carga. Dos comprobaciones para lo mismo porque
       este aviso no puede volver a salir cuando no toca. */
    if (!navigator.serviceWorker.controller) return;
    avisarDeVersionNueva();
  });
}

function avisarDeVersionNueva() {
  if (document.getElementById("hay-version-nueva")) return;

  const barra = document.createElement("div");
  barra.id = "hay-version-nueva";
  barra.className = "barra-version";
  barra.innerHTML = `
    <span>Hay una versión nueva de la aplicación.</span>
    <button class="boton pequeno">Actualizar</button>`;

  barra.querySelector("button").addEventListener("click", async () => {
    /* Se tira el caché antes de recargar: si no, la recarga
       podría volver a servir lo viejo y no habríamos hecho
       nada. */
    try { for (const c of await caches.keys()) await caches.delete(c); } catch { /* da igual */ }
    location.reload();
  });

  document.body.appendChild(barra);
}

/* ------------------------------------------------------------
   Instalar en el móvil.

   El navegador avisa cuando la app cumple los requisitos, pero
   NO enseña nada por su cuenta en móvil: hay que ofrecerlo.
   Si nadie guarda este aviso, la opción no aparece jamás.
   ------------------------------------------------------------ */
let pedirInstalar = null;

window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  pedirInstalar = e;
  mostrarBotonInstalar();
});

window.addEventListener("appinstalled", () => {
  pedirInstalar = null;
  document.getElementById("instalar")?.remove();
});

/* El botón de instalar.

   Va DENTRO del menú cuando hay menú. Flotando abajo a la
   izquierda tapaba el final de la lista de administración, que
   es la más larga — y un botón que flota encima de otro botón no
   es un adorno mal puesto: es una opción a la que no se puede
   llegar.

   En la pantalla de entrada no hay menú, y ahí sí flota: no hay
   nada debajo que tapar. */
function mostrarBotonInstalar() {
  if (document.getElementById("instalar")) return;

  const b = document.createElement("button");
  b.id = "instalar";
  b.addEventListener("click", async () => {
    if (!pedirInstalar) return;
    pedirInstalar.prompt();
    await pedirInstalar.userChoice;
    pedirInstalar = null;
    b.remove();
  });

  /* Su hueco: dentro del menú, o dentro de la tarjeta de la
     puerta. Nunca flotando: en la esquina de abajo ya está la
     barra de «hay una versión nueva», y dos cosas flotando en el
     mismo sitio se tapan. */
  const hueco = document.getElementById("hueco-instalar");
  if (!hueco) return;

  b.className = hueco.closest(".lateral") ? "lateral-instalar" : "boton instalar";
  b.innerHTML = b.className === "lateral-instalar"
    ? `${icono("movil")}<span>Instalar en el móvil</span>`
    : "Instalar en el móvil";
  hueco.appendChild(b);
}
