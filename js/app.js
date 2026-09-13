/* ============================================================
   Arranque y navegación.

   Una sola página: según quién eres y dónde estás, se pinta una
   vista u otra dentro del mismo hueco.
   ============================================================ */
import { sesionActual, salir, puedeReservar, supabase } from "./sesion.js";
import { t, arrancarIdioma, idiomaActual, ponerIdioma, IDIOMAS } from "./idioma.js";
import { miFicha, misPerros, misReservas } from "./datos.js";
import { avisosDeTodos } from "./sanidad.js";
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
import { render as renderCuadro } from "./vistas/admin-cuadro.js";
import { render as renderHoja } from "./vistas/admin-hoja.js";
import { render as renderEstancia } from "./vistas/admin-estancia.js";
import { render as renderReservar } from "./vistas/reservar.js";
import { render as renderMisReservas } from "./vistas/mis-reservas.js";
import { render as renderVecinos } from "./vistas/vecinos.js";
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
  { id: "vecinos",     texto: "Los vecinos",  render: renderVecinos,       icono: "gente" },
  { id: "clicker",     texto: "Clicker",      render: renderClicker,       icono: "circulo" },
  { id: "ficha",       texto: "Mi ficha",     render: renderMiFicha,       icono: "persona" },
  { id: "cuadrante",   texto: "El cuadrante",    render: renderCuadro,        admin: true, icono: "rejilla" },
  { id: "hoja",        texto: "Hoja del día", render: renderHoja,          admin: true, icono: "papel" },
  { id: "estancia",    texto: "Estancia",     render: renderEstancia,      admin: true, icono: "lista", oculta: true },
  { id: "solicitudes", texto: "Solicitudes",  render: renderSolicitudes,   admin: true, icono: "sobre" },
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
  libro:      '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15H5.5A1.5 1.5 0 0 0 4 19.5Z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H19v-3"/><path d="M8 7.5h7M8 11h7"/>',
  rejilla:    '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8.5 9.5V20M14 9.5V20"/>',
  papel:      '<path d="M6 2.5h8l5 5V21a.5.5 0 0 1-.5.5h-12A.5.5 0 0 1 6 21V3a.5.5 0 0 1 .5-.5Z"/><path d="M13.5 2.8V8h5M9 12.5h6M9 16h6"/>',
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
     en la lista de administración, el trigger la marca sola. */
  ficha = await miFicha();

  if (!puedeReservar(sesion)) return pintarSinConfirmar(sesion);

  pintarMarco("inicio", sesion);
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

  /* Cambiar de idioma repinta lo que hay: no hace falta
     recargar ni perder lo que se estuviera haciendo. */
  app.querySelectorAll("[data-idioma]").forEach(b =>
    b.addEventListener("click", () => {
      ponerIdioma(b.dataset.idioma);
      pintarMarco(seccion.id, sesion);
    }));
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

  app.querySelector("#salir").addEventListener("click", async () => { await salir(); arrancar(); });

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
      <h2>¡Hola, ${esc(nombre)}!</h2>
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

arrancar();

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

function mostrarBotonInstalar() {
  if (document.getElementById("instalar")) return;
  const b = document.createElement("button");
  b.id = "instalar";
  b.className = "boton instalar";
  b.textContent = "Instalar en el móvil";
  b.addEventListener("click", async () => {
    if (!pedirInstalar) return;
    pedirInstalar.prompt();
    await pedirInstalar.userChoice;
    pedirInstalar = null;
    b.remove();
  });
  document.body.appendChild(b);
}
