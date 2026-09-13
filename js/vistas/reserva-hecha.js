/* ============================================================
   Lo que se le dice al cliente NADA MÁS reservar.

   Santiago, 13/09/2026: «necesito que al hacer una reserva
   aparezca una ventana explicando claramente el proceso de
   reserva, la confirmación, qué pasos debe seguir».

   Hasta hoy era UNA LÍNEA —«¡Hecho! Ya tienes el sitio guardado.
   Mira en Mis reservas dónde transferir: tienes 24 horas»— y al
   decirla la pantalla volvía al formulario vacío, como si no
   hubiera pasado nada. Y en «Mis reservas» NO SALÍA EL IBAN: se
   le pedía una transferencia sin decirle a dónde.

   Este es el momento en que el cliente decide si se fía. Si se
   queda sin saber qué le toca hacer, o llama por teléfono, o se
   va a otro sitio.

   Tres decisiones de esta pantalla:

   1. LO PRIMERO ES QUE TODAVÍA NO ESTÁ CONFIRMADA. Es lo único
      que de verdad hay que entender: quien cree que ya está no
      manda el resguardo y a las 24 horas pierde el sitio sin
      enterarse.
   2. FECHA Y HORA, NO «tienes 24 horas». Una cuenta atrás mental
      se hace mal y se hace tarde.
   3. QUIEN PAGA EN PERSONA NO OYE HABLAR DE TRANSFERENCIAS.
      Contárselo le hace dudar de si le toca hacer algo.
   ============================================================ */
import { botonWhatsApp } from "../contacto.js";

const esc = t => String(t ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const euros = n => `${Number(n ?? 0).toFixed(2).replace(".", ",")} €`;

const cuando = iso => iso
  ? new Date(iso).toLocaleString("es-ES",
      { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
  : "";

/**
 * @param contenedor  dónde pintarla
 * @param reserva     lo que devolvió crearReserva(): estado, total, expira
 * @param pago        { iban } o null si la base todavía no lo da
 * @param quien       la ficha del cliente, para el concepto
 */
export function render(contenedor, { reserva, pago, quien }) {
  const confirmada = reserva?.estado === "confirmada";

  contenedor.innerHTML = confirmada
    ? pintarConfirmada(reserva)
    : pintarPendiente(reserva, pago, quien);

  contenedor.querySelectorAll("[data-ir]").forEach(b =>
    b.addEventListener("click", () => window.irA?.(b.dataset.ir)));

  /* Copiar el IBAN a mano desde un móvil es donde se equivoca
     todo el mundo, y una transferencia a un número mal copiado la
     devuelve el banco días después. */
  contenedor.querySelector("#copiar-iban")?.addEventListener("click", async e => {
    try {
      await navigator.clipboard.writeText(pago.iban.replace(/\s/g, ""));
      e.target.textContent = "Copiado ✓";
    } catch {
      e.target.textContent = "Cópialo a mano";
    }
  });
}

/* ============================================================
   Qué tiene que traer el día de la entrada.

   Santiago, 13/09/2026: «cuenta lo de su camita, juguetes, su
   comida...».

   Va en las DOS versiones de la pantalla, no sólo en la de
   «confirmada»: quien paga por transferencia ve esta pantalla una
   sola vez en su vida, justo al reservar. Si esto estuviera sólo
   en la otra, no lo leería nunca.

   Y lo del pienso SE EXPLICA, no se ordena. «Trae su comida» se
   salta; «cambiárselo de golpe le puede sentar mal» se hace caso.
   Una diarrea en una residencia es una semana mala para el perro
   y una llamada incómoda para todos.
   ============================================================ */
function queTraer() {
  return `
    <div class="que-traer">
      <p class="rotulo">Qué traer el día de la entrada</p>
      <ul class="cosas">
        <li><strong>Su comida de siempre.</strong> Cálculala con un par de días
            de más, por si acaso, y dinos cuánto le toca y cuántas veces al día.
            Cambiarle el pienso de golpe le puede sentar mal a la barriga.</li>

        <li><strong>Su camita o una manta de casa.</strong> Sin lavar, mejor: lo
            que le tranquiliza es que huela a lo suyo. La primera noche fuera se
            lleva mucho mejor con su olor al lado.</li>

        <li><strong>Dos o tres juguetes de los suyos.</strong> Los que ya tiene
            machacados, no uno nuevo. Y si tiene uno que es EL juguete, ése.</li>

        <li><strong>Su cartilla</strong>, con la rabia y las desparasitaciones al
            día. Si nos la has subido a la ficha del perro, con eso vale.</li>

        <li><strong>Su medicación</strong>, si toma algo, en su caja y con las
            dosis apuntadas. Nunca suelta en una bolsita.</li>
      </ul>

      <p class="rotulo">Lo que no debes traer</p>
      <ul class="cosas">
        <li>Comederos y bebederos: aquí tiene los suyos.</li>
        <li>Camas grandes o transportines: no caben y no hacen falta.</li>
        <li>Juguetes nuevos o sin estrenar, y nada que pueda romper y tragarse.</li>
        <li>Objetos de valor. Aquí se juega y se corre, y lo que se pierde se pierde.</li>
      </ul>
      <p class="flojo">Con su collar y su correa puestos basta. Cuanto menos
         traiga, mejor: una mudanza pone más nervioso al perro que al dueño.</p>
    </div>`;
}

function paso(n, titulo, cuerpo) {
  return `
    <li class="paso">
      <span class="paso-numero">${n}</span>
      <div class="paso-texto">
        <strong>${titulo}</strong>
        ${cuerpo}
      </div>
    </li>`;
}

function pintarPendiente(r, pago, quien) {
  const concepto = `${(quien?.nombre || "").trim()} ${(quien?.apellidos || "").trim()}`.trim();

  return `
    <div class="tarjeta reserva-hecha">
      <h2>Ya tienes el sitio guardado</h2>

      <!-- Lo primero, y en grande: es lo único que hay que
           entender de toda la pantalla. -->
      <div class="aviso destacado">
        <strong>Todavía no está confirmada.</strong>
        Te guardamos el alojamiento hasta
        <strong>${esc(cuando(r.expira))}</strong>.
        Si para entonces no nos ha llegado el justificante, se suelta
        solo y lo puede coger otra persona.
      </div>

      <p class="rotulo">Lo que falta, en tres pasos</p>
      <ol class="pasos">

        ${paso(1, `Haz la transferencia de ${euros(r.total)}`, `
          ${pago?.iban ? `
            <div class="iban">
              <code>${esc(pago.iban)}</code>
              <button class="boton pequeno fantasma" id="copiar-iban">Copiar</button>
            </div>` : `
            <p class="flojo">Te damos el número de cuenta en «Mis reservas»;
               si no te aparece, pídenoslo por WhatsApp y te lo pasamos.</p>`}
          <p class="flojo">En el concepto pon
             <strong>${esc(concepto) || "tu nombre y apellidos"}</strong>.
             Sin eso, en el extracto no sabemos de quién es la transferencia
             y hay que ir preguntando.</p>`)}

        ${paso(2, "Súbenos el resguardo", `
          <p>Desde <strong>Mis reservas</strong>, con una foto o el PDF que te
             da el banco. No hace falta que sea bonito, sólo que se lea.</p>
          <button class="boton" data-ir="reservas">Ir a Mis reservas</button>`)}

        ${paso(3, "Nosotros lo miramos y te confirmamos", `
          <p>Lo revisamos a mano —normalmente el mismo día— y en cuanto
             cuadre <strong>te llega un correo diciendo que está
             confirmada</strong>. Ahí ya no tienes que hacer nada más.</p>
          <p class="flojo">Si algo no cuadrara, te escribimos para decirte qué
             falta. No te quedas sin saber nada.</p>`)}
      </ol>

      ${queTraer()}

      <p class="flojo">¿Te has equivocado en algo, o te ha surgido una duda?
         Háblanos y lo arreglamos, no pasa nada.</p>
      ${botonWhatsApp("Escríbenos por WhatsApp",
        "Hola, acabo de hacer una reserva y quería preguntaros una cosa: ")}
    </div>`;
}

function pintarConfirmada(r) {
  return `
    <div class="tarjeta reserva-hecha">
      <h2>¡Listo! Tu reserva está confirmada</h2>

      <div class="aviso destacado">
        <strong>No tienes que hacer nada más.</strong>
        Se paga al llegar, como siempre.
        ${r.total ? `Son <strong>${euros(r.total)}</strong>.` : ""}
      </div>

      ${queTraer()}

      <p class="flojo">Ven a la hora que reservaste. Si se te va a hacer tarde o
         vas a llegar antes, dínoslo y lo cuadramos: fuera de horario hay
         recargo, y avisando casi siempre se evita.</p>

      <p class="flojo">Y cuéntanos lo que haga falta —manías, si viene raro estos
         días, con quién se lleva mal—. Cuanto más sepamos, mejor lo pasa.</p>

      <button class="boton" data-ir="reservas">Ver mis reservas</button>

      ${botonWhatsApp("Escríbenos por WhatsApp",
        "Hola, acabo de hacer una reserva y quería contaros una cosa: ")}
    </div>`;
}
