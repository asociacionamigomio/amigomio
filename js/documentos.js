/* ============================================================
   La cartilla, fotografiada.

   Subir los papeles es VOLUNTARIO. No bloquea nada, no impide
   reservar y no se pide dos veces. Quien los sube se ahorra que
   le preguntemos cada vez, y nosotros tenemos el papel a mano
   cuando la inspección lo pida.

   Aquí no hay permisos: los pone la base de datos (la tabla
   `documento_perro`) y Storage (el cubo `cartillas`, que es
   privado). Esto sólo sabe QUÉ hojas se piden y cómo dejar una
   foto de móvil en un tamaño razonable.
   ============================================================ */

/* Qué hojas se ofrecen, en el orden en que están en la cartilla.

   `soloPpp` no esconde nada por seguridad: es que pedirle el
   seguro de responsabilidad civil a quien tiene un caniche
   confunde. */
export const TIPOS_DOCUMENTO = [
  { id: "cartilla_datos", nombre: "La hoja de los datos",
    pista: "Donde están el chip, el nombre y tus datos." },

  { id: "cartilla_vacunas", nombre: "La hoja de las vacunas",
    pista: "La de las pegatinas. Si ocupa dos páginas, súbelas las dos." },

  { id: "cartilla_rabia", nombre: "La hoja de la rabia",
    pista: "A veces va aparte, con su sello y su fecha." },

  { id: "cartilla_desparasitaciones", nombre: "La hoja de las desparasitaciones",
    pista: "Interna y externa, donde el veterinario las apunta." },

  { id: "licencia_deportiva", nombre: "La licencia deportiva",
    pista: "Si lo llevas a pruebas o a competición." },

  { id: "licencia_ppp", nombre: "La licencia de perro potencialmente peligroso",
    pista: "La que da el ayuntamiento.", soloPpp: true },

  { id: "seguro", nombre: "El seguro de responsabilidad civil",
    pista: "La póliza o el recibo, con la fecha hasta la que vale.", soloPpp: true },

  { id: "otro", nombre: "Otro papel",
    pista: "Informes, análisis, lo que quieras que tengamos." },
];

export const tipoDocumento = id => TIPOS_DOCUMENTO.find(t => t.id === id);

/** Las hojas que tiene sentido pedirle a ESTE perro. */
export function tiposPara(perro) {
  return TIPOS_DOCUMENTO.filter(t => !t.soloPpp || perro?.es_ppp);
}

/* Una foto de móvil son cuatro megas. Diez así por perro se
   comen la cuota de Storage, y el cliente se queda mirando la
   barra de progreso en el aparcamiento del veterinario. Se
   encoge antes de subirla: 1600 px de lado largo se lee de
   sobra, incluso las fechas escritas a mano. */
export const LADO_MAXIMO = 1600;

/* Para una foto de perfil o de un perro, 1600 px es un cartel.
   Con 600 se ve perfectamente en un móvil y pesa una cuarta
   parte — y estas fotos se cargan en listas, varias a la vez. */
export const LADO_FOTO = 600;

/* Lo que no se deja subir ni encogido. Un PDF de 20 MB es un
   escaneo mal hecho, y decirlo antes es mejor que fallar a la
   mitad. */
export const TAMANO_MAXIMO = 10 * 1024 * 1024;

/* Dónde va el fichero dentro del cubo.

   La primera carpeta tiene que ser el id del usuario: es lo que
   mira la política de Storage, y si no cuadra Supabase rechaza
   la subida sin más explicación.

   Lleva la hora para que dos fotos de la misma hoja no se
   pisen: la cartilla de vacunas ocupa más de una página. */
export function rutaDocumento(usuarioId, perroId, tipo, nombreFichero) {
  const punto = String(nombreFichero || "").lastIndexOf(".");
  const extension = punto > 0 ? nombreFichero.slice(punto).toLowerCase() : ".jpg";
  const cuando = new Date().toISOString().replace(/[:.]/g, "-");
  const azar = Math.random().toString(36).slice(2, 7);
  return `${usuarioId}/${perroId}/${tipo}-${cuando}-${azar}${extension}`;
}

export const esPdf = fichero =>
  fichero?.type === "application/pdf" || /\.pdf$/i.test(fichero?.name || "");

/**
 * Deja la foto en algo que se pueda subir por datos móviles.
 *
 * Los PDF salen tal cual: meter un PDF en un canvas daría una
 * imagen en blanco y nadie sabría por qué.
 */
export async function encoger(fichero, lado = LADO_MAXIMO) {
  if (esPdf(fichero)) return fichero;
  if (!fichero?.type?.startsWith("image/")) return fichero;

  const imagen = await new Promise((vale, falla) => {
    const i = new Image();
    i.onload = () => vale(i);
    i.onerror = falla;
    i.src = URL.createObjectURL(fichero);
  });

  const escala = Math.min(1, lado / Math.max(imagen.width, imagen.height));
  if (escala === 1 && fichero.size <= 1024 * 1024) {
    URL.revokeObjectURL(imagen.src);
    return fichero;     // ya es pequeña: no se toca, que cada pasada pierde
  }

  const lienzo = document.createElement("canvas");
  lienzo.width  = Math.round(imagen.width  * escala);
  lienzo.height = Math.round(imagen.height * escala);
  lienzo.getContext("2d").drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  URL.revokeObjectURL(imagen.src);

  const trozo = await new Promise(vale => lienzo.toBlob(vale, "image/jpeg", 0.82));
  if (!trozo || trozo.size >= fichero.size) return fichero;

  return new File([trozo], fichero.name.replace(/\.[^.]+$/, "") + ".jpg",
                  { type: "image/jpeg" });
}

/** Lo que hay que decirle si el fichero no vale. Null si vale. */
export function queLePasa(fichero) {
  if (!fichero) return "No has elegido ningún fichero.";
  const esImagen = fichero.type?.startsWith("image/");
  if (!esImagen && !esPdf(fichero))
    return "Tiene que ser una foto o un PDF.";
  if (fichero.size > TAMANO_MAXIMO)
    return "Ese fichero pesa demasiado. Hazle una foto con el móvil y súbela.";
  return null;
}
