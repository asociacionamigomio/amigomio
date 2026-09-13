/* ============================================================
   Mi ficha: los datos del cliente.

   No es un formulario de registro cualquiera. Lo que se pide
   aquí es lo que el libro de registro del núcleo zoológico
   obliga a anotar de cada propietario.
   ============================================================ */
import { validarFichaCliente } from "../ficha.js";
import { t } from "../idioma.js";
import { miFicha, guardarMiFicha, subirFoto, verFoto } from "../datos.js";
import { hayPush, esIphoneSinInstalar, encenderPush, apagarPush,
         pushEncendida } from "../push.js";

const esc = t => String(t ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export async function render(contenedor) {
  contenedor.innerHTML = `<p class="cargando">${t("Un momento…")}</p>`;

  let datos;
  try { datos = await miFicha(); }
  catch { contenedor.innerHTML = `<div class="error">${t("No hemos podido cargar tus datos.")}</div>`; return; }

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
      <h2>${t("Mi ficha")}</h2>
      ${aviso ? `<div class="${claseAviso}">${esc(aviso)}</div>` : ""}

      <div class="tarjeta">
        <p class="rotulo">${t("Tu foto")}</p>
        <div class="foto-perfil">
          <div class="avatar grande" id="mi-avatar">👤</div>
          <label class="boton fantasma pequeno subir">
            ${t(datos.foto ? "Cambiar la foto" : "Poner una foto")}
            <input type="file" accept="image/*" id="mi-foto" hidden>
          </label>
        </div>
        <p class="flojo">${t("No hace falta, pero ayuda a que os reconozcáis.")}</p>
      </div>

      <div class="tarjeta">
        <p class="flojo">${t("Estos datos no son curiosidad nuestra: la ley nos obliga a anotarlos en el libro de registro de la residencia.")}</p>

        ${campo("nombre", t("Nombre"), { pista: "Santiago" })}
        ${campo("apellidos", t("Apellidos"), { pista: "Díaz Fandiño" })}
        ${campo("dni", t("DNI o NIE"), { pista: "12345678Z" })}
        ${campo("domicilio", t("Dirección"), { pista: t("Calle, número, población") })}
        ${campo("telefono", t("Teléfono"), { tipo: "tel", modo: "tel", pista: "600 00 00 00" })}

        <h4>${t("¿Puede recogerlo alguien más?")}</h4>
        <p class="flojo">${t("Opcional. Si lo rellenas, a esa persona se le pide el DNI al entregarle el perro. Si no, solo te lo entregamos a ti.")}</p>
        ${campo("recoge_nombre", t("Su nombre y apellidos"), { pista: "María López" })}
        ${campo("recoge_dni", t("Su DNI"), { pista: "87654321X" })}

        <label class="casilla">
          <input type="checkbox" data-campo="consiente_datos" ${datos.consiente_datos ? "checked" : ""}>
          <span>${t("Acepto que AmigoMío guarde estos datos y los de mis perros para gestionar las estancias y llevar el libro de registro que exige la normativa.")}
            <br><span class="flojo">${t("Puedes pedirnos que los borremos cuando quieras.")}</span></span>
        </label>
        ${error("consiente_datos")}

        <label class="casilla">
          <input type="checkbox" data-campo="quiere_correos"
                 ${datos.quiere_correos !== false ? "checked" : ""}>
          <span>${t("Avisadme por correo de lo importante: si a mi perro le caduca algo de la cartilla, si falta el justificante de una reserva, o el recordatorio de la víspera.")}
            <br><span class="flojo">${t("Si lo quitas dejamos de escribirte. Nada más: las reservas siguen igual.")}</span></span>
        </label>

        <label class="casilla">
          <input type="checkbox" data-campo="perfil_visible"
                 ${datos.perfil_visible ? "checked" : ""}>
          <span>${t("Que los demás clientes de AmigoMío puedan ver mi perfil.")}
            <br><span class="flojo">${t("Verían tu nombre de pila, tu foto y tus perros (nombre, raza y foto). No verían tus apellidos, ni tu DNI, ni tu dirección, ni tu teléfono, ni el chip de tus perros, ni sus datos de salud. Puedes quitarlo cuando quieras.")}</span></span>
        </label>

        <div class="avisos-movil">
          <p class="rotulo">${t("Avisarme en el móvil")}</p>
          <p class="flojo">${t("Lo mismo que te contamos por correo, pero en el momento: si a tu perro le caduca algo, si falta el justificante de una reserva o la víspera de la entrada.")}</p>
          <div id="estado-push"><p class="flojo">${t("Un momento…")}</p></div>
        </div>

        <button class="boton" id="guardar">${t("Guardar")}</button>
      </div>`;

    contenedor.querySelector("#guardar").addEventListener("click", guardar);

    pintarPush();

    /* Los avisos en el móvil.

       El permiso SE PIDE UNA SOLA VEZ EN LA VIDA: si dice que
       no, el navegador no vuelve a preguntar y desde aquí no hay
       forma de insistir. Por eso no se pide al entrar, cuando no
       sabe de qué va, sino cuando toca este botón. */
    async function pintarPush(aviso = "", clase = "aviso") {
      const hueco = contenedor.querySelector("#estado-push");
      if (!hueco) return;

      if (!hayPush()) {
        hueco.innerHTML = `<p class="flojo">${t("Este navegador no sabe mandar avisos al móvil. Seguirás recibiendo los correos.")}</p>`;
        return;
      }

      if (esIphoneSinInstalar()) {
        hueco.innerHTML = `<div class="aviso">
          <strong>${t("En iPhone hay que instalar la aplicación primero.")}</strong>
          ${t("Toca el botón de Compartir y luego «Añadir a pantalla de inicio». Ábrela desde ahí y aquí te saldrá el botón.")}
          <br><span class="flojo">${t("Es cosa de Apple, no nuestra: en Safari normal no deja.")}</span></div>`;
        return;
      }

      const encendida = await pushEncendida();

      hueco.innerHTML = `
        ${aviso ? `<div class="${clase}">${esc(aviso)}</div>` : ""}
        ${encendida
          ? `<p class="flojo">${t("Encendidos en este móvil. ✓")}</p>
             <button class="boton fantasma pequeno" id="push-no">${t("Quitar los avisos")}</button>`
          : `<button class="boton pequeno" id="push-si">${t("Avisarme en este móvil")}</button>
             <p class="flojo">${t("Se enciende en cada móvil por separado.")}</p>`}`;

      hueco.querySelector("#push-si")?.addEventListener("click", async e => {
        e.target.disabled = true;
        const r = await encenderPush();
        await pintarPush(r.mensaje, r.ok ? "aviso" : "error");
      });

      hueco.querySelector("#push-no")?.addEventListener("click", async e => {
        e.target.disabled = true;
        const r = await apagarPush();
        await pintarPush(r.mensaje, "aviso");
      });
    }

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
