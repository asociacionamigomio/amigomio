/* ============================================================
   El cartero.

   Coge lo que hay en la cola `aviso` y lo manda. Nada más. Qué
   se avisa y cuándo se decide en Postgres (db/avisos.sql): aquí
   sólo se entrega.

   Tres cosas que no se tocan:

   1. ESTA SÍ USA service_role, porque escribe en la cola de
      todos los clientes. Por eso mismo vigila su propia puerta:
      si cualquiera pudiera dispararla, cualquiera podría vaciar
      la cola de correos de AmigoMío.
   2. EL AVISO SE MARCA «enviando» ANTES DE MANDARLO. Si se
      marcara después y el proceso se cayera en medio, el
      siguiente pase lo mandaría otra vez. Mejor un correo
      perdido que diez repetidos.
   3. TODO CORREO LLEVA SU VERSIÓN EN TEXTO PLANO. Hay quien no
      carga imágenes ni HTML, y un correo vacío parece una
      estafa.

   Se publica desde Edge Functions → Deploy a new function →
   Via Editor, en el navegador.

   Hacen falta dos secretos en Edge Functions → Secrets:
     RESEND_API_KEY  — la clave del proveedor de correo
     CRON_SECRET     — una contraseña larga, la misma que manda
                       el cron de Postgres en la cabecera
   ============================================================ */
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

/* De cuántos en cuántos. Con más, una caída a mitad deja muchos
   en «enviando» y hay que rescatarlos a mano. */
const POR_PASADA = 40;

/* Cuántas veces se reintenta antes de rendirse. Reintentar sin
   fin contra una dirección que no existe es una factura
   creciendo sola. */
const MAX_INTENTOS = 3;

/* La MISMA dirección desde la que Supabase manda los suyos —
   confirmar el correo, recuperar la contraseña—, que se
   configura en su panel. Si saliéramos de otra, al cliente le
   llegarían correos de AmigoMío desde dos sitios distintos:
   parece descuido, y a los filtros de spam les parece peor.

   Es un buzón al que no se contesta, así que TODOS los correos
   dicen por dónde sí se nos habla: el WhatsApp. */
const REMITENTE = "AmigoMío <noreply@amigomio.org>";

/* La clave PÚBLICA de los avisos al móvil. Es la misma que va
   en js/config.js: no es un secreto, el navegador la necesita.
   La privada vive en los secretos como VAPID_PRIVADA. */
const VAPID_PUBLICA =
  "BDRcWtxH6sMK6mR3WL2Ind1UzVvzIpV60wFk6UL4db_EZ4SA8-nqRObMmEuEVLLh3P17mZiZOtkAIm0RJT5pzkc";

Deno.serve(async (peticion) => {
  /* La puerta. Sin esto, cualquiera con la URL puede dispararla
     tantas veces como quiera.

     Va en SU PROPIA cabecera y no en `Authorization` a
     propósito: Supabase tiene «Verify JWT» encendido y usa
     `Authorization` para su anon key. Si el secreto fuera por
     ahí, Supabase rechazaría la llamada antes de que este
     código llegara a mirar nada. */
  const secreto = Deno.env.get("CRON_SECRET");
  const dado = peticion.headers.get("x-cron-secret");
  if (!secreto || dado !== secreto) {
    return new Response("No.", { status: 401 });
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const clave = Deno.env.get("RESEND_API_KEY");
  if (!clave) {
    return Response.json({ error: "Falta RESEND_API_KEY" }, { status: 500 });
  }

  /* Se cogen los pendientes y se marcan «enviando» de una vez.
     Dos pasadas a la vez no se pisan: la segunda ya no los ve. */
  const { data: cola, error } = await db
    .from("aviso")
    .select("id, cliente_id, correo, asunto, cuerpo, motivo, intentos")
    .eq("estado", "pendiente")
    .order("creado")
    .limit(POR_PASADA);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!cola?.length) return Response.json({ mandados: 0, nada: true });

  await db.from("aviso")
    .update({ estado: "enviando" })
    .in("id", cola.map((a) => a.id));

  let mandados = 0;
  let fallados = 0;

  for (const aviso of cola) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${clave}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: REMITENTE,
          to: [aviso.correo],
          subject: aviso.asunto,
          text: aviso.cuerpo,          // siempre, pase lo que pase
          html: comoHtml(aviso.cuerpo),
        }),
      });

      if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);

      await db.from("aviso")
        .update({ estado: "enviado", enviado: new Date().toISOString(), fallo: "" })
        .eq("id", aviso.id);
      mandados++;

    } catch (e) {
      fallados++;
      const intentos = (aviso.intentos ?? 0) + 1;

      /* A la tercera se rinde y deja dicho por qué. Un aviso
         «rendido» se queda en la tabla: es la única forma de
         enterarse de que a un cliente no le llega nada. */
      await db.from("aviso").update({
        estado: intentos >= MAX_INTENTOS ? "rendido" : "pendiente",
        intentos,
        fallo: String(e).slice(0, 500),
      }).eq("id", aviso.id);
    }
  }

  /* Y al móvil. Se manda DESPUÉS del correo y sin poder tumbar
     nada: un aviso que ya salió por correo no se vuelve a
     encolar porque el móvil falle. */
  const alMovil = await mandarAlMovil(db, cola);

  return Response.json({ mandados, fallados, ...alMovil });
});

/* ============================================================
   Los avisos al móvil.

   Misma cola que los correos: un aviso es un aviso, y lo que se
   decide en Postgres vale para los dos caminos. Aquí sólo se
   entrega.

   Las suscripciones CADUCAN SOLAS: el navegador las tira cuando
   le parece. Un 404 o un 410 no es un error que haya que
   reintentar — es que ese móvil ya no está, y hay que borrarla.
   Guardar suscripciones muertas es pagar por mandar a nadie.
   ============================================================ */
async function mandarAlMovil(db: any, cola: any[]) {
  const privada = Deno.env.get("VAPID_PRIVADA");
  if (!privada) return { push: 0, pushSaltado: "falta VAPID_PRIVADA" };

  webpush.setVapidDetails("mailto:info@amigomio.org", VAPID_PUBLICA, privada);

  /* A quién: los clientes de estos avisos que quieran push. */
  const clientes = [...new Set(cola.map((a) => a.cliente_id).filter(Boolean))];
  if (!clientes.length) return { push: 0 };

  const { data: suscripciones } = await db
    .from("suscripcion_push")
    .select("id, cliente_id, endpoint, p256dh, auth")
    .in("cliente_id", clientes);

  if (!suscripciones?.length) return { push: 0 };

  const { data: quieren } = await db
    .from("cliente").select("id, quiere_push").in("id", clientes);
  const apagado = new Set((quieren ?? [])
    .filter((c: any) => c.quiere_push === false).map((c: any) => c.id));

  let push = 0;
  const muertas: string[] = [];

  for (const aviso of cola) {
    if (apagado.has(aviso.cliente_id)) continue;

    for (const s of suscripciones.filter((x: any) => x.cliente_id === aviso.cliente_id)) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({
            titulo: aviso.asunto,
            /* Sólo el principio: en la pantalla de bloqueo no
               cabe más, y lo largo se lee en la aplicación. */
            cuerpo: primeraFrase(aviso.cuerpo),
            tag: aviso.motivo,
            ir: destinoDe(aviso.motivo),
          }),
        );
        push++;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) muertas.push(s.id);
      }
    }
  }

  if (muertas.length) await db.from("suscripcion_push").delete().in("id", muertas);

  return { push, muertas: muertas.length };
}

/* La primera frase de verdad, saltándose el «Hola:». */
function primeraFrase(cuerpo: string): string {
  const util = cuerpo.split(/\n{2,}/).find((p) => p.trim() && !/^hola/i.test(p.trim()));
  return (util ?? cuerpo).trim().slice(0, 160);
}

/* A dónde lleva cada aviso al tocarlo. Abrir por el principio
   obliga a buscar de qué hablaba. */
function destinoDe(motivo: string): string {
  if (motivo === "sanidad") return "./#perros";
  if (motivo === "pago" || motivo === "recordatorio" || motivo === "confirmacion")
    return "./#reservas";
  return "./";
}

/* El mismo texto, con párrafos. Sin plantillas ni imágenes: un
   correo de una residencia canina no es un folleto, y cuanto
   más sencillo, menos acaba en la bandeja de spam. */
function comoHtml(texto: string): string {
  const escapado = texto
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const parrafos = escapado
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 1em">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");

  return `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;
                      font-size:15px;line-height:1.55;color:#243B4A;max-width:34em">
            ${parrafos}
          </div>`;
}
