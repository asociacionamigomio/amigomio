/* ============================================================
   Arranque y navegación.

   Una sola página: según quién eres y dónde estás, se pinta una
   vista u otra dentro del mismo hueco.
   ============================================================ */
import { sesionActual, salir, puedeReservar } from "./sesion.js";
import { miFicha, misPerros } from "./datos.js";
import { avisosDeTodos } from "./sanidad.js";
import { render as renderEntrada } from "./vistas/entrada.js";
import { render as renderPerros }  from "./vistas/perros.js";
import { render as renderMiFicha } from "./vistas/mi-ficha.js";
import { render as renderSolicitudes } from "./vistas/admin-solicitudes.js";
import { render as renderAdminClientes } from "./vistas/admin-clientes.js";
import { render as renderTarifas } from "./vistas/admin-tarifas.js";
import { render as renderReservar } from "./vistas/reservar.js";
import { render as renderMisReservas } from "./vistas/mis-reservas.js";
import { render as renderClicker } from "./vistas/clicker.js";
import { montar as montarZapatilla } from "./zapatilla.js";

const app = document.getElementById("app");
let ficha = null;

const esc = t => String(t ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* `admin: true` sólo decide si se enseña la pestaña. Lo que de
   verdad protege es RLS: aunque alguien llegue a la pantalla, la
   base de datos le rechaza la operación. */
const SECCIONES = [
  { id: "inicio",      texto: "Inicio",       render: renderInicio },
  { id: "reservar",    texto: "Reservar",     render: renderReservar },
  { id: "reservas",    texto: "Mis reservas", render: renderMisReservas },
  { id: "perros",      texto: "Mis perros",   render: renderPerros },
  { id: "clicker",     texto: "Clicker",      render: renderClicker },
  { id: "ficha",       texto: "Mi ficha",     render: renderMiFicha },
  { id: "solicitudes", texto: "Solicitudes",  render: renderSolicitudes,   admin: true },
  { id: "clientes",    texto: "Clientes",     render: renderAdminClientes, admin: true },
  { id: "tarifas",     texto: "Tarifas",      render: renderTarifas,       admin: true },
];

const visibles = () => SECCIONES.filter(s => !s.admin || ficha?.es_admin);

async function arrancar() {
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
  const seccion = visibles().find(s => s.id === seccionId) || SECCIONES[0];

  app.innerHTML = `
    <header class="barra">
      <img src="assets/logo.png" alt="AmigoMío" class="logo-barra">
      <nav>
        ${visibles().map(s =>
          `<button class="pestana ${s.id === seccion.id ? "activa" : ""}"
                   data-ir="${s.id}">${s.texto}</button>`).join("")}
      </nav>
      <button class="enlace" id="salir">Salir</button>
    </header>
    <main id="hueco"></main>`;

  app.querySelectorAll("[data-ir]").forEach(b =>
    b.addEventListener("click", () => pintarMarco(b.dataset.ir, sesion)));

  app.querySelector("#salir").addEventListener("click", async () => { await salir(); arrancar(); });

  /* Para que una vista pueda mandar a otra sin conocerla. */
  window.irA = id => pintarMarco(id, sesion);
  /* Y para que Zapatilla pueda refrescar lo que haya debajo
     cuando cree una reserva o dé de alta un perro. */
  window.refrescar = () => pintarMarco(seccion.id, sesion);

  /* Zapatilla, en todas las pantallas. Solo para quien ha
     entrado: habla con la base de datos usando su sesión. */
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

  const enCristianoDias = d =>
    d < 0  ? "ya venció"
    : d === 0 ? "vence hoy"
    : d === 1 ? "vence mañana"
    : `quedan ${d} días`;

  contenedor.innerHTML = `
    <div class="tarjeta">
      <h2>¡Hola, ${esc(nombre)}!</h2>
      <p>Aquí irán tus estancias. De momento, lo primero es presentarnos a tu perro.</p>
      ${ficha?.es_admin ? `<p class="flojo">Entras como administración.</p>` : ""}
    </div>

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

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");

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
