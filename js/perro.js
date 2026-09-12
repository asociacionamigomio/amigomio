/* ============================================================
   Reglas del perro. Funciones puras: entran datos, salen datos.
   Ni tocan el navegador ni la base de datos, para poder probarlas
   de verdad y no a base de simulacros.
   ============================================================ */

/** Quita espacios y guiones: la gente copia el chip de la cartilla como puede. */
export function normalizarChip(chip) {
  if (typeof chip !== "string") return "";
  return chip.replace(/[\s-]/g, "");
}

/** Los microchips ISO son 15 dígitos. Ni 14 ni 16, y sin letras. */
export function chipValido(chip) {
  return /^\d{15}$/.test(normalizarChip(chip));
}

/** Meses cumplidos. Si la fecha es futura devuelve 0, nunca negativo. */
export function edadEnMeses(fechaNacimiento, hoy) {
  const n = new Date(fechaNacimiento + "T00:00:00");
  const h = new Date(hoy + "T00:00:00");
  if (isNaN(n) || isNaN(h) || n > h) return 0;
  let meses = (h.getFullYear() - n.getFullYear()) * 12 + (h.getMonth() - n.getMonth());
  if (h.getDate() < n.getDate()) meses--;
  return Math.max(0, meses);
}

/** Cachorro hasta los 6 meses: el programa sanitario los aloja aparte. */
export function esCachorro(fechaNacimiento, hoy) {
  return edadEnMeses(fechaNacimiento, hoy) < 6;
}

/** Agresivo con personas: sólo alojamiento especial, y siempre solo. */
export function necesitaAlojamientoEspecial(perro) {
  return perro?.agresivoConPersonas === true;
}

/**
 * ¿Pueden ir estos dos al mismo alojamiento?
 * Devuelve el motivo para poder enseñárselo al cliente tal cual.
 */
export function puedenCompartir(a, b) {
  if (necesitaAlojamientoEspecial(a))
    return { si: false, motivo: `${a.nombre} necesita alojamiento propio y no puede compartir.` };
  if (necesitaAlojamientoEspecial(b))
    return { si: false, motivo: `${b.nombre} necesita alojamiento propio y no puede compartir.` };

  const acepta = (uno, otro) => {
    if (uno.sociable === "ninguno") return `${uno.nombre} está mejor solo.`;
    if (uno.sociable === "machos"  && otro.sexo !== "macho")
      return `${uno.nombre} solo se lleva bien con machos.`;
    if (uno.sociable === "hembras" && otro.sexo !== "hembra")
      return `${uno.nombre} solo se lleva bien con hembras.`;
    return null;
  };

  const motivo = acepta(a, b) || acepta(b, a);
  return motivo ? { si: false, motivo } : { si: true, motivo: "" };
}
