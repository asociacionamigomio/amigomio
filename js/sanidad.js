/* ============================================================
   Vigencia sanitaria. Sale del Programa de manejo, higiene y
   profilaxis del núcleo zoológico, de 01/09/2026.

   Tres formas distintas de no valer, y conviene no confundirlas:

   1. CADUCA DESPUÉS  — las vacunas. Se ponen y valen un tiempo.
   2. TIENE QUE SER RECIENTE — la desparasitación interna: dentro
      de los 30 días anteriores a la entrada. Una de hace un año
      no vale aunque nadie la haya "caducado".
   3. NECESITA MARGEN — la tos de las perreras pide 15 días desde
      que se pone; las primovacunaciones, 21. Puesta anteayer,
      todavía no protege.

   Y lo que se comprueba NO es si está al día hoy, sino si lo
   estará durante la estancia.
   ============================================================ */

const DIA = 86400000;
const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio",
               "agosto","septiembre","octubre","noviembre","diciembre"];

const aFecha = s => new Date(s + "T00:00:00");
const aTexto = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

/** "2026-08-09" -> "9 de agosto de 2026", para poder enseñarlo tal cual. */
export function enCristiano(iso) {
  const d = aFecha(iso);
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

function sumarMeses(iso, meses) {
  const d = aFecha(iso);
  const dia = d.getDate();
  d.setMonth(d.getMonth() + meses);
  if (d.getDate() < dia) d.setDate(0); // 31 de enero + 1 mes = 28/29 de febrero
  return aTexto(d);
}

/* Qué se exige y qué se recomienda. Decisión de Santiago, 12/09/2026:
   sólo la rabia y las dos desparasitaciones impiden entrar; el resto
   se pide pero no bloquea.

   Ojo: el Programa de manejo, higiene y profilaxis del núcleo dice
   que no se admite ningún animal sin la pauta vacunal completa, y
   marca la tos de las perreras como exigida. Aquí se sigue el
   criterio de Santiago, que es quien lleva la residencia. Si algún
   día hay que volver al del informe, se cambia `obligatorio` y ya:
   toda la lógica que hay debajo no se entera. */
export const REQUISITOS = [
  { id: "rabia", nombre: "Rabia",
    vigenciaMeses: 12, obligatorio: true },

  { id: "desparasitacion_interna", nombre: "Desparasitación interna",
    maximoDiasAntes: 30, obligatorio: true },

  { id: "antiparasitario_externo", nombre: "Antiparasitario externo",
    vigenciaMeses: 1, obligatorio: true },

  { id: "polivalente", nombre: "Polivalente (moquillo, parvovirosis, hepatitis y parainfluenza)",
    vigenciaMeses: 12, obligatorio: false },

  { id: "leptospirosis", nombre: "Leptospirosis",
    vigenciaMeses: 12, obligatorio: false },

  { id: "traqueobronquitis", nombre: "Tos de las perreras",
    vigenciaMeses: 12, diasMinimosAntes: 15, obligatorio: false },

  { id: "leishmaniosis", nombre: "Leishmaniosis",
    vigenciaMeses: 12, obligatorio: false },
];

/** Días de margen que exige este registro: 21 si es primovacunación. */
function margenExigido(requisito, registro) {
  if (registro.primovacunacion) return 21;
  return requisito.diasMinimosAntes || 0;
}

export function estadoRequisito({ requisito, registro, entrada, salida }) {
  if (!registro || !registro.fecha)
    return { estado: "sin-datos", caduca: null,
             mensaje: `Nos falta la fecha de ${requisito.nombre.toLowerCase()}.` };

  const puesta = aFecha(registro.fecha);
  const dEntrada = aFecha(entrada);

  /* 3. ¿Le ha dado tiempo a hacer efecto? */
  const margen = margenExigido(requisito, registro);
  if (margen > 0 && (dEntrada - puesta) / DIA < margen) {
    return { estado: "demasiado-reciente", caduca: null,
             mensaje: `${requisito.nombre} tiene que estar puesta al menos ${margen} días ` +
                      `antes de entrar, y aquí no llega.` };
  }

  /* 2. ¿Tiene que ser reciente? */
  if (requisito.maximoDiasAntes) {
    const dias = (dEntrada - puesta) / DIA;
    if (dias > requisito.maximoDiasAntes) {
      return { estado: "caducado", caduca: null,
               mensaje: `${requisito.nombre} tiene que ser de los ` +
                        `${requisito.maximoDiasAntes} días anteriores a la entrada.` };
    }
    return { estado: "al-dia", caduca: null, mensaje: "" };
  }

  /* 1. ¿Sigue en vigor durante toda la estancia?
     Si el propietario apuntó hasta cuándo vale, manda eso. */
  const caduca = registro.validoHasta || sumarMeses(registro.fecha, requisito.vigenciaMeses);
  const dCaduca = aFecha(caduca);
  const dSalida = aFecha(salida);

  if (dCaduca < dEntrada)
    return { estado: "caducado", caduca,
             mensaje: `${requisito.nombre} venció el ${enCristiano(caduca)}.` };

  if (dCaduca < dSalida)
    return { estado: "caduca-durante", caduca,
             mensaje: `${requisito.nombre} vence el ${enCristiano(caduca)}, ` +
                      `en mitad de la estancia.` };

  return { estado: "al-dia", caduca, mensaje: "" };
}

/** Revisa el perro entero contra unas fechas y devuelve sólo lo que falla. */
export function revisarPerro(perro, entrada, salida) {
  const problemas = [];
  for (const requisito of REQUISITOS) {
    if (!requisito.obligatorio) continue;
    const r = estadoRequisito({
      requisito, registro: perro.sanidad?.[requisito.id], entrada, salida,
    });
    if (r.estado !== "al-dia") {
      problemas.push({
        id: requisito.id,
        estado: r.estado,
        mensaje: `${perro.nombre}: ${r.mensaje}`,
      });
    }
  }
  return { apto: problemas.length === 0, problemas };
}

/**
 * Un hueco por requisito para pintar el formulario, con lo ya
 * guardado relleno. Los obligatorios primero y los recomendados
 * al final, para que no se mezclen y nadie crea que la
 * leishmaniosis le impide reservar.
 */
export function camposSanidad(perro) {
  const guardado = perro?.sanidad || {};
  const hueco = r => {
    const v = guardado[r.id] || {};
    return {
      id: r.id,
      nombre: r.nombre,
      obligatorio: r.obligatorio,
      fecha: v.fecha || "",
      validoHasta: v.validoHasta || "",
      primovacunacion: v.primovacunacion === true,
    };
  };
  return [
    ...REQUISITOS.filter(r => r.obligatorio).map(hueco),
    ...REQUISITOS.filter(r => !r.obligatorio).map(hueco),
  ];
}

/* ============================================================
   AVISOS: decirlo ANTES de que caduque.

   Esto responde a una pregunta distinta de estadoRequisito():
   aquella mira si algo vale durante una estancia concreta; ésta
   mira si algo se le va a caducar pronto al perro, sin que haya
   ninguna reserva de por medio.
   ============================================================ */

/* Días de antelación por defecto. Una semana, como pidió Santiago. */
export const AVISO_POR_DEFECTO = 7;

/* El antiparasitario externo no se puede tratar como los demás:
   una pipeta dura un mes y un collar seis o siete. Con un plazo
   único, o avisas tarde de la pipeta o das la lata con el collar.

   El propietario elige producto al meter la fecha, y puede poner
   sus propios días de aviso si quiere enterarse con más tiempo. */
export const PRODUCTOS_EXTERNOS = {
  pipeta: { nombre: "Pipeta", meses: 1,  aviso: 7 },
  collar: { nombre: "Collar", meses: 7,  aviso: 21 },
  spray:  { nombre: "Spray",  meses: 1,  aviso: 7 },
  otro:   { nombre: "Otro (pongo yo la fecha)", meses: null, aviso: 7 },
};

/** Hasta cuándo vale un registro. La fecha escrita a mano manda. */
export function caducidadDe(idRequisito, registro) {
  if (!registro?.fecha) return null;
  if (registro.validoHasta) return registro.validoHasta;

  if (idRequisito === "antiparasitario_externo") {
    const p = PRODUCTOS_EXTERNOS[registro.producto] || PRODUCTOS_EXTERNOS.pipeta;
    if (!p.meses) return null;            // "otro" sin fecha: no se puede saber
    return sumarMeses(registro.fecha, p.meses);
  }

  const r = REQUISITOS.find(x => x.id === idRequisito);
  if (!r) return null;
  if (r.maximoDiasAntes) {
    /* No caduca: tiene que ser reciente. El "vence" es el día en
       que deja de servir para entrar. */
    const d = aFecha(registro.fecha);
    d.setDate(d.getDate() + r.maximoDiasAntes);
    return aTexto(d);
  }
  return sumarMeses(registro.fecha, r.vigenciaMeses);
}

/** Cuántos días antes quiere avisarse de esto. */
function diasDeAviso(idRequisito, registro) {
  if (Number.isFinite(registro?.avisoDias)) return registro.avisoDias;
  if (idRequisito === "antiparasitario_externo") {
    const p = PRODUCTOS_EXTERNOS[registro?.producto];
    if (p) return p.aviso;
  }
  return AVISO_POR_DEFECTO;
}

/* ------------------------------------------------------------
   Papeles con fecha de caducidad.

   No son requisitos sanitarios y no impiden entrar, pero caducan
   igual y hay que avisar. La licencia y el seguro de PPP ya se
   guardaban desde el principio y NO se avisaba de ellos: el dato
   estaba ahí sin servir para nada.

   Avisan con un mes, no con una semana: renovar una licencia no
   es ponerle una pipeta. Hay que pedir cita, pagar y esperar.
   ------------------------------------------------------------ */
export const DOCUMENTOS = [
  { id: "licencia_deportiva",  nombre: "Licencia deportiva",
    campo: "licencia_deportiva_hasta", aviso: 30 },
  { id: "ppp_licencia_hasta",  nombre: "Licencia de perro potencialmente peligroso",
    campo: "ppp_licencia_hasta", aviso: 45 },
  { id: "ppp_seguro_hasta",    nombre: "Seguro de responsabilidad civil",
    campo: "ppp_seguro_hasta", aviso: 30 },
];

/**
 * Lo que se le va a caducar pronto a este perro, de lo más
 * urgente a lo menos. Lo que no tiene fecha NO se avisa aquí:
 * eso es cosa del alta, y si no, un perro recién dado de alta
 * soltaría siete avisos de golpe.
 */
export function avisosDelPerro(perro, hoy = new Date().toISOString().slice(0, 10)) {
  const guardado = perro?.sanidad || {};
  const avisos = [];

  for (const r of REQUISITOS) {
    const registro = guardado[r.id];
    if (!registro?.fecha) continue;

    const caduca = caducidadDe(r.id, registro);
    if (!caduca) continue;

    const dias = Math.round((aFecha(caduca) - aFecha(hoy)) / DIA);
    if (dias > diasDeAviso(r.id, registro)) continue;

    const quien = perro?.nombre ? `${perro.nombre}: ` : "";
    const mensaje = dias < 0
      ? `${quien}${r.nombre} venció el ${enCristiano(caduca)}.`
      : r.maximoDiasAntes
        ? `${quien}${r.nombre.toLowerCase()} deja de valer el ${enCristiano(caduca)}: ` +
          `tiene que ser de los ${r.maximoDiasAntes} días anteriores a la entrada.`
        : `${quien}${r.nombre} vence el ${enCristiano(caduca)}.`;

    avisos.push({
      id: r.id, nombre: r.nombre, obligatorio: r.obligatorio,
      caduca, dias,
      estado: dias < 0 ? "caducado" : "caduca-pronto",
      mensaje,
    });
  }

  /* Y los papeles, que caducan igual aunque no impidan entrar. */
  for (const doc of DOCUMENTOS) {
    const caduca = perro?.[doc.campo];
    if (!caduca) continue;

    const dias = Math.round((aFecha(caduca) - aFecha(hoy)) / DIA);
    if (dias > doc.aviso) continue;

    const quien = perro?.nombre ? `${perro.nombre}: ` : "";
    avisos.push({
      id: doc.id, nombre: doc.nombre, obligatorio: false,
      caduca, dias,
      estado: dias < 0 ? "caducado" : "caduca-pronto",
      mensaje: dias < 0
        ? `${quien}${doc.nombre.toLowerCase()} venció el ${enCristiano(caduca)}.`
        : `${quien}${doc.nombre.toLowerCase()} vence el ${enCristiano(caduca)}.`,
    });
  }

  return avisos.sort((a, b) => a.dias - b.dias);
}

/** Los avisos de todos sus perros, juntos y ordenados. */
export function avisosDeTodos(perros, hoy) {
  return perros.flatMap(p => avisosDelPerro(p, hoy)).sort((a, b) => a.dias - b.dias);
}
