/* ============================================================
   El libro de entradas y salidas.

   Esto no es una pantalla de la aplicación: es un documento
   oficial del núcleo zoológico que hay que poder enseñar. Por
   eso está pensado para salir de aquí —en papel, en PDF o en un
   fichero de Excel— y no para mirarlo bonito.

   Lo que lleva dentro no lo decidimos nosotros: lo dice el
   programa sanitario (§14.1 del diseño). Y se alimenta solo de
   las reservas: nada se teclea dos veces.
   ============================================================ */
import { libroDeEstancias } from "../datos.js";
import { enCristiano } from "../sanidad.js";

const esc = t => String(t ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const cuando = iso => iso
  ? new Date(iso).toLocaleString("es-ES",
      { day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit" })
  : "";

const SEXOS = { macho: "Macho", hembra: "Hembra" };

/* Las columnas, en el orden en que las pide el registro. Están
   en un solo sitio para que la pantalla, el papel y el Excel
   digan exactamente lo mismo. */
const COLUMNAS = [
  { id: "chip",                titulo: "Microchip" },
  { id: "nombre",              titulo: "Nombre" },
  { id: "especie",             titulo: "Especie" },
  { id: "raza",                titulo: "Raza" },
  { id: "sexo",                titulo: "Sexo",  valor: f => SEXOS[f.sexo] || "" },
  { id: "capa",                titulo: "Capa" },
  { id: "fecha_nacimiento",    titulo: "Nacimiento",
    valor: f => f.fecha_nacimiento ? enCristiano(f.fecha_nacimiento) : "" },
  { id: "estado_reproductivo", titulo: "Estado reproductivo" },

  { id: "propietario",         titulo: "Propietario" },
  { id: "dni",                 titulo: "DNI" },
  { id: "domicilio",           titulo: "Domicilio" },
  { id: "telefono",            titulo: "Teléfono" },
  { id: "recoge_nombre",       titulo: "Autorizado a recoger" },
  { id: "recoge_dni",          titulo: "DNI del autorizado" },

  { id: "entrada",             titulo: "Entrada", valor: f => cuando(f.entrada) },
  { id: "salida",              titulo: "Salida",  valor: f => cuando(f.salida) },
  { id: "alojamiento",         titulo: "Alojamiento" },
  { id: "procedencia",         titulo: "Procedencia y destino" },

  { id: "sanidad",             titulo: "Estado sanitario al ingreso",
    valor: f => resumenSanitario(f.sanidad) },
  { id: "incidencias",         titulo: "Incidencias y tratamientos" },
];

/* Las fechas sanitarias, en una línea legible. El registro pide
   «fechas de últimas vacunaciones y desparasitaciones», no el
   objeto entero. */
function resumenSanitario(sanidad) {
  if (!sanidad) return "";
  const nombres = {
    rabia: "Rabia", polivalente: "Polivalente", leptospirosis: "Leptospirosis",
    traqueobronquitis: "Tos de las perreras", leishmaniosis: "Leishmaniosis",
    desparasitacion_interna: "Despar. interna",
    antiparasitario_externo: "Antipar. externo",
  };
  const trozos = [];
  for (const [id, nombre] of Object.entries(nombres)) {
    const v = sanidad[id];
    const fecha = v?.fecha || v?.puestos?.map(x => x.fecha).filter(Boolean).sort().at(-1);
    if (fecha) trozos.push(`${nombre} ${fecha}`);
  }
  return trozos.join("; ");
}

const primeroDeMes = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

export async function render(contenedor) {
  let desde = primeroDeMes();
  let hasta = new Date().toISOString().slice(0, 10);
  let filas = [];

  await pintar();

  async function pintar(aviso = "", clase = "aviso") {
    contenedor.innerHTML = `
      <div class="no-imprimir">
        <h2>Libro de entradas y salidas</h2>
        <p class="flojo">Se llena solo con las estancias que han pasado por aquí.
           Para la inspección: <strong>imprímelo</strong> (sale en PDF si eliges
           «Guardar como PDF») o <strong>bájatelo en Excel</strong>.</p>

        ${aviso ? `<div class="${clase}">${esc(aviso)}</div>` : ""}

        <div class="tarjeta">
          <div class="fechas">
            <div><label for="l-desde">Desde</label>
              <input type="date" id="l-desde" value="${desde}"></div>
            <div><label for="l-hasta">Hasta</label>
              <input type="date" id="l-hasta" value="${hasta}"></div>
          </div>
          <div class="botonera" style="margin-top:.8rem">
            <button class="boton" id="sacar">Sacar el libro</button>
            ${filas.length ? `
              <button class="boton fantasma" id="imprimir">Imprimir o PDF</button>
              <button class="boton fantasma" id="excel">Bajar para Excel</button>` : ""}
          </div>
        </div>
      </div>

      <div class="libro" id="libro">
        ${filas.length ? tabla() : `
          <p class="flojo no-imprimir">Elige las fechas y dale a «Sacar el libro».</p>`}
      </div>`;

    contenedor.querySelector("#l-desde").addEventListener("change", e => desde = e.target.value);
    contenedor.querySelector("#l-hasta").addEventListener("change", e => hasta = e.target.value);
    contenedor.querySelector("#sacar").addEventListener("click", sacar);
    contenedor.querySelector("#imprimir")?.addEventListener("click", () => window.print());
    contenedor.querySelector("#excel")?.addEventListener("click", aExcel);
  }

  async function sacar() {
    if (hasta < desde) return pintar("La fecha de fin va después de la de inicio.", "error");
    contenedor.querySelector("#libro").innerHTML = `<p class="cargando">Buscando…</p>`;
    const r = await libroDeEstancias(desde, hasta);
    if (!r.ok) return pintar(r.mensaje, "error");
    filas = r.filas;
    await pintar(filas.length === 0
      ? "En esas fechas no hubo ninguna estancia."
      : `${filas.length} entrada${filas.length === 1 ? "" : "s"} en el libro.`);
  }

  function tabla() {
    return `
      <div class="libro-cabecera">
        <h3>Libro de entradas y salidas</h3>
        <p>Hotel, Residencia y Guardería Canina AmigoMío · El Marquesado, Puerto Real (Cádiz)</p>
        <p>Del ${enCristiano(desde)} al ${enCristiano(hasta)}
           · ${filas.length} entrada${filas.length === 1 ? "" : "s"}
           · Emitido el ${enCristiano(new Date().toISOString().slice(0, 10))}</p>
      </div>

      <div class="libro-tabla">
        <table>
          <thead><tr>${COLUMNAS.map(c => `<th>${esc(c.titulo)}</th>`).join("")}</tr></thead>
          <tbody>
            ${filas.map(f => `<tr>${COLUMNAS.map(c =>
              `<td>${esc(c.valor ? c.valor(f) : f[c.id])}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }

  /* A Excel.

     Punto y coma y no coma: el Excel español parte por punto y
     coma, y con comas el libro entero cae en la primera columna.
     Y el "\uFEFF" del principio es la marca que le dice a Excel
     que esto es UTF-8; sin ella, «Desparasitación» sale
     «DesparasitaciÃ³n». */
  function aExcel() {
    const celda = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lineas = [
      COLUMNAS.map(c => celda(c.titulo)).join(";"),
      ...filas.map(f => COLUMNAS.map(c => celda(c.valor ? c.valor(f) : f[c.id])).join(";")),
    ];

    const csv = "\uFEFF" + lineas.join("\r\n");
    const trozo = new Blob([csv], { type: "text/csv;charset=utf-8" });

    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(trozo);
    enlace.download = `libro-amigomio-${desde}-a-${hasta}.csv`;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  }
}
