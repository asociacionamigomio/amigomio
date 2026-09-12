/* ============================================================
   Clicker virtual.

   Un clicker de verdad suena siempre igual y suena YA: entre el
   comportamiento y el clic no puede haber retraso, o el perro
   asocia otra cosa. Por eso el sonido se genera aquí mismo con
   el sintetizador del navegador en vez de reproducir un fichero:
   un fichero tarda en cargar la primera vez, y esa primera vez
   es justo la que estropea la sesión.
   ============================================================ */

let audio = null;

/* Dos tonos secos y muy cortos, como el chasquido de la lengüeta
   metálica. Nada de música: tiene que ser reconocible y neutro. */
function clic() {
  audio ||= new (window.AudioContext || window.webkitAudioContext)();
  const t = audio.currentTime;

  for (const [cuando, hz] of [[0, 2600], [0.012, 1900]]) {
    const osc = audio.createOscillator();
    const vol = audio.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(hz, t + cuando);
    vol.gain.setValueAtTime(0.0001, t + cuando);
    vol.gain.exponentialRampToValueAtTime(0.45, t + cuando + 0.001);
    vol.gain.exponentialRampToValueAtTime(0.0001, t + cuando + 0.020);
    osc.connect(vol); vol.connect(audio.destination);
    osc.start(t + cuando); osc.stop(t + cuando + 0.025);
  }

  if (navigator.vibrate) navigator.vibrate(12);
}

export function render(contenedor) {
  let cuenta = 0;

  contenedor.innerHTML = `
    <h2>Clicker</h2>
    <p class="flojo">Pulsa en el momento exacto en que hace lo que quieres.
       Ni un segundo después. Y luego premia.</p>

    <button class="clicker" id="clic" aria-label="Clic">
      <span class="clicker-dentro">CLIC</span>
    </button>

    <p class="cuenta-clics" id="cuenta">Toca para empezar</p>

    <div class="tarjeta">
      <h3>Si es la primera vez</h3>
      <p>El clic no premia: <strong>avisa de que el premio viene</strong>. Antes de
         usarlo para enseñar nada, haz veinte veces esto: clic, y comida. Clic, y
         comida. Sin pedirle nada. Cuando al oír el clic te mire buscando la comida,
         ya significa algo y puedes empezar.</p>
      <p class="flojo">Y sube el volumen del móvil, que si no se queda en nada.</p>
    </div>`;

  const boton = contenedor.querySelector("#clic");
  const cuentaTexto = contenedor.querySelector("#cuenta");

  const pulsar = e => {
    e.preventDefault();
    try { clic(); } catch { /* sin sonido, pero el botón responde igual */ }
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
}
