/* ============================================================
   Clicker virtual.

   Un clicker de verdad suena siempre igual y suena YA: entre el
   comportamiento y el clic no puede haber retraso, o el perro
   asocia otra cosa. Por eso el sonido se genera aquí mismo con
   el sintetizador del navegador en vez de reproducir un fichero:
   un fichero tarda en cargar la primera vez, y esa primera vez
   es justo la que estropea la sesión.

   Se puede elegir entre cuatro sonidos (js/sonidos-clicker.js).
   En una clase con varios perros, dos manos con el mismo clicker
   marcan también al perro de al lado.
   ============================================================ */
import { SONIDOS, POR_DEFECTO, sonido } from "../sonidos-clicker.js";

const esc = t => String(t ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const HUECO = "amigomio-clicker-sonido";

let audio = null;

/* Cada golpe, muy corto. Lo que hace que suene a clicker y no a
   música es que sube y baja en milésimas. */
function sonar(cual) {
  audio ||= new (window.AudioContext || window.webkitAudioContext)();
  const s = sonido(cual);
  const t = audio.currentTime;

  for (const golpe of s.golpes) {
    const osc = audio.createOscillator();
    const vol = audio.createGain();
    osc.type = s.forma;
    osc.frequency.setValueAtTime(golpe.hz, t + golpe.cuando);
    vol.gain.setValueAtTime(0.0001, t + golpe.cuando);
    vol.gain.exponentialRampToValueAtTime(0.45, t + golpe.cuando + 0.001);
    vol.gain.exponentialRampToValueAtTime(0.0001, t + golpe.cuando + 0.020);
    osc.connect(vol); vol.connect(audio.destination);
    osc.start(t + golpe.cuando); osc.stop(t + golpe.cuando + 0.025);
  }

  if (navigator.vibrate) navigator.vibrate(12);
}

/* Cuál eligió la última vez. En modo privado `localStorage`
   revienta, y quedarse sin clicker por no poder recordar una
   preferencia sería absurdo. */
function elegido() {
  try { return localStorage.getItem(HUECO) || POR_DEFECTO; }
  catch { return POR_DEFECTO; }
}

function recordar(id) {
  try { localStorage.setItem(HUECO, id); } catch { /* modo privado */ }
}

export function render(contenedor) {
  let cuenta = 0;
  let cual = elegido();

  contenedor.innerHTML = `
    <h2>Clicker</h2>

    <button class="clicker" id="clic" aria-label="Clic">
      <span class="clicker-dentro">CLIC</span>
    </button>

    <p class="cuenta-clics" id="cuenta">Toca para empezar</p>

    <div class="sonidos">
      <p class="rotulo">El sonido</p>
      ${SONIDOS.map(s => `
        <button class="sonido ${s.id === cual ? "elegido" : ""}" data-sonido="${s.id}">
          <strong>${esc(s.nombre)}</strong>
          <span class="flojo">${esc(s.pista)}</span>
        </button>`).join("")}
      <p class="flojo">Tócalos para oírlos. Se queda el que elijas.</p>
    </div>`;

  const boton = contenedor.querySelector("#clic");
  const cuentaTexto = contenedor.querySelector("#cuenta");

  const pulsar = e => {
    e.preventDefault();
    try { sonar(cual); } catch { /* sin sonido, pero el botón responde igual */ }
    cuenta++;
    cuentaTexto.textContent = cuenta === 1 ? "1 clic" : `${cuenta} clics`;
    boton.classList.remove("pulsado");
    void boton.offsetWidth;
    boton.classList.add("pulsado");
  };

  /* pointerdown y no click: el clic tiene que sonar al APRETAR,
     no al soltar. En adiestramiento esa décima importa. */
  boton.addEventListener("pointerdown", pulsar);
  boton.addEventListener("keydown", e => {
    if (e.key === " " || e.key === "Enter") pulsar(e);
  });

  /* Elegir y oír en el mismo gesto: probar un sonido sin oírlo
     no sirve de nada. */
  contenedor.querySelectorAll("[data-sonido]").forEach(b =>
    b.addEventListener("pointerdown", e => {
      e.preventDefault();
      cual = b.dataset.sonido;
      recordar(cual);
      try { sonar(cual); } catch { /* da igual */ }
      contenedor.querySelectorAll("[data-sonido]").forEach(o =>
        o.classList.toggle("elegido", o.dataset.sonido === cual));
    }));
}
