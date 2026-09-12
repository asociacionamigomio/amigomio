/* ============================================================
   Arranque. Mira si hay sesión y decide qué pintar.
   ============================================================ */
import { sesionActual, salir, puedeReservar } from "./sesion.js";
import { render as renderEntrada } from "./vistas/entrada.js";

const app = document.getElementById("app");

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
    renderEntrada(app, { alEntrar: arrancar });
    return;
  }

  const nombre = sesion.usuario.email.split("@")[0];
  app.innerHTML = `
    <div class="portada"><h1>AmigoMío</h1></div>
    <div class="tarjeta">
      <h2>¡Hola, ${nombre}!</h2>
      ${puedeReservar(sesion)
        ? `<p>Ya estás dentro. Aquí irán tus perros y tus reservas.</p>`
        : `<div class="aviso">
             Te falta confirmar el correo. Te mandamos un enlace cuando te diste
             de alta: píncha­lo y ya podrás reservar. Mira también el spam.
           </div>`}
      <button class="boton" id="salir">Salir</button>
    </div>`;

  document.getElementById("salir").addEventListener("click", async () => {
    await salir();
    arrancar();
  });
}

arrancar();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
