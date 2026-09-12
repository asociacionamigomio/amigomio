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

/* De cuántos en cuántos. Con más, una caída a mitad deja muchos
   en «enviando» y hay que rescatarlos a mano. */
const POR_PASADA = 40;

/* Cuántas veces se reintenta antes de rendirse. Reintentar sin
   fin contra una dirección que no existe es una factura
   creciendo sola. */
const MAX_INTENTOS = 3;

const REMITENTE = "AmigoMío <hola@amigomio.org>";

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
    .select("id, correo, asunto, cuerpo, intentos")
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

  return Response.json({ mandados, fallados });
});

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
