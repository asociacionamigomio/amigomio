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
