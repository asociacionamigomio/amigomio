/* ============================================================
   Entrada con correo y contraseña. El registro es abierto: no
   hace falta invitación.

   Supabase guarda las contraseñas cifradas. Aquí no se guarda
   ninguna, ni se escribe en el registro de la consola.

   Ojo con `globalThis.window`: este fichero también lo cargan las
   pruebas, donde no hay navegador. Si se escribiera `window.` a
   secas, reventaría al importarlo.
   ============================================================ */

const w = globalThis.window;

export const supabase = (w && w.supabase && w.CONFIG?.configurado)
  ? w.supabase.createClient(w.CONFIG.SUPABASE_URL, w.CONFIG.SUPABASE_ANON)
  : null;

/* Los mensajes de Supabase vienen en inglés y de sistema.
   Al cliente se le habla en cristiano. */
const TRADUCCIONES = [
  [/Invalid login credentials/i,   "Ese correo y esa contraseña no cuadran. Prueba otra vez."],
  [/Email not confirmed/i,         "Todavía no has confirmado el correo. Mira tu bandeja, y la carpeta de spam."],
  [/User already registered/i,     "Ese correo ya está dado de alta. Prueba a entrar."],
  [/Password should be at least/i, "La contraseña se queda corta: mínimo 8 caracteres."],
  [/rate limit|too many requests/i,"Has probado muchas veces seguidas. Espera un minuto."],
  [/Unable to validate email/i,    "Ese correo no tiene buena pinta. Míralo otra vez."],
];

function enCristiano(error) {
  if (!error) return "";
  for (const [re, texto] of TRADUCCIONES) if (re.test(error.message)) return texto;
  return "Se nos ha atragantado algo. Inténtalo en un momento.";
}

export async function darseDeAlta(correo, contrasena) {
  const { error } = await supabase.auth.signUp({
    email: correo,
    password: contrasena,
    options: { emailRedirectTo: location.origin + location.pathname },
  });
  if (error) return { ok: false, mensaje: enCristiano(error) };
  return { ok: true,
           mensaje: "¡Hecho! Te hemos mandado un correo para confirmar. " +
                    "Pincha el enlace y ya estás dentro." };
}

export async function entrar(correo, contrasena) {
  const { error } = await supabase.auth.signInWithPassword({ email: correo, password: contrasena });
  if (error) return { ok: false, mensaje: enCristiano(error) };
  return { ok: true, mensaje: "" };
}

/**
 * Pedir el enlace para cambiar la contraseña.
 *
 * El mensaje es EL MISMO esté el correo dado de alta o no. Si
 * cambiara, cualquiera podría ir probando direcciones para
 * averiguar quién es cliente de AmigoMío — y eso, además de
 * feo, es un dato que no tenemos por qué dar.
 *
 * Por lo mismo, tampoco se devuelve el error de Supabase tal
 * cual: sólo se distingue el «has probado muchas veces», que sí
 * hace falta para que no se quede dándole al botón.
 */
export async function recuperarContrasena(correo) {
  const { error } = await supabase.auth.resetPasswordForEmail(correo, {
    redirectTo: location.origin + location.pathname,
  });

  if (error && /rate limit|too many requests/i.test(error.message))
    return { ok: false, mensaje: "Has pedido el enlace muchas veces seguidas. Espera un minuto." };

  return { ok: true, mensaje:
    "Si ese correo está dado de alta, te hemos mandado un enlace para poner " +
    "una contraseña nueva. Mira también la carpeta de spam." };
}

/** La contraseña nueva, ya con el enlace abierto. */
export async function cambiarContrasena(nueva) {
  const { error } = await supabase.auth.updateUser({ password: nueva });
  if (error) return { ok: false, mensaje: enCristiano(error) };
  return { ok: true, mensaje: "Contraseña cambiada. Ya puedes entrar con ella." };
}

export async function salir() {
  await supabase.auth.signOut();
}

export async function sesionActual() {
  if (!supabase) return { usuario: null, correoVerificado: false };
  const { data } = await supabase.auth.getSession();
  const usuario = data?.session?.user || null;
  return { usuario, correoVerificado: !!usuario?.email_confirmed_at };
}

/* La barrera: registro abierto, pero sin correo verificado no se reserva. */
export function puedeReservar(sesion) {
  return !!(sesion && sesion.usuario && sesion.correoVerificado);
}
