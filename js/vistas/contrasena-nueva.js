/* ============================================================
   La contraseña nueva.

   Se llega aquí desde el enlace del correo, y sólo desde ahí:
   Supabase deja la sesión abierta un rato para que se pueda
   cambiar.

   Se pide DOS VECES a propósito. Escribirla mal en la única
   oportunidad que hay deja al cliente fuera otra vez, y el
   enlace del correo ya está gastado: tendría que pedir otro y
   volver a empezar.
   ============================================================ */
import { cambiarContrasena } from "../sesion.js";

const esc = t => String(t ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const MINIMO = 8;

export function render(contenedor, { cuandoTermine } = {}) {
  pintar();

  function pintar(aviso = "", clase = "error") {
    contenedor.innerHTML = `
      <div class="portada"><img src="assets/logo.png" alt="AmigoMío" class="logo"></div>

      <div class="tarjeta">
        <h2>Una contraseña nueva</h2>
        <p class="flojo">Escríbela dos veces, para que no se cuele una errata.
           Mínimo ${MINIMO} caracteres.</p>

        ${aviso ? `<div class="${clase}">${esc(aviso)}</div>` : ""}

        <label for="c1">La contraseña nueva</label>
        <input type="password" id="c1" autocomplete="new-password">

        <label for="c2">Otra vez</label>
        <input type="password" id="c2" autocomplete="new-password">

        <button class="boton" id="guardar">Guardar y entrar</button>
      </div>`;

    const c1 = contenedor.querySelector("#c1");
    const c2 = contenedor.querySelector("#c2");

    const guardar = async () => {
      const una = c1.value;
      const otra = c2.value;

      if (una.length < MINIMO)
        return pintar(`La contraseña se queda corta: mínimo ${MINIMO} caracteres.`);
      if (una !== otra)
        return pintar("Las dos no coinciden. Míralas otra vez.");

      const boton = contenedor.querySelector("#guardar");
      boton.disabled = true;
      const r = await cambiarContrasena(una);
      if (!r.ok) return pintar(r.mensaje);

      cuandoTermine?.();
    };

    contenedor.querySelector("#guardar").addEventListener("click", guardar);
    /* Enter en el segundo campo guarda: es lo que hace todo el
       mundo sin pensar. */
    c2.addEventListener("keydown", e => { if (e.key === "Enter") guardar(); });
  }
}
