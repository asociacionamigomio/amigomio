/* ============================================================
   Arranque y navegación.

   Una sola página: según quién eres y dónde estás, se pinta una
   vista u otra dentro del mismo hueco.
   ============================================================ */
import { sesionActual, salir, puedeReservar } from "./sesion.js";
import { miFicha } from "./datos.js";
import { render as renderEntrada } from "./vistas/entrada.js";
import { render as renderPerros }  from "./vistas/perros.js";

const app = document.getElementById("app");
let ficha = null;

const SECCIONES = [
  { id: "inicio", texto: "Inicio",     render: renderInicio },
  { id: "perros", texto: "Mis perros", render: renderPerros },
];

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
  const seccion = SECCIONES.find(s => s.id === seccionId) || SECCIONES[0];

  app.innerHTML = `
    <header class="barra">
      <img src="assets/logo.png" alt="AmigoMío" class="logo-barra">
      <nav>
        ${SECCIONES.map(s =>
          `<button class="pestana ${s.id === seccion.id ? "activa" : ""}"
                   data-ir="${s.id}">${s.texto}</button>`).join("")}
      </nav>
      <button class="enlace" id="salir">Salir</button>
    </header>
    <main id="hueco"></main>`;

  app.querySelectorAll("[data-ir]").forEach(b =>
    b.addEventListener("click", () => pintarMarco(b.dataset.ir, sesion)));

  app.querySelector("#salir").addEventListener("click", async () => { await salir(); arrancar(); });

  seccion.render(app.querySelector("#hueco"), { sesion, ficha });
}

function renderInicio(contenedor, { sesion }) {
  const nombre = ficha?.nombre || sesion.usuario.email.split("@")[0];
  contenedor.innerHTML = `
    <div class="tarjeta">
      <h2>¡Hola, ${nombre}!</h2>
      <p>Aquí irán tus estancias. De momento, lo primero es presentarnos a tu perro.</p>
      ${ficha?.es_admin ? `<p class="flojo">Entras como administración.</p>` : ""}
    </div>`;
}

arrancar();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
