/* ============================================================
   La ficha del cliente. Lógica pura, sin navegador.

   Lo que se pide aquí no lo elegimos nosotros: sale del libro de
   registro que exige el programa sanitario del núcleo zoológico.
   Por eso el DNI y el domicilio no son opcionales.
   ============================================================ */

const vacio = v => v === undefined || v === null || String(v).trim() === "";

/* La letra del DNI se calcula con el resto de dividir el número
   entre 23. Comprobarlo aquí evita tener el libro de registro
   lleno de letras puestas a ojo. */
const LETRAS = "TRWAGMYFPDXBNJZSQVHLCKE";

export function dniValido(dni) {
  if (typeof dni !== "string") return false;
  const limpio = dni.trim().toUpperCase().replace(/[\s-]/g, "");

  /* NIE: la primera letra vale por un dígito (X=0, Y=1, Z=2). */
  const nie = limpio.match(/^([XYZ])(\d{7})([A-Z])$/);
  if (nie) {
    const numero = "XYZ".indexOf(nie[1]) + nie[2];
    return LETRAS[Number(numero) % 23] === nie[3];
  }

  const dniNormal = limpio.match(/^(\d{8})([A-Z])$/);
  if (!dniNormal) return false;
  return LETRAS[Number(dniNormal[1]) % 23] === dniNormal[2];
}

/* Ni validación estricta ni nada: sólo que parezca un teléfono.
   Hay gente con número extranjero y no vamos a dejarla fuera. */
export function telefonoValido(t) {
  if (typeof t !== "string") return false;
  const limpio = t.replace(/[\s().+-]/g, "");
  return /^\d{6,15}$/.test(limpio);
}

export function validarFichaCliente(datos) {
  const faltan = [];
  const falta = (campo, mensaje) => faltan.push({ campo, mensaje });

  if (vacio(datos.nombre))    falta("nombre", "¿Cómo te llamas?");
  if (vacio(datos.apellidos)) falta("apellidos", "Y tus apellidos.");

  if (vacio(datos.dni))            falta("dni", "Nos hace falta tu DNI para el libro de registro.");
  else if (!dniValido(datos.dni))  falta("dni", "Ese DNI no cuadra: repasa la letra del final.");

  if (vacio(datos.domicilio)) falta("domicilio", "Tu dirección, también para el libro.");

  if (vacio(datos.telefono))              falta("telefono", "Un teléfono, por si pasa algo mientras está aquí.");
  else if (!telefonoValido(datos.telefono)) falta("telefono", "Ese teléfono tiene pinta rara. Míralo otra vez.");

  /* Si hay alguien autorizado a recoger, en la entrega hay que
     comprobarle el DNI. Sin DNI, esa autorización no sirve. */
  if (!vacio(datos.recoge_nombre)) {
    if (vacio(datos.recoge_dni))
      falta("recoge_dni", "Nos falta su DNI: se lo pedimos al entregarle el perro.");
    else if (!dniValido(datos.recoge_dni))
      falta("recoge_dni", "Ese DNI no cuadra: repasa la letra del final.");
  }

  if (datos.consiente_datos !== true)
    falta("consiente_datos", "Necesitamos que aceptes cómo guardamos tus datos.");

  return { ok: faltan.length === 0, faltan };
}
