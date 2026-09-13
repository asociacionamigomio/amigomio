/* ============================================================
   Avisos en el móvil.

   Tres cosas que hay que tener claras antes de tocar esto:

   1. EL PERMISO SE PIDE UNA SOLA VEZ EN LA VIDA. Si el usuario
      dice que no, el navegador no vuelve a preguntar nunca, y
      desde la página no hay forma de insistir: tiene que ir a
      los ajustes del navegador a mano. Por eso NO se pide al
      entrar, cuando no sabe de qué va: se pide cuando él dice
      que los quiere.

   2. EN IPHONE SÓLO FUNCIONAN CON LA APP INSTALADA en la
      pantalla de inicio. En Safari normal Apple no las permite.
      Eso se dice, no se deja que lo descubran.

   3. LA SUSCRIPCIÓN CADUCA SOLA. El navegador la tira cuando le
      parece —al limpiar datos, al pasar meses—. Por eso se
      vuelve a comprobar cada vez que entra, y por eso el
      servidor borra las que fallan.
   ============================================================ */
import { supabase, usuarioActual } from "./sesion.js";

const w = globalThis.window;

/** ¿Puede este navegador, siquiera? */
export function hayPush() {
  return !!(w && "serviceWorker" in navigator && "PushManager" in w
            && "Notification" in w);
}

/** En iPhone, sólo con la app instalada. */
export function esIphoneSinInstalar() {
  if (!w) return false;
  const esApple = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const instalada = w.matchMedia?.("(display-mode: standalone)").matches
                 || navigator.standalone === true;
  return esApple && !instalada;
}

export const estadoPermiso = () => (w && "Notification" in w)
  ? Notification.permission : "unsupported";

/* La clave pública viene en base64url y el navegador la quiere
   en bytes. Esto es sólo traducir. */
function aBytes(base64url) {
  const relleno = "=".repeat((4 - base64url.length % 4) % 4);
  const normal = (base64url + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const crudo = atob(normal);
  return Uint8Array.from([...crudo].map(c => c.charCodeAt(0)));
}

const enBase64 = buffer =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/**
 * Encender los avisos. Pide permiso y guarda la suscripción.
 *
 * Devuelve siempre un mensaje en cristiano, también cuando no
 * se puede: un botón que no hace nada al pulsarlo es lo peor.
 */
export async function encenderPush() {
  if (!hayPush())
    return { ok: false, mensaje: "Este navegador no sabe mandar avisos al móvil." };

  if (esIphoneSinInstalar())
    return { ok: false, mensaje:
      "En iPhone hay que instalar la aplicación primero: toca Compartir y " +
      "«Añadir a pantalla de inicio». Luego ábrela desde ahí y vuelve a intentarlo." };

  if (Notification.permission === "denied")
    return { ok: false, mensaje:
      "Dijiste que no a los avisos y el navegador ya no vuelve a preguntar. " +
      "Se cambia en los ajustes del navegador, en los permisos de esta página." };

  const permiso = Notification.permission === "granted"
    ? "granted" : await Notification.requestPermission();

  if (permiso !== "granted")
    return { ok: false, mensaje: "Sin permiso no podemos avisarte. Puedes darlo más adelante." };

  const registro = await navigator.serviceWorker.ready;

  /* Si ya había una, se reutiliza: pedir otra dejaría la vieja
     viva y llegarían dos avisos. */
  const suscripcion = await registro.pushManager.getSubscription()
    || await registro.pushManager.subscribe({
         userVisibleOnly: true,
         applicationServerKey: aBytes(w.CONFIG.VAPID_PUBLICA),
       });

  const user = await usuarioActual();
  if (!user) return { ok: false, mensaje: "Vuelve a entrar, que se ha caído la sesión." };

  const claves = suscripcion.toJSON().keys;

  /* `upsert` sobre el endpoint: el mismo móvil entrando otra vez
     no puede duplicar la suscripción. */
  const { error } = await supabase.from("suscripcion_push").upsert({
    cliente_id: user.id,
    endpoint: suscripcion.endpoint,
    p256dh: claves.p256dh,
    auth: claves.auth,
    aparato: navigator.userAgent.slice(0, 120),
    fallos: 0,
  }, { onConflict: "endpoint" });

  if (error) return { ok: false, mensaje: "No hemos podido guardarlo. Inténtalo otra vez." };

  await supabase.from("cliente").update({ quiere_push: true }).eq("id", user.id);
  return { ok: true, mensaje: "Listo. Te avisaremos en este móvil." };
}

/** Apagarlos. Si no se puede parar, es spam. */
export async function apagarPush() {
  const user = await usuarioActual();

  try {
    const registro = await navigator.serviceWorker.ready;
    const suscripcion = await registro.pushManager.getSubscription();
    if (suscripcion) {
      await supabase.from("suscripcion_push").delete().eq("endpoint", suscripcion.endpoint);
      await suscripcion.unsubscribe();
    }
  } catch { /* si el navegador no colabora, al menos se apaga en la base */ }

  if (user) await supabase.from("cliente").update({ quiere_push: false }).eq("id", user.id);
  return { ok: true, mensaje: "Apagados. No te avisaremos al móvil." };
}

/** ¿Está encendido EN ESTE móvil? */
export async function pushEncendida() {
  if (!hayPush() || Notification.permission !== "granted") return false;
  try {
    const registro = await navigator.serviceWorker.ready;
    return !!(await registro.pushManager.getSubscription());
  } catch { return false; }
}
