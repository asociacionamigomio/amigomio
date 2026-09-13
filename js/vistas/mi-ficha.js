/* ============================================================
   Mi ficha: los datos del cliente.

   No es un formulario de registro cualquiera. Lo que se pide
   aquí es lo que el libro de registro del núcleo zoológico
   obliga a anotar de cada propietario.
   ============================================================ */
import { validarFichaCliente } from "../ficha.js";
import { miFicha, guardarMiFicha, subirFoto, verFoto } from "../datos.js";

const esc = t => String(t ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export async function render(contenedor) {
  contenedor.innerHTML = `<p class="cargando">Un momento…</p>`;

  let datos;
  try { datos = await miFicha(); }
  catch { contenedor.innerHTML = `<div class="error">No hemos podido cargar tus datos.</div>`; return; }

  pintar();

  function pintar(faltan = [], aviso = "", claseAviso = "aviso") {
    const error = campo => {
      const f = faltan.find(x => x.campo === campo);
      return f ? `<p class="error-campo">${esc(f.mensaje)}</p>` : "";
    };
    const campo = (id, etiqueta, opciones = {}) => `
      <label for="${id}">${etiqueta}</label>
      <input id="${id}" data-campo="${id}" value="${esc(datos[id])}"
             ${opciones.tipo ? `type="${opciones.tipo}"` : ""}
             ${opciones.pista ? `placeholder="${esc(opciones.pista)}"` : ""}
             ${opciones.modo ? `inputmode="${opciones.modo}"` : ""}>
      ${error(id)}`;

    contenedor.innerHTML = `
      <h2>Mi ficha</h2>
      ${aviso ? `<div class="${claseAviso}">${esc(aviso)}</div>` : ""}

      <div class="tarjeta">
        <p class="rotulo">Tu foto</p>
        <div class="foto-perfil">
          <div class="avatar grande" id="mi-avatar">👤</div>
          <label class="boton fantasma pequeno subir">
            ${datos.foto ? "Cambiar la foto" : "Poner una foto"}
            <input type="file" accept="image/*" id="mi-foto" hidden>
          </label>
        </div>
        <p class="flojo">No hace falta, pero ayuda a que os reconozcáis.</p>
      </div>

      <div class="tarjeta">
        <p class="flojo">Estos datos no son curiosidad nuestra: la ley nos obliga a anotarlos
           en el libro de registro de la residencia.</p>

        ${campo("nombre", "Nombre", { pista: "Santiago" })}
        ${campo("apellidos", "Apellidos", { pista: "Díaz Fandiño" })}
        ${campo("dni", "DNI o NIE", { pista: "12345678Z" })}
        ${campo("domicilio", "Dirección", { pista: "Calle, número, población" })}
        ${campo("telefono", "Teléfono", { tipo: "tel", modo: "tel", pista: "600 00 00 00" })}

        <h4>¿Puede recogerlo alguien más?</h4>
        <p class="flojo">Opcional. Si lo rellenas, a esa persona se le pide el DNI al entregarle
           el perro. Si no, solo te lo entregamos a ti.</p>
        ${campo("recoge_nombre", "Su nombre y apellidos", { pista: "María López" })}
        ${campo("recoge_dni", "Su DNI", { pista: "87654321X" })}

        <label class="casilla">
          <input type="checkbox" data-campo="consiente_datos" ${datos.consiente_datos ? "checked" : ""}>
          <span>Acepto que AmigoMío guarde estos datos y los de mis perros para gestionar las
            estancias y llevar el libro de registro que exige la normativa.
            <br><span class="flojo">Puedes pedirnos que los borremos cuando quieras.</span></span>
        </label>
        ${error("consiente_datos")}

        <label class="casilla">
          <input type="checkbox" data-campo="quiere_correos"
                 ${datos.quiere_correos !== false ? "checked" : ""}>
          <span>Avisadme por correo de lo importante: si a mi perro le caduca algo de
            la cartilla, si falta el justificante de una reserva, o el recordatorio
            de la víspera.
            <br><span class="flojo">Si lo quitas dejamos de escribirte. Nada más:
              las reservas siguen igual.</span></span>
        </label>

        <label class="casilla">
          <input type="checkbox" data-campo="perfil_visible"
                 ${datos.perfil_visible ? "checked" : ""}>
          <span>Que los demás clientes de AmigoMío puedan ver mi perfil.
            <br><span class="flojo">Verían <strong>tu nombre de pila, tu foto y
              tus perros</strong> (nombre, raza y foto). No verían tus apellidos,
              ni tu DNI, ni tu dirección, ni tu teléfono, ni el chip de tus perros,
              ni sus datos de salud. Puedes quitarlo cuando quieras.</span></span>
        </label>

        <button class="boton" id="guardar">Guardar</button>
      </div>`;

    contenedor.querySelector("#guardar").addEventListener("click", guardar);

    /* La foto se sube y se guarda al momento, sin esperar al
       botón: subirla y que luego se pierda porque se salió de la
       pantalla sería para tirar el móvil. */
    const entradaFoto = contenedor.querySelector("#mi-foto");
    entradaFoto?.addEventListener("change", async () => {
      const fichero = entradaFoto.files?.[0];
      if (!fichero) return;

      const etiqueta = entradaFoto.closest("label");
      etiqueta.textContent = "Subiendo…";

      const r = await subirFoto(fichero, "perfil");
      if (!r.ok) return pintar(r.mensaje, "error");

      datos.foto = r.ruta;
      const g = await guardarMiFicha({ ...datos, foto: r.ruta });
      pintar(g.ok ? "Foto guardada." : g.mensaje, g.ok ? "aviso" : "error");
    });

    /* Y se pinta la que ya tuviera. El cubo es privado, así que
       el enlace hay que pedirlo. */
    if (datos.foto) {
      verFoto(datos.foto).then(url => {
        const hueco = contenedor.querySelector("#mi-avatar");
        if (url && hueco) hueco.innerHTML = `<img src="${url}" alt="">`;
      });
    }
  }

  async function guardar() {
    contenedor.querySelectorAll("[data-campo]").forEach(el => {
      datos[el.dataset.campo] = el.type === "checkbox" ? el.checked : el.value;
    });

    const r = validarFichaCliente(datos);
    if (!r.ok) return pintar(r.faltan, "Nos falta alguna cosa.", "error");

    const g = await guardarMiFicha(datos);
    pintar([], g.ok ? "Guardado. Gracias." : g.mensaje, g.ok ? "aviso" : "error");
  }
}
