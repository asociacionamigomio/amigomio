/* ============================================================
   Por validar: lo que está esperando a administración.

   Santiago, 13/09/2026: «en el perfil de administración no me
   salen las cosas para validar». Y tenía razón — no existía
   esta pantalla. Había una reserva con el justificante subido
   esperando, y para verla había que ir al cuadrante y pinchar
   las reservas una por una.

   El orden de esta pantalla es EL ORDEN DE LA PRISA:

   1. Justificantes subidos. Alguien ya ha pagado y espera.
   2. Reservas sin justificante. Caducan solas a las 24 h.
   3. Cambios de chip o de nombre.
   4. Educación y deporte, que puede esperar a mañana.

   Y se resuelve DESDE AQUÍ. Una lista que sólo enseña obliga a
   ir a otro sitio a hacer lo que hay que hacer, y entonces no se
   usa.
   ============================================================ */
import { cosasPorValidar, validarJustificante, rechazarJustificante,
         verJustificante, resolverSolicitud, atenderInteres,
         cancelarReserva, darCancelacionPorVista } from "../datos.js";

const esc = t => String(t ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const dia = iso => new Date(iso).toLocaleDateString("es-ES",
  { day: "numeric", month: "short" });

const quien = c => `${esc(c?.nombre ?? "")} ${esc(c?.apellidos ?? "")}`.trim() || "Sin nombre";

const perrosDe = r => (r.reserva_perro || [])
  .map(x => esc(x.perro?.nombre)).filter(Boolean).join(", ") || "—";

/* Cuánto lleva esperando. Un justificante de hace tres días no
   es lo mismo que uno de hace diez minutos, y en la lista tienen
   la misma pinta si no se dice. */
function desdeHace(iso) {
  if (!iso) return "";
  const horas = (Date.now() - new Date(iso).getTime()) / 3600000;
  if (horas < 1) return "hace un rato";
  if (horas < 24) return `hace ${Math.round(horas)} h`;
  const dias = Math.round(horas / 24);
  return dias === 1 ? "desde ayer" : `hace ${dias} días`;
}

export async function render(contenedor) {
  contenedor.innerHTML = `<p class="cargando">Mirando qué te espera…</p>`;

  let cosas;
  try { cosas = await cosasPorValidar(); }
  catch {
    contenedor.innerHTML = `<h2>Por validar</h2>
      <div class="error">No hemos podido mirarlo. Vuelve a probar en un momento.</div>`;
    return;
  }

  const { justificantes, esperando, cambios, interesados, canceladas } = cosas;

  /* `null` es «no se ha podido preguntar». NO es «no hay nada»:
     confundirlos aquí deja a administración tranquila mientras un
     cliente espera, y eso cuesta dinero. */
  const todo = [justificantes, esperando, cambios, interesados, canceladas];
  const falló = todo.some(x => x === null);
  const cuantas = todo.reduce((n, x) => n + (x?.length || 0), 0);

  if (!falló && cuantas === 0) {
    contenedor.innerHTML = `
      <h2>Por validar</h2>
      <div class="tarjeta vacio">
        <p>Nada pendiente. Todo al día.</p>
        <p class="flojo">Aquí aparecen solas cuatro cosas: los justificantes
           de pago recién subidos, las reservas que todavía no lo han mandado,
           las peticiones de cambiar el chip o el nombre de un perro, y quien
           ha preguntado por educación o deporte.</p>
      </div>`;
    return;
  }

  contenedor.innerHTML = `
    <h2>Por validar ${cuantas ? `<span class="cuenta">${cuantas}</span>` : ""}</h2>

    ${falló ? `<div class="aviso">Algo no se ha podido consultar, así que puede
       faltar algo en esta lista. Vuelve a probar en un momento.</div>` : ""}

    ${bloque("Justificantes de pago", justificantes, tarjetaJustificante,
             "Ya han pagado y esperan tu visto bueno.")}

    ${bloque("Esperando el justificante", esperando, tarjetaEsperando,
             "Reservado, pero sin resguardo todavía. Caducan solas a las 24 horas.")}

    ${bloque("Cambios de chip o nombre", cambios, tarjetaCambio,
             "Aprobar cambia el dato del perro de verdad.")}

    ${bloque("Educación y deporte", interesados, tarjetaInteres,
             "Han pedido información o venir a ver un entrenamiento.")}

    ${bloque("Se han cancelado", canceladas, tarjetaCancelada,
             "Aquí no hay nada que validar: es para que te enteres de que esas " +
             "noches han quedado libres y se pueden volver a vender.")}`;

  enganchar(contenedor);
}

function bloque(titulo, lista, pinta, explica) {
  if (lista === null)
    return `<h3 class="grupo">${titulo}</h3>
            <div class="aviso">No hemos podido consultarlo.</div>`;
  if (!lista.length) return "";
  return `
    <h3 class="grupo">${titulo} <span class="cuenta">${lista.length}</span></h3>
    <p class="flojo">${explica}</p>
    <div class="lista-perros">${lista.map(pinta).join("")}</div>`;
}

function tarjetaJustificante(r) {
  return `
    <div class="tarjeta por-validar corre">
      <p class="flojo">${quien(r.cliente)}
         ${r.cliente?.telefono ? `· ${esc(r.cliente.telefono)}` : ""}
         · <strong>${desdeHace(r.creada)}</strong></p>
      <h3>${perrosDe(r)}</h3>
      <p>${dia(r.entrada)} → ${dia(r.salida)}
         ${r.alojamiento?.nombre ? `· ${esc(r.alojamiento.nombre)}` : ""}
         ${r.total ? `· <strong>${r.total} €</strong>` : ""}</p>
      <div class="botonera">
        ${r.justificante ? `<button class="boton fantasma" data-ver="${esc(r.justificante)}">Ver el resguardo</button>` : ""}
        <button class="boton fantasma" data-rechazar="${r.id}">No cuadra</button>
        <button class="boton peligro" data-descartar="${r.id}">Anular la reserva</button>
        <button class="boton" data-validar="${r.id}">He visto el dinero, confirmar</button>
      </div>
    </div>`;
}

function tarjetaEsperando(r) {
  return `
    <div class="tarjeta por-validar">
      <p class="flojo">${quien(r.cliente)}
         ${r.cliente?.telefono ? `· ${esc(r.cliente.telefono)}` : ""}
         · reservada ${desdeHace(r.creada)}</p>
      <h3>${perrosDe(r)}</h3>
      <p>${dia(r.entrada)} → ${dia(r.salida)}
         ${r.total ? `· <strong>${r.total} €</strong>` : ""}</p>
      <div class="botonera">
        <button class="boton peligro" data-descartar="${r.id}">Anular la reserva</button>
        <button class="boton" data-validar="${r.id}">Ha pagado en persona, confirmar</button>
      </div>
    </div>`;
}

function tarjetaCambio(s) {
  return `
    <div class="tarjeta por-validar">
      <p class="flojo">${quien(s.cliente)} · ${desdeHace(s.creada)}</p>
      <h3>${esc(s.perro?.nombre)}</h3>
      <p>Pide cambiar <strong>${s.campo === "chip" ? "el número de chip" : "el nombre"}</strong>:</p>
      <div class="cambio">
        <span class="viejo">${esc(s.valor_actual)}</span>
        <span class="flecha">→</span>
        <span class="nuevo">${esc(s.valor_nuevo)}</span>
      </div>
      ${s.motivo ? `<p class="motivo">«${esc(s.motivo)}»</p>` : ""}
      <div class="botonera">
        <button class="boton fantasma" data-solicitud="${s.id}:rechazar">Rechazar</button>
        <button class="boton" data-solicitud="${s.id}:aprobar">Aprobar</button>
      </div>
    </div>`;
}

function tarjetaCancelada(r) {
  return `
    <div class="tarjeta por-validar">
      <p class="flojo">${quien(r.cliente)}
         ${r.cliente?.telefono ? `· ${esc(r.cliente.telefono)}` : ""}</p>
      <h3>${perrosDe(r)}</h3>
      <p>Era del ${dia(r.entrada)} al ${dia(r.salida)}
         ${r.alojamiento?.nombre ? `· ${esc(r.alojamiento.nombre)}` : ""}
         ${r.total ? `· ${r.total} €` : ""}</p>
      <p><strong>Ese alojamiento ha quedado libre</strong> esas noches.</p>
      <div class="botonera">
        <button class="boton fantasma" data-visto="${r.id}">Visto</button>
      </div>
    </div>`;
}

function tarjetaInteres(i) {
  return `
    <div class="tarjeta por-validar">
      <p class="flojo">${quien(i.cliente)}
         ${i.cliente?.telefono ? `· ${esc(i.cliente.telefono)}` : ""}
         · ${desdeHace(i.creada)}</p>
      <h3>${i.tipo === "deporte" ? "Quiere ver un entrenamiento" : "Quiere información de educación"}</h3>
      ${i.perro?.nombre ? `<p>Con ${esc(i.perro.nombre)}${i.perro.raza ? `, ${esc(i.perro.raza)}` : ""}</p>` : ""}
      ${i.mensaje ? `<p class="motivo">«${esc(i.mensaje)}»</p>` : ""}
      <div class="botonera">
        <button class="boton fantasma" data-descartar-interes="${i.id}">Quitar de aquí</button>
        <button class="boton" data-interes="${i.id}">Ya le he hablado</button>
      </div>
    </div>`;
}

/* ------------------------------------------------------------
   Los botones.

   Todos siguen el mismo patrón: se deshabilita, se hace, y se
   repinta la pantalla entera. Repintar y no quitar la tarjeta a
   mano es a propósito: así lo que se ve es lo que hay en la base,
   no lo que creemos que hay.
   ------------------------------------------------------------ */
function enganchar(contenedor) {
  const rehacer = () => render(contenedor);

  const alPulsar = (selector, hacer) =>
    contenedor.querySelectorAll(selector).forEach(b =>
      b.addEventListener("click", async () => {
        const antes = b.textContent;
        b.disabled = true;
        b.textContent = "Un momento…";
        const r = await hacer(b);
        if (r && r.ok === false) {
          b.disabled = false;
          b.textContent = antes;
          avisar(contenedor, r.mensaje || "No hemos podido.");
          return;
        }
        rehacer();
      }));

  alPulsar("[data-validar]", b => validarJustificante(b.dataset.validar));

  alPulsar("[data-rechazar]", b => {
    /* Rechazar sin decir por qué deja al cliente sin saber qué
       arreglar, y llamando por teléfono. */
    const motivo = prompt("¿Qué le decimos? (lo verá el cliente)",
                          "El resguardo no se lee bien.");
    if (motivo === null) return { ok: false, mensaje: "" };
    return rechazarJustificante(b.dataset.rechazar, motivo);
  });

  /* ANULAR UNA RESERVA NO LA BORRA: la deja en «cancelada».

     El libro de registro es obligatorio para las inspecciones, y
     un borrado deja ahí un hueco que no se puede explicar. Así
     desaparece de esta lista, el box queda libre, y el apunte de
     quién reservó qué se conserva.

     Y se pregunta antes: es lo único de esta pantalla que le
     quita una reserva a un cliente, y un resbalón con el dedo en
     el móvil no puede cancelarle a nadie sus vacaciones. */
  alPulsar("[data-descartar]", b => {
    if (!confirm("¿Anulamos esta reserva?\n\n" +
                 "Deja de contar, el alojamiento queda libre y desaparece de " +
                 "esta lista. No se borra: queda anotada como anulada para el " +
                 "libro de registro."))
      return { ok: false, mensaje: "" };
    return cancelarReserva(b.dataset.descartar);
  });

  alPulsar("[data-descartar-interes]", b =>
    atenderInteres(b.dataset.descartarInteres, "descartada"));

  alPulsar("[data-solicitud]", b => {
    const [id, accion] = b.dataset.solicitud.split(":");
    return resolverSolicitud(id, { aprobar: accion === "aprobar" });
  });

  /* «hablada», que es uno de los estados que admite la tabla
     (nueva / hablada / apuntado / descartada). Inventarse otro lo
     rechaza el check de Postgres. */
  alPulsar("[data-visto]", b => darCancelacionPorVista(b.dataset.visto));

  alPulsar("[data-interes]", b => atenderInteres(b.dataset.interes, "hablada"));

  /* Ver el resguardo NO repinta: abre el fichero. */
  contenedor.querySelectorAll("[data-ver]").forEach(b =>
    b.addEventListener("click", async () => {
      b.disabled = true;
      const url = await verJustificante(b.dataset.ver);
      b.disabled = false;
      if (url) window.open(url, "_blank", "noopener");
      else avisar(contenedor, "No hemos podido abrir el resguardo.");
    }));
}

function avisar(contenedor, mensaje) {
  if (!mensaje) return;
  const viejo = contenedor.querySelector(".error");
  if (viejo) viejo.remove();
  const div = document.createElement("div");
  div.className = "error";
  div.textContent = mensaje;
  contenedor.prepend(div);
}
