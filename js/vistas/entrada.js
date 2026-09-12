/* ============================================================
   La puerta: entrar o darse de alta.

   El registro es abierto, sin invitación. Lo que hace de barrera
   es confirmar el correo, y eso se explica aquí mismo para que
   nadie se quede esperando sin saber qué pasa.
   ============================================================ */
import { entrar, darseDeAlta } from "../sesion.js";

export function render(contenedor, { alEntrar }) {
  let modo = "entrar";   // o "alta"

  function pintar(aviso = "", clase = "aviso") {
    const esAlta = modo === "alta";
    contenedor.innerHTML = `
      <div class="portada">
        <img src="assets/logo.png" alt="AmigoMío" class="logo">
        <p class="lema">Tu mejor amig@ también se va de vacaciones</p>
      </div>

      <div class="tarjeta">
        <h2>${esAlta ? "Crear una cuenta" : "Entrar"}</h2>

        ${aviso ? `<div class="${clase}">${aviso}</div>` : ""}

        <label for="correo">Tu correo</label>
        <input id="correo" type="email" autocomplete="email" inputmode="email"
               placeholder="tucorreo@ejemplo.com">

        <label for="clave">Tu contraseña</label>
        <input id="clave" type="password"
               autocomplete="${esAlta ? "new-password" : "current-password"}"
               placeholder="${esAlta ? "Al menos 8 caracteres" : ""}">

        <button class="boton" id="enviar">
          ${esAlta ? "Crear cuenta" : "Entrar"}
        </button>

        <p class="cambiar">
          ${esAlta ? "¿Ya tienes cuenta?" : "¿Primera vez por aquí?"}
          <a href="#" id="cambiar">${esAlta ? "Entrar" : "Crear una cuenta"}</a>
        </p>
      </div>`;

    contenedor.querySelector("#cambiar").addEventListener("click", e => {
      e.preventDefault();
      modo = esAlta ? "entrar" : "alta";
      pintar();
    });

    const boton = contenedor.querySelector("#enviar");
    boton.addEventListener("click", async () => {
      const correo = contenedor.querySelector("#correo").value.trim();
      const clave  = contenedor.querySelector("#clave").value;

      if (!correo) return pintar("Nos falta tu correo.", "error");
      if (!clave)  return pintar("Y tu contraseña.", "error");
      if (esAlta && clave.length < 8)
        return pintar("La contraseña se queda corta: mínimo 8 caracteres.", "error");

      boton.disabled = true;
      boton.textContent = "Un momento…";

      const r = esAlta ? await darseDeAlta(correo, clave) : await entrar(correo, clave);

      if (!r.ok) return pintar(r.mensaje, "error");
      if (esAlta) return pintar(r.mensaje, "aviso");
      alEntrar();
    });

    contenedor.querySelector("#clave").addEventListener("keydown", e => {
      if (e.key === "Enter") boton.click();
    });
  }

  pintar();
}
