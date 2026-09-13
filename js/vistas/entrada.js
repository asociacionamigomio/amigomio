/* ============================================================
   La puerta: entrar o darse de alta.

   El registro es abierto, sin invitación. Lo que hace de barrera
   es confirmar el correo, y eso se explica aquí mismo para que
   nadie se quede esperando sin saber qué pasa.
   ============================================================ */
import { entrar, darseDeAlta, recuperarContrasena } from "../sesion.js";
import { t } from "../idioma.js";

export function render(contenedor, { alEntrar }) {
  let modo = "entrar";   // "alta" · "olvidada"

  function pintar(aviso = "", clase = "aviso") {
    const esAlta = modo === "alta";
    const esOlvidada = modo === "olvidada";

    /* Quien ha olvidado la contraseña no tiene que ver un campo
       de contraseña: sólo el correo. Pedirle la que no recuerda
       es lo que más desespera de estas pantallas. */
    if (esOlvidada) return pintarOlvidada(aviso, clase);
    contenedor.innerHTML = `
      <div class="portada">
        <img src="assets/logo.png" alt="AmigoMío" class="logo">
        <p class="lema">${t("Tu mejor amig@ también se va de vacaciones")}</p>
      </div>

      <div class="tarjeta">
        <h2>${t(esAlta ? "Crear una cuenta" : "Entrar")}</h2>

        ${aviso ? `<div class="${clase}">${aviso}</div>` : ""}

        <label for="correo">${t("Tu correo")}</label>
        <input id="correo" type="email" autocomplete="email" inputmode="email"
               placeholder="tucorreo@ejemplo.com">

        <label for="clave">${t("Tu contraseña")}</label>
        <input id="clave" type="password"
               autocomplete="${esAlta ? "new-password" : "current-password"}"
               placeholder="${esAlta ? t("Al menos 8 caracteres") : ""}">

        <button class="boton" id="enviar">
          ${t(esAlta ? "Crear cuenta" : "Entrar")}
        </button>

        <p class="cambiar">
          ${t(esAlta ? "¿Ya tienes cuenta?" : "¿Primera vez por aquí?")}
          <a href="#" id="cambiar">${t(esAlta ? "Entrar" : "Crear una cuenta")}</a>
        </p>

        ${esAlta ? "" : `
          <p class="cambiar">
            <a href="#" id="olvidada">${t("He olvidado la contraseña")}</a>
          </p>`}

        <div id="hueco-instalar"></div>
      </div>`;

    contenedor.querySelector("#olvidada")?.addEventListener("click", e => {
      e.preventDefault();
      modo = "olvidada";
      pintar();
    });

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

  /* Sólo el correo. Pedirle la contraseña a quien ha venido
     porque no la recuerda es lo que más desespera de estas
     pantallas. */
  function pintarOlvidada(aviso, clase) {
    contenedor.innerHTML = `
      <div class="portada">
        <img src="assets/logo.png" alt="AmigoMío" class="logo">
      </div>

      <div class="tarjeta">
        <h2>${t("He olvidado la contraseña")}</h2>
        <p class="flojo">${t("Dinos tu correo y te mandamos un enlace para poner una nueva.")}</p>

        ${aviso ? `<div class="${clase}">${aviso}</div>` : ""}

        <label for="correo">${t("Tu correo")}</label>
        <input id="correo" type="email" autocomplete="email" inputmode="email"
               placeholder="tucorreo@ejemplo.com">

        <button class="boton" id="enviar">${t("Mándame el enlace")}</button>

        <p class="cambiar"><a href="#" id="cambiar">${t("Volver a entrar")}</a></p>

        <div id="hueco-instalar"></div>
      </div>`;

    contenedor.querySelector("#cambiar").addEventListener("click", e => {
      e.preventDefault();
      modo = "entrar";
      pintar();
    });

    const boton = contenedor.querySelector("#enviar");
    const caja = contenedor.querySelector("#correo");

    const pedir = async () => {
      const correo = caja.value.trim();
      if (!correo) return pintar("Nos falta tu correo.", "error");

      boton.disabled = true;
      boton.textContent = "Un momento…";
      const r = await recuperarContrasena(correo);
      pintar(r.mensaje, r.ok ? "aviso" : "error");
    };

    boton.addEventListener("click", pedir);
    caja.addEventListener("keydown", e => { if (e.key === "Enter") pedir(); });
  }

  pintar();
}
