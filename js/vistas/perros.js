/* ============================================================
   Mis perros: la lista y el alta en tres pasos.

   El alta se puede guardar a medias (borrador). Es el formulario
   más largo de la app y de una sentada la gente lo abandona.
   ============================================================ */
import { PASOS, validarPaso } from "../formularios.js";
import { misPerros, guardarPerro, unPerro, borrarPerro, pedirCambio, misSolicitudes,
         documentosDe, subirDocumento, borrarDocumento, verDocumento,
         subirFoto, verFoto, miFicha } from "../datos.js";
import { enlaceWhatsAppA } from "../contacto.js";
import { tiposPara, tipoDocumento } from "../documentos.js";
import { camposSanidad, PRODUCTOS_EXTERNOS, diasDeAvisoDe,
         avisosDelPerro, caducidadDe, enCristiano } from "../sanidad.js";
import { chipValido } from "../perro.js";

/* Tope de todas las fechas del formulario. En la base hay un
   «20206-12-01» —un año de cinco cifras— porque un
   `<input type="date"` sin tope lo acepta tan tranquilo, y de
   ahí salían avisos que decían «vence el NaN de undefined». */
const TOPE_FECHA = "2100-12-31";

const esc = t => String(t ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ------------------------------------------------------------
   Lista
   ------------------------------------------------------------ */
export async function render(contenedor) {
  contenedor.innerHTML = `<p class="cargando">Buscando a tus perros…</p>`;
  let perros = [];
  try { perros = await misPerros(); }
  catch { contenedor.innerHTML = `<div class="error">No hemos podido cargar tus perros.</div>`; return; }

  contenedor.innerHTML = `
    <div class="cabecera-seccion">
      <h2>Mis perros</h2>
      <button class="boton" id="nuevo">Dar de alta un perro</button>
    </div>
    ${perros.length === 0
      ? `<div class="tarjeta vacio">
           <p>Todavía no nos has presentado a nadie.</p>
           <p class="flojo">Da de alta a tu perro y ya no tendrás que repetir
              sus datos cada vez que reserves.</p>
         </div>`
      : `<div class="lista-perros">${perros.map(tarjetaPerro).join("")}</div>`}`;

  contenedor.querySelector("#nuevo").addEventListener("click",
    () => formulario(contenedor, null));

  contenedor.querySelectorAll("[data-abrir]").forEach(el =>
    el.addEventListener("click", () => ficha(contenedor, el.dataset.abrir)));
}

function tarjetaPerro(p) {
  const edad = p.fecha_nacimiento
    ? new Date(p.fecha_nacimiento).getFullYear() : "";
  return `
    <div class="tarjeta perro" data-abrir="${p.id}">
      <div class="avatar">${p.foto ? `<img src="${esc(p.foto)}" alt="">` : "🐕"}</div>
      <div>
        <h3>${esc(p.nombre)} ${p.borrador ? `<span class="etiqueta">a medias</span>` : ""}</h3>
        <p class="flojo">${esc(p.raza) || "Sin raza anotada"}${edad ? ` · ${edad}` : ""}</p>
        <p class="flojo chip">Chip ${esc(p.chip)}</p>
      </div>
    </div>`;
}

/* ------------------------------------------------------------
   LA FICHA DEL PERRO

   Lo que se ve al pinchar en la lista: cómo está, qué le caduca
   y qué hay que saber de él. Editar es otra cosa y va detrás de
   un botón: entrar a mirar cómo está tu perro y que te salte un
   formulario de tres pasos es agresivo.
   ------------------------------------------------------------ */
async function ficha(contenedor, id, { volverA = null } = {}) {
  contenedor.innerHTML = `<p class="cargando">Un momento…</p>`;

  const d = await unPerro(id);
  if (!d) { contenedor.innerHTML = `<div class="error">No encontramos ese perro.</div>`; return; }

  let papeles = await documentosDe(id);
  /* Quién está mirando: el bloque de escribirle al dueño es sólo
     para administración. Un cliente no tiene por qué ver el
     teléfono de nadie en esta pantalla. */
  /* Si esto falla, la pantalla NO puede limitarse a esconder las
     cosas de administración como si no fueras administrador.

     El 13/09/2026 `miFicha()` estuvo toda la tarde fallando por un
     permiso de columna, y el efecto aquí fue que desapareció el
     botón de escribirle al dueño por WhatsApp — sin decir nada, y
     sin que se pareciera en nada a la causa. Una función que se
     esconde por un fallo se busca durante horas. */
  let quienMira = null;
  let noSeSabeQuienMira = false;
  try { quienMira = await miFicha(); }
  catch (e) {
    noSeSabeQuienMira = true;
    console.error("[AmigoMío] no se pudo saber quién mira la ficha:", e);
    window.apuntarElFallo?.("al abrir la ficha de un perro", e);
  }
  const avisos = avisosDelPerro(d);
  const campos = camposSanidad(d);
  const hoy = new Date().toISOString().slice(0, 10);

  const edad = d.fecha_nacimiento
    ? Math.floor((Date.now() - new Date(d.fecha_nacimiento)) / (365.25 * 86400000)) : null;

  const rasgos = [
    d.sexo === "hembra" ? "hembra" : d.sexo === "macho" ? "macho" : null,
    d.castrado ? "castrado" : null,
    { todos: "bien con todos los perros", machos: "solo con machos",
      hembras: "solo con hembras", ninguno: "mejor solo" }[d.sociable],
    { activo: "muy activo", sedentario: "tranquilo" }[d.actividad],
    d.timido ? "tímido" : null,
    d.comilon ? "comilón" : null,
    d.polidipsia ? "bebe muchísima agua" : null,
    d.destroyer ? "destroza cosas" : null,
  ].filter(Boolean);

  const filaSanidad = c => {
    const caduca = caducidadDe(c.id, (d.sanidad || {})[c.id]);
    const aviso = avisos.find(a => a.id === c.id);
    return `
      <div class="fila-sanidad ${aviso ? (aviso.estado === "caducado" ? "vencida" : "pronto") : ""}">
        <span>${esc(c.nombre)}${c.obligatorio ? "" : ' <em class="flojo">recomendada</em>'}</span>
        <strong>${c.fecha ? (caduca ? `hasta el ${enCristiano(caduca)}` : "puesta") : "sin fecha"}</strong>
      </div>`;
  };

  contenedor.innerHTML = `
    <div class="cabecera-seccion">
      <button class="boton fantasma pequeno" id="volver">← ${
        volverA ? "Volver" : "Mis perros"}</button>
      <button class="boton pequeno" id="editar">Editar</button>
    </div>

    <div class="ficha-perro">
      <label class="avatar grande con-foto" title="Cambiar la foto">
        <span id="avatar-perro">🐕</span>
        <input type="file" accept="image/*" id="foto-perro" hidden>
      </label>
      <div>
        <h2>${esc(d.nombre)}</h2>
        <p class="flojo">${esc(d.raza) || "sin raza anotada"}${edad !== null ? ` · ${edad} ${edad === 1 ? "año" : "años"}` : ""}</p>
        <p class="flojo chip">Chip ${esc(d.chip)}</p>
      </div>
    </div>

    ${d.agresivo_con_personas ? `
      <div class="error" style="margin-top:1rem">
        <strong>Manejo de peligrosidad.</strong> Va a alojamiento propio y siempre solo.
      </div>` : ""}

    ${avisos.length ? `
      <div class="tarjeta avisos-sanidad" style="margin-top:1rem">
        <h3>${avisos.length === 1 ? "Una cosa que caduca" : "Cosas que caducan"}</h3>
        <div class="lista-avisos">
          ${avisos.map(a => `
            <div class="aviso-linea ${a.estado === "caducado" ? "vencido" : ""}">
              <span class="punto"></span>
              <div><p>${esc(a.mensaje.replace(d.nombre + ": ", ""))}</p>
                   <span class="cuando">${a.dias < 0 ? "ya venció" : a.dias === 0 ? "vence hoy"
                     : a.dias === 1 ? "vence mañana" : `quedan ${a.dias} días`}</span></div>
            </div>`).join("")}
        </div>
      </div>` : `
      <div class="tarjeta" style="margin-top:1rem">
        <p class="flojo">Todo al día. No le caduca nada por ahora.</p>
      </div>`}

    ${rasgos.length ? `<div class="rasgos">${rasgos.map(r => `<span class="marca">${esc(r)}</span>`).join("")}</div>` : ""}

    <div class="atajos" style="grid-template-columns: 1fr">
      ${d.pautas_alimentacion ? `<div class="tarjeta"><p class="rotulo">Cómo come</p>
        <p>${esc(d.pautas_alimentacion)}</p></div>` : ""}
      ${d.cuidados ? `<div class="tarjeta"><p class="rotulo">Cuidados</p>
        <p>${esc(d.cuidados)}</p></div>` : ""}
    </div>

    <div class="tarjeta" style="margin-top:1rem">
      <p class="rotulo">Vacunas y desparasitaciones</p>
      <div class="tabla-sanidad">${campos.map(filaSanidad).join("")}</div>
    </div>

    ${(d.licencia_deportiva || d.es_ppp) ? `
      <div class="tarjeta" style="margin-top:1rem">
        <p class="rotulo">Papeles</p>
        ${d.licencia_deportiva ? `<p>Licencia deportiva <strong>${esc(d.licencia_deportiva)}</strong>${
          d.licencia_deportiva_hasta ? ` · hasta el ${enCristiano(d.licencia_deportiva_hasta)}` : ""}</p>` : ""}
        ${d.es_ppp ? `<p>Perro potencialmente peligroso${
          d.ppp_licencia_hasta ? ` · licencia hasta el ${enCristiano(d.ppp_licencia_hasta)}` : ""}${
          d.ppp_seguro_hasta ? ` · seguro hasta el ${enCristiano(d.ppp_seguro_hasta)}` : ""}</p>` : ""}
      </div>` : ""}

    ${quienMira?.es_admin ? bloqueWhatsApp(d) : ""}
    ${noSeSabeQuienMira ? `
      <div class="aviso" style="margin-top:1rem">
        No hemos podido traer tus datos, así que puede que falte algo en esta
        ficha. Suele ser la cobertura.
      </div>` : ""}

    <div id="papeles-perro"></div>`;

  /* La foto, que se sube y se guarda al momento. */
  if (d.foto) {
    verFoto(d.foto).then(url => {
      const hueco = contenedor.querySelector("#avatar-perro");
      if (url && hueco) hueco.innerHTML = `<img src="${url}" alt="">`;
    });
  }

  contenedor.querySelector("#foto-perro")?.addEventListener("change", async e => {
    const fichero = e.target.files?.[0];
    if (!fichero) return;
    const hueco = contenedor.querySelector("#avatar-perro");
    hueco.textContent = "…";

    const r = await subirFoto(fichero, id);
    if (!r.ok) { hueco.textContent = "🐕"; return; }

    await guardarPerro({ id, foto: r.ruta });
    ficha(contenedor, id, { volverA });
  });

  contenedor.querySelector("#volver").addEventListener("click",
    () => volverA ? window.irA?.(volverA) : render(contenedor));
  contenedor.querySelector("#editar").addEventListener("click", () => formulario(contenedor, id));

  engancharWhatsApp(d);
  pintarPapeles();

  /* Escribirle al dueño desde aquí.

     OJO CON LO DE LAS FOTOS, que no es un capricho de cómo está
     hecho: UN ENLACE DE WHATSAPP NO PUEDE LLEVAR FICHEROS. El
     `wa.me/...` sólo admite texto y no hay forma de rodearlo.

     Lo que sí funciona es el botón de compartir del propio
     móvil: se le pasa la foto al sistema, el sistema ofrece
     WhatsApp entre las opciones y va con la foto puesta. Es un
     toque más, y es el único camino que existe. */
  function bloqueWhatsApp(d) {
    const dueno = `${d.cliente?.nombre ?? ""} ${d.cliente?.apellidos ?? ""}`.trim();
    const url = enlaceWhatsAppA(d.cliente?.telefono,
      `Hola${dueno ? " " + d.cliente.nombre : ""}, te escribo de AmigoMío por ${d.nombre}. `);

    if (!url) return `
      <div class="tarjeta" style="margin-top:1rem">
        <p class="rotulo">Hablar con el dueño</p>
        <p class="flojo">No tenemos su teléfono en la ficha, así que no podemos
           escribirle desde aquí. Se lo puedes pedir y apuntarlo en
           <strong>Clientes</strong>.</p>
      </div>`;

    return `
      <div class="tarjeta whatsapp-dueno" style="margin-top:1rem">
        <p class="rotulo">Hablar con ${esc(dueno) || "el dueño"}</p>

        <div class="botonera">
          <a class="boton whatsapp" target="_blank" rel="noopener" href="${url}">
            Escribirle por WhatsApp
          </a>
          <label class="boton fantasma subir">
            Mandarle una foto o un vídeo
            <input type="file" accept="image/*,video/*" id="compartir" hidden multiple>
          </label>
        </div>

        <p class="flojo" id="aviso-compartir">Las fotos van por el botón de compartir
           del móvil: se elige WhatsApp ahí y se manda con la foto puesta.
           <strong>Desde el ordenador no suele funcionar</strong>, es cosa del navegador.</p>
      </div>`;
  }

  function engancharWhatsApp(d) {
    const entrada = contenedor.querySelector("#compartir");
    if (!entrada) return;

    entrada.addEventListener("change", async () => {
      const ficheros = [...(entrada.files || [])];
      if (!ficheros.length) return;

      const aviso = contenedor.querySelector("#aviso-compartir");

      /* Se pregunta ANTES de intentarlo: si el navegador no sabe
         compartir ficheros, pulsar y que no pase nada es lo peor
         que puede ocurrir. */
      if (!navigator.canShare?.({ files: ficheros })) {
        aviso.innerHTML = `<strong>Este navegador no sabe compartir ficheros.</strong>
          Ábrelo en el móvil y vuelve a intentarlo; desde el ordenador casi nunca
          se puede.`;
        aviso.classList.add("error-linea");
        return;
      }

      try {
        await navigator.share({
          files: ficheros,
          title: d.nombre,
          text: `${d.nombre}, desde AmigoMío`,
        });
      } catch {
        /* Cancelar el compartir tira un error. No es un fallo:
           es que ha cambiado de idea. */
      }
      entrada.value = "";
    });
  }

  /* La cartilla fotografiada. Es lo último de la ficha porque es
     VOLUNTARIO: quien no quiera, ni se entera. */
  function pintarPapeles(aviso = "", clase = "aviso") {
    const caja = contenedor.querySelector("#papeles-perro");
    if (!caja) return;
    const tipos = tiposPara(d);

    caja.innerHTML = `
      <div class="tarjeta papeles" style="margin-top:1rem">
        <p class="rotulo">La cartilla y los papeles</p>
        <p class="flojo">Si quieres, súbenos una foto de la cartilla. No hace falta
           —puedes reservar igual—, pero así lo tenemos todo aquí y no te lo
           volvemos a pedir.</p>

        ${aviso ? `<div class="${clase}">${esc(aviso)}</div>` : ""}

        <div class="lista-papeles">
          ${tipos.map(t => {
            const suyos = papeles.filter(x => x.tipo === t.id);
            return `
            <div class="papel ${suyos.length ? "puesto" : ""}">
              <div class="papel-que-es">
                <strong>${esc(t.nombre)}</strong>
                <span class="flojo">${esc(t.pista)}</span>
              </div>

              ${suyos.length ? `
                <div class="papel-subidos">
                  ${suyos.map(x => `
                    <span class="marca papel-uno">
                      <button class="enlace" data-ver="${x.id}">Ver</button>
                      <button class="enlace quitar" data-quitar="${x.id}"
                              aria-label="Quitar">×</button>
                    </span>`).join("")}
                </div>` : ""}

              <label class="boton fantasma pequeno subir">
                ${suyos.length ? "Añadir otra" : "Subir foto"}
                <input type="file" accept="image/*,application/pdf"
                       capture="environment" data-subir="${t.id}" hidden>
              </label>
            </div>`;
          }).join("")}
        </div>
      </div>`;

    caja.querySelectorAll("[data-subir]").forEach(entrada =>
      entrada.addEventListener("change", async () => {
        const fichero = entrada.files?.[0];
        if (!fichero) return;
        pintarPapeles(`Subiendo ${tipoDocumento(entrada.dataset.subir).nombre.toLowerCase()}…`, "aviso");
        const r = await subirDocumento(id, entrada.dataset.subir, fichero);
        papeles = await documentosDe(id);
        pintarPapeles(r.mensaje, r.ok ? "aviso" : "error");
      }));

    caja.querySelectorAll("[data-ver]").forEach(b =>
      b.addEventListener("click", async () => {
        const papel = papeles.find(x => x.id === b.dataset.ver);
        const url = await verDocumento(papel.ruta);
        if (url) window.open(url, "_blank", "noopener");
        else pintarPapeles("No hemos podido abrirlo. Inténtalo otra vez.", "error");
      }));

    caja.querySelectorAll("[data-quitar]").forEach(b =>
      b.addEventListener("click", async () => {
        const papel = papeles.find(x => x.id === b.dataset.quitar);
        const r = await borrarDocumento(papel.id, papel.ruta);
        papeles = await documentosDe(id);
        pintarPapeles(r.mensaje, r.ok ? "aviso" : "error");
      }));
  }
}

/* ------------------------------------------------------------
   Alta y edición, en tres pasos
   ------------------------------------------------------------ */
async function formulario(contenedor, id) {
  let datos = id ? (await unPerro(id)) || {} : { sociable: "todos", actividad: "normal", sanidad: {} };
  let paso = 0;
  const esNuevo = !datos.id;

  function pintar(faltan = [], aviso = "") {
    const p = PASOS[paso];
    const error = campo => {
      const f = faltan.find(x => x.campo === campo);
      return f ? `<p class="error-campo">${esc(f.mensaje)}</p>` : "";
    };

    contenedor.innerHTML = `
      <div class="cabecera-seccion">
        <h2>${esNuevo ? "Un perro nuevo" : esc(datos.nombre)}</h2>
        <button class="boton fantasma" id="volver">Volver</button>
      </div>

      <div class="pasos">
        ${PASOS.map((x, i) => `<span class="${i === paso ? "activo" : ""}">${i + 1}</span>`).join("")}
      </div>

      <div class="tarjeta">
        <h3>${p.titulo}</h3>
        ${aviso ? `<div class="aviso">${esc(aviso)}</div>` : ""}
        ${[cuerpoPaso0, cuerpoPaso1, cuerpoPaso2][paso](datos, error, esNuevo)}

        <div class="botonera">
          ${paso > 0 ? `<button class="boton fantasma" id="atras">Atrás</button>` : ""}
          <button class="boton" id="siguiente">
            ${paso < PASOS.length - 1 ? "Siguiente" : "Guardar"}
          </button>
        </div>
        <button class="enlace" id="luego">Guardar y seguir luego</button>
      </div>`;

    contenedor.querySelector("#volver").addEventListener("click", () => render(contenedor));
    contenedor.querySelector("#atras")?.addEventListener("click", () => { recoger(); paso--; pintar(); });
    contenedor.querySelector("#siguiente").addEventListener("click", siguiente);
    contenedor.querySelector("#luego").addEventListener("click", aMedias);

    contenedor.querySelector("#es_ppp")?.addEventListener("change", () => { recoger(); pintar(); });
    /* Añadir y quitar antiparasitarios repinta la lista. */
    contenedor.querySelector("#anadir-antiparasitario")?.addEventListener("click", () => {
      recoger();
      const s = datos.sanidad = datos.sanidad || {};
      const e = s.antiparasitario_externo = s.antiparasitario_externo || {};
      e.puestos = [...(e.puestos || []), { producto: "pipeta", fecha: "" }];
      pintar();
    });
    /* Cambiar «cómo sé cuándo caduca» cambia lo que se pregunta
       debajo, y borra la respuesta de la otra forma: si se
       quedara guardada, volvería a haber dos respuestas para la
       misma pregunta, que es justo lo que se venía a arreglar. */
    contenedor.querySelectorAll("[data-como]").forEach(sel =>
      sel.addEventListener("change", () => {
        const i = Number(sel.dataset.como);
        recoger();
        const puesto = datos.sanidad?.antiparasitario_externo?.puestos?.[i];
        if (puesto) {
          if (sel.value === "fecha") { puesto.duracionMeses = ""; puesto.validoHasta ||= ""; }
          else                       { delete puesto.validoHasta; }
        }
        pintar();
      }));

    contenedor.querySelectorAll(".quitar-antiparasitario").forEach(b =>
      b.addEventListener("click", () => {
        const fuera = Number(b.dataset.quitar);
        recoger();
        const e = datos.sanidad?.antiparasitario_externo;
        if (e?.puestos) e.puestos = e.puestos.filter((_, i) => i !== fuera);
        pintar();
      }));
    contenedor.querySelector("#tiene_licencia")
      ?.addEventListener("change", () => { recoger(); pintar(); });

    contenedor.querySelectorAll("[data-pedir]").forEach(b =>
      b.addEventListener("click", () => pedirCambioDe(b.dataset.pedir)));
  }

  /* El propietario no cambia el chip ni el nombre: los solicita.
     Lo impide el trigger de la base de datos, así que esto no es
     un adorno de pantalla. */
  function pedirCambioDe(campo) {
    const comoSeLlama = campo === "chip" ? "el número de chip" : "el nombre";
    const actual = datos[campo];

    contenedor.innerHTML = `
      <div class="cabecera-seccion">
        <h2>Pedir un cambio</h2>
        <button class="boton fantasma" id="cancelar">Cancelar</button>
      </div>
      <div class="tarjeta">
        <p>Quieres cambiar <strong>${comoSeLlama}</strong> de ${esc(datos.nombre)}.
           Lo miramos y te decimos algo; mientras tanto, no cambia nada.</p>

        <label>Ahora pone</label>
        <input value="${esc(actual)}" disabled>

        <label for="nuevo">Y tendría que poner</label>
        <input id="nuevo" ${campo === "chip" ? 'inputmode="numeric"' : ""}>
        <p class="error-campo" id="pega"></p>

        <label for="motivo">¿Qué ha pasado? (opcional)</label>
        <textarea id="motivo" rows="3"
          placeholder="${campo === "chip"
            ? "Me equivoqué al copiarlo de la cartilla."
            : "Lo apunté con una falta."}"></textarea>

        <button class="boton" id="enviar">Enviar la solicitud</button>
      </div>`;

    contenedor.querySelector("#cancelar").addEventListener("click", () => pintar());

    contenedor.querySelector("#enviar").addEventListener("click", async () => {
      const valorNuevo = contenedor.querySelector("#nuevo").value.trim();
      const pega = contenedor.querySelector("#pega");

      if (!valorNuevo) { pega.textContent = "Dinos qué tendría que poner."; return; }
      if (valorNuevo === actual) { pega.textContent = "Eso es justo lo que pone ya."; return; }
      if (campo === "chip" && !chipValido(valorNuevo)) {
        pega.textContent = "Ese chip no cuadra: son 15 dígitos seguidos."; return;
      }

      const r = await pedirCambio({
        perroId: datos.id, campo,
        valorActual: actual, valorNuevo,
        motivo: contenedor.querySelector("#motivo").value.trim(),
      });

      if (!r.ok) { pega.textContent = r.mensaje; return; }
      pintar([], r.mensaje);
    });
  }

  /* Recoge lo escrito en pantalla y lo mete en `datos`. */
  function recoger() {
    contenedor.querySelectorAll("[data-campo]").forEach(el => {
      const c = el.dataset.campo;
      datos[c] = el.type === "checkbox" ? el.checked : el.value;
    });
    const sanidad = { ...(datos.sanidad || {}) };
    contenedor.querySelectorAll("[data-sanidad]").forEach(el => {
      const trozos = el.dataset.sanidad.split(":");
      const valor = el.type === "checkbox" ? el.checked
                  : el.type === "number"   ? (el.value === "" ? "" : Number(el.value))
                  : el.value;

      /* Dos formas: "rabia:fecha" y, para los antiparasitarios,
         que van en lista, "antiparasitario_externo:puestos:0:fecha". */
      if (trozos.length === 4) {
        const [id, lista, i, prop] = trozos;
        sanidad[id] = { ...(sanidad[id] || {}) };
        sanidad[id][lista] = (sanidad[id][lista] || []).slice();
        sanidad[id][lista][i] = { ...(sanidad[id][lista][i] || {}), [prop]: valor };
        return;
      }
      const [id, prop] = trozos;
      sanidad[id] = sanidad[id] || {};
      sanidad[id][prop] = valor;
    });

    /* Lo que se puso en blanco no se guarda: una lista con una
       línea vacía haría creer que lleva algo puesto. */
    const externo = sanidad.antiparasitario_externo;
    if (externo?.puestos) {
      externo.puestos = externo.puestos.filter(x => x?.fecha || x?.validoHasta);
      /* Una fecha de caducidad en blanco no se guarda: si se
         guardara como "", el formulario creería que el dueño
         eligió «lo pone en la caja» y le seguiría preguntando
         por una fecha que no tiene. */
      for (const x of externo.puestos) if (x.validoHasta === "") delete x.validoHasta;
      delete externo.producto;   // resto de cuando era uno solo
      delete externo.fecha;
      delete externo.validoHasta;
    }
    if (Object.keys(sanidad).length) datos.sanidad = sanidad;
  }

  async function siguiente() {
    recoger();
    const r = validarPaso(paso, datos);
    if (!r.ok) return pintar(r.faltan);

    if (paso < PASOS.length - 1) { paso++; return pintar(); }

    const g = await guardarPerro(limpiar(datos), { borrador: false });
    if (!g.ok) return pintar([], g.mensaje);
    /* De vuelta a su ficha, no a la lista: acabas de editar ESTE
       perro y lo que quieres es ver cómo ha quedado. */
    if (g.id) ficha(contenedor, g.id); else render(contenedor);
  }

  async function aMedias() {
    recoger();
    /* Para guardar a medias sólo hace falta lo mínimo que la base
       de datos exige: chip y nombre. El resto puede faltar. */
    const r = validarPaso(0, datos);
    const imprescindible = r.faltan.filter(f => f.campo === "chip" || f.campo === "nombre");
    if (imprescindible.length)
      return pintar(imprescindible, "Para poder guardarlo a medias nos hace falta al menos esto.");

    const g = await guardarPerro(limpiar(datos), { borrador: true });
    if (!g.ok) return pintar([], g.mensaje);
    render(contenedor);
  }

  pintar();   // sin esto se define todo y no se pinta nada
}

/* Quita lo que no es columna de la tabla. */
function limpiar(d) {
  /* `tiene_licencia` es solo para la pantalla: decide si se
     pregunta el número. No es columna de la tabla. */
  const fuera = new Set(["foto_archivo", "tiene_licencia"]);
  const salida = {};
  for (const [k, v] of Object.entries(d)) if (!fuera.has(k)) salida[k] = v === "" ? null : v;
  /* Los textos vacíos son '' en la base, no null. */
  for (const k of ["raza", "capa", "estado_reproductivo", "pautas_alimentacion",
                   "cuidados", "licencia_deportiva", "incidentes_con_personas"])
    if (salida[k] == null) salida[k] = "";
  return salida;
}

/* ------------------------------------------------------------
   Los tres pasos
   ------------------------------------------------------------ */
function cuerpoPaso0(d, error, esNuevo) {
  return `
    <label for="nombre">Nombre</label>
    ${esNuevo
      ? `<input id="nombre" data-campo="nombre" value="${esc(d.nombre)}" placeholder="Luna">`
      : `<input value="${esc(d.nombre)}" disabled>
         <button class="enlace" data-pedir="nombre">Pedir que lo cambiemos</button>`}
    ${error("nombre")}

    <label for="chip">Número de chip</label>
    ${esNuevo
      ? `<input id="chip" data-campo="chip" inputmode="numeric"
                value="${esc(d.chip)}" placeholder="941 0000 1234 5678">`
      : `<input value="${esc(d.chip)}" disabled>
         <button class="enlace" data-pedir="chip">Pedir que lo cambiemos</button>
         <p class="flojo">El nombre y el chip solo se cambian con nuestro visto bueno:
            son los datos con los que identificamos a tu perro.</p>`}
    ${error("chip")}

    <label for="fecha_nacimiento">Fecha de nacimiento</label>
    <input id="fecha_nacimiento" type="date" data-campo="fecha_nacimiento"
           value="${esc(d.fecha_nacimiento)}">
    ${error("fecha_nacimiento")}

    <label for="sexo">Sexo</label>
    <select id="sexo" data-campo="sexo">
      <option value="">Elige…</option>
      <option value="macho"  ${d.sexo === "macho"  ? "selected" : ""}>Macho</option>
      <option value="hembra" ${d.sexo === "hembra" ? "selected" : ""}>Hembra</option>
    </select>
    ${error("sexo")}

    <label for="raza">Raza</label>
    <input id="raza" data-campo="raza" value="${esc(d.raza)}" placeholder="Pastor belga malinois">

    <label for="capa">Capa</label>
    <input id="capa" data-campo="capa" value="${esc(d.capa)}" placeholder="Carbonado">

    <label class="casilla">
      <input type="checkbox" data-campo="castrado" ${d.castrado ? "checked" : ""}>
      Está castrado o esterilizado
    </label>`;
}

/* Un perro puede llevar varias cosas puestas a la vez —el collar
   para el mosquito y la pipeta para pulgas y garrapatas—, así que
   esto es una lista y no un hueco. De cada uno se dice cuándo se
   le puso y, si no es de los de siempre, o cuántos meses dura o
   hasta cuándo vale. Está protegido mientras le quede alguno. */
function antiparasitarios(c) {
  const uno = (x, i) => {
    /* CÓMO se sabe cuándo caduca: una cosa O la otra.

       Antes se preguntaban las dos —«y dura ___ meses» y «o
       caduca el ___»— sin decir cuál manda. En la ficha real de
       Santiago acabó habiendo un collar puesto el 13/09 que
       «dura 2 meses» Y «caduca el 20/09»: dos respuestas
       distintas para la misma pregunta, y sólo vale una.
       Preguntar dos cosas para quedarse con una es una trampa. */
    const porFecha = !!x.validoHasta;
    const suyo = PRODUCTOS_EXTERNOS[x.producto];
    const caduca = caducidadDe("antiparasitario_externo", { puestos: [x] });

    return `
    <div class="antiparasitario">
      <select data-sanidad="antiparasitario_externo:puestos:${i}:producto">
        ${Object.entries(PRODUCTOS_EXTERNOS).map(([id, p]) => `
          <option value="${id}" ${x.producto === id ? "selected" : ""}>
            ${esc(p.nombre)}${p.meses ? ` · dura ${p.meses} ${p.meses === 1 ? "mes" : "meses"}` : ""}
          </option>`).join("")}
      </select>

      <label class="mini">Se lo puse el
        <input type="date" max="${TOPE_FECHA}"
               data-sanidad="antiparasitario_externo:puestos:${i}:fecha"
               value="${esc(x.fecha)}"></label>

      <label class="mini">y sé cuándo caduca
        <select class="como-caduca" data-como="${i}">
          <option value="dura" ${porFecha ? "" : "selected"}>porque dura un tiempo</option>
          <option value="fecha" ${porFecha ? "selected" : ""}>porque lo pone en la caja</option>
        </select>
      </label>

      ${porFecha ? `
        <label class="mini">Caduca el
          <input type="date" max="${TOPE_FECHA}"
                 data-sanidad="antiparasitario_externo:puestos:${i}:validoHasta"
                 value="${esc(x.validoHasta)}"></label>` : `
        <label class="mini">Dura
          <input type="number" min="1" max="24" class="dias"
                 data-sanidad="antiparasitario_externo:puestos:${i}:duracionMeses"
                 value="${esc(x.duracionMeses)}"
                 placeholder="${suyo?.meses ?? ""}">
          meses${suyo?.meses ? ` <span class="flojo">(en blanco, ${suyo.meses})</span>` : ""}</label>`}

      ${caduca ? `<p class="calculado">Le caduca el <strong>${enCristiano(caduca)}</strong>.</p>`
               : x.fecha ? `<p class="calculado flojo">Nos falta saber cuánto dura.</p>` : ""}

      ${c.puestos.length > 1
        ? `<button type="button" class="enlace quitar-antiparasitario"
                   data-quitar="${i}">Quitar</button>`
        : ""}
    </div>`;
  };

  return `
    <p class="flojo">Puede llevar varios a la vez. Te avisamos cuando se le
       acabe el último que le quede.</p>
    ${c.puestos.map(uno).join("")}
    <button type="button" class="enlace" id="anadir-antiparasitario">
      Añadir otro antiparasitario
    </button>`;
}

function cuerpoPaso1(d) {
  const campos = camposSanidad(d);
  const guardado = d.sanidad || {};

  const fila = c => {
    const extra = guardado[c.id] || {};
    const esExterno = c.id === "antiparasitario_externo";

    return `
    <div class="requisito ${c.obligatorio ? "" : "recomendado"}">
      <span class="nombre-req">${esc(c.nombre)}${c.obligatorio ? "" : " <em>(recomendada)</em>"}</span>
      ${esExterno ? "" : `<input type="date" max="${TOPE_FECHA}"
            data-sanidad="${c.id}:fecha" value="${esc(c.fecha)}">`}

      ${esExterno ? antiparasitarios(c) : ""}

      ${esExterno ? "" : `
      <label class="casilla pequena">
        <input type="checkbox" data-sanidad="${c.id}:primovacunacion" ${c.primovacunacion ? "checked" : ""}>
        Es la primera vez
      </label>`}

      <label class="mini">Avísame
        <input type="number" min="1" max="365" class="dias"
               data-sanidad="${c.id}:avisoDias"
               value="${diasDeAvisoDe(c.id, extra)}">
        días antes</label>
    </div>`;
  };

  return `
    <label for="pautas">¿Cómo come?</label>
    <textarea id="pautas" data-campo="pautas_alimentacion" rows="4"
      placeholder="Dos tomas, 300 g de pienso de cordero. No le des pollo.">${esc(d.pautas_alimentacion)}</textarea>

    <label for="cuidados">¿Necesita algún cuidado especial?</label>
    <textarea id="cuidados" data-campo="cuidados" rows="4"
      placeholder="Pastilla para la artrosis con la cena. Le cuesta subir escalones.">${esc(d.cuidados)}</textarea>

    <h4>Vacunas y desparasitaciones</h4>
    <p class="flojo">Las fechas de la cartilla. <strong>Te avisamos una semana antes</strong>
       de que algo caduque, y puedes cambiar ese plazo en cada línea. La pipeta y el collar
       no duran lo mismo, así que dinos cuál le pones.</p>
    <div class="requisitos">${campos.map(fila).join("")}</div>`;
}

function cuerpoPaso2(d, error) {
  const sel = (v, o) => v === o ? "selected" : "";
  const casilla = (campo, texto) => `
    <label class="casilla">
      <input type="checkbox" data-campo="${campo}" ${d[campo] ? "checked" : ""}>
      ${texto}
    </label>`;

  return `
    <label for="sociable">¿Cómo se lleva con otros perros?</label>
    <select id="sociable" data-campo="sociable">
      <option value="todos"   ${sel(d.sociable, "todos")}>Bien con todos</option>
      <option value="machos"  ${sel(d.sociable, "machos")}>Solo con machos</option>
      <option value="hembras" ${sel(d.sociable, "hembras")}>Solo con hembras</option>
      <option value="ninguno" ${sel(d.sociable, "ninguno")}>Mejor solo</option>
    </select>
    ${error("sociable")}

    <label for="actividad">¿Cuánta marcha tiene?</label>
    <select id="actividad" data-campo="actividad">
      <option value="activo"     ${sel(d.actividad, "activo")}>Mucha, no para</option>
      <option value="normal"     ${sel(d.actividad, "normal")}>Normal</option>
      <option value="sedentario" ${sel(d.actividad, "sedentario")}>Tranquilo, de tumbarse al sol</option>
    </select>
    ${error("actividad")}

    <h4>Cosas que nos ayudan a cuidarlo mejor</h4>
    ${casilla("timido",     "Es tímido o miedoso")}
    ${casilla("comilon",    "Es muy comilón")}
    ${casilla("polidipsia", "Bebe muchísima agua")}
    ${casilla("destroyer",  "Rompe cosas: camas, juguetes…")}

    <h4>Lo más importante que nos puedes contar</h4>
    ${d.agresivo_con_personas ? `
      <div class="aviso">
        <strong>Este perro está clasificado con manejo de peligrosidad.</strong>
        Va a alojamiento propio, siempre solo, y su estancia tiene tarifa especial.
        Si crees que ya no hace falta, háblalo con nosotros.
      </div>` : ""}

    <label class="casilla">
      <input type="checkbox" data-campo="ha_mordido" ${d.ha_mordido ? "checked" : ""}>
      <span><strong>Ha mordido o ha intentado morder a alguna persona</strong>
        <br><span class="flojo">Aunque fuera una vez y hace años.</span></span>
    </label>

    <label for="incidentes">¿Ha pasado algo con personas que debamos saber?</label>
    <p class="flojo">Cuéntanoslo con tus palabras, aunque te dé apuro. No es para juzgar
       a tu perro: es para que quien lo maneje sepa a qué atenerse y no haya sustos.
       <strong>Lo decidimos nosotros</strong>, no tú, y te lo diremos antes de cobrarte nada
       distinto.</p>
    <textarea id="incidentes" data-campo="incidentes_con_personas" rows="3"
      placeholder="Gruñe si le tocan mientras come. Con desconocidos en casa se pone nervioso."
      >${esc(d.incidentes_con_personas)}</textarea>

    <label class="casilla">
      <input type="checkbox" id="es_ppp" data-campo="es_ppp" ${d.es_ppp ? "checked" : ""}>
      Es un perro potencialmente peligroso (PPP)
    </label>

    <h4>Papeles</h4>
    <label class="casilla">
      <input type="checkbox" id="tiene_licencia" data-campo="tiene_licencia"
             ${d.licencia_deportiva || d.licencia_deportiva_hasta || d.tiene_licencia ? "checked" : ""}>
      Tiene licencia deportiva
    </label>

    ${(d.tiene_licencia || d.licencia_deportiva || d.licencia_deportiva_hasta) ? `
      <label for="lic_dep">Número de licencia</label>
      <input id="lic_dep" data-campo="licencia_deportiva" value="${esc(d.licencia_deportiva)}"
             placeholder="El de la RSCE o la federación">
      <label for="lic_dep_h">¿Hasta cuándo vale?</label>
      <input id="lic_dep_h" type="date" data-campo="licencia_deportiva_hasta"
             value="${esc(d.licencia_deportiva_hasta)}">
      <p class="flojo">Te avisamos un mes antes de que caduque.</p>` : ""}

    ${d.es_ppp ? `
      <label for="lic">¿Hasta cuándo vale tu licencia?</label>
      <input id="lic" type="date" data-campo="ppp_licencia_hasta" value="${esc(d.ppp_licencia_hasta)}">
      ${error("ppp_licencia_hasta")}

      <label for="seg">¿Y el seguro de responsabilidad civil?</label>
      <input id="seg" type="date" data-campo="ppp_seguro_hasta" value="${esc(d.ppp_seguro_hasta)}">
      ${error("ppp_seguro_hasta")}` : ""}`;
}

/* ============================================================
   La ficha de un perro concreto, abierta desde fuera.

   La usa administración: pincha el nombre de un perro en la
   ficha de su dueño y ve su ficha, igual que pincha una reserva
   en el cuadrante y ve la estancia.

   Es la MISMA ficha que ve el cliente, a propósito: mantener
   dos pantallas que enseñan lo mismo acaba con las dos diciendo
   cosas distintas. Lo único que cambia es a dónde vuelve.
   ============================================================ */
export async function fichaDePerro(contenedor, { perroId } = {}) {
  const id = perroId || window.__perro;
  if (!id) {
    contenedor.innerHTML = `<div class="aviso">Pincha un perro en la ficha de su dueño.</div>`;
    return;
  }
  await ficha(contenedor, id, { volverA: "perros-todos" });
}
