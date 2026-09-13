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

/* ============================================================
   Quién eres.

   LEYENDO LA SESIÓN, que está guardada en este mismo móvil. NO
   preguntándoselo al servidor.

   Esto costó dos días de «no carga, no abre» (13/09/2026). Por
   todo el código había `supabase.auth.getUser()`, que parece que
   lee un dato y en realidad manda una petición a internet. Y la
   librería, por dentro, hace esto:

     catch(e){ if (esErrorDeAutenticación(e)) return {user:null};
               throw e }

   Un fallo de red NO es un error de autenticación. Así que no
   devuelve «no hay usuario»: REVIENTA. Como `miFicha()` es de lo
   primero que hace el arranque, un segundo de mala cobertura al
   abrir dejaba la aplicación muerta — en el ordenador jamás, en
   un móvil a la primera.

   Que la sesión guardada pueda estar caducada no importa: quién
   puede ver qué NO lo decide el navegador, lo decide RLS. Aquí
   sólo hace falta para saber cuáles son «mis» cosas y para no
   pintar pantallas que no tocan.
   ============================================================ */
export async function usuarioActual() {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user || null;
  } catch {
    /* Ni así. Sin usuario se pinta la entrada, que es una pantalla
       que funciona; morirse no lo es. */
    return null;
  }
}

export async function sesionActual() {
  const usuario = await usuarioActual();
  return { usuario, correoVerificado: !!usuario?.email_confirmed_at };
}

/* La barrera: registro abierto, pero sin correo verificado no se reserva. */
export function puedeReservar(sesion) {
  return !!(sesion && sesion.usuario && sesion.correoVerificado);
}
