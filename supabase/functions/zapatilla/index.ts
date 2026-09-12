/* ============================================================
   ZAPATILLA — la perra que atiende en AmigoMío.

   Personaje: labradora chocolate, perra de terapia jubilada que
   ahora anda por la residencia. Habla desde dentro de la casa y
   no suelta coletillas de sistema.

   UNA LÍNEA QUE NO SE CRUZA: si le preguntan de verdad si es una
   persona o una máquina, no lo niega. Está comprometiendo dinero
   de la gente —reservas con pago por adelantado— y un cliente
   que se sienta engañado ahí es un problema de AmigoMío. Aparte,
   en la UE hay obligación de decirlo si preguntan. No lo va
   soltando sin venir a cuento: solo si se lo preguntan.

   Vive aquí y no en el navegador por una razón: la clave de la
   API de Claude no puede ir dentro de la página, porque
   cualquiera la leería y gastaría tu dinero.

   LO IMPORTANTE DE CÓMO ESTÁ MONTADO:

   Zapatilla habla con la base de datos USANDO LA SESIÓN DEL
   CLIENTE, no con una llave maestra. Eso significa que no puede
   hacer nada que ese cliente no pudiera hacer por su cuenta:
   ver perros ajenos, reservar a nombre de otro o saltarse el
   precio. No porque se lo pidamos por favor en el texto —un
   modelo de IA puede ignorar cualquier instrucción— sino porque
   la base de datos le dice que no.
   ============================================================ */
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODELO = "claude-opus-5";

const COMO_ES = `Eres Zapatilla. Trabajas en AmigoMío, el hotel y residencia canina
de El Marquesado, en Puerto Real (Cádiz).

QUIÉN ERES
Eres una perra labradora chocolate. Estuviste años de perra de terapia, con tu
chaleco azul, acompañando a gente en residencias y en el hospital. Ya estás
jubilada de aquello y ahora te pasas el día en la resi: recibes a los que
llegan, conoces a casi todos los perros que pasan por aquí y te has aprendido
los precios de tanto oírlos.

Hablas en primera persona y desde dentro de la casa: "aquí", "nosotros", "te
guardo el sitio". Santi y Elena son los que mandan; tú echas una mano.

No eres una recepcionista con guion. Eres la perra vieja de la casa que sabe
cómo va todo. Tienes paciencia de sobra —para eso fuiste perra de terapia— y
ninguna prisa.

CÓMO HABLAS
- Frases cortas, como quien coge el teléfono. Nunca como un folleto.
- Tuteas siempre. Cercana, sin ser empalagosa.
- Alguna broma de perra, con medida. Una de vez en cuando, no en cada mensaje.
- No sueltas avisos ni coletillas de sistema. No dices "como asistente",
  "estoy aquí para ayudarte" ni "no dudes en consultarme".
- Nada de listas con viñetas para cosas simples: se contesta hablando.
- Emojis solo si el cliente los usa primero.
- Si no sabes algo, lo dices y le pasas el WhatsApp: 673 229 399
  (https://wa.me/34673229399). Dices "háblanos", nunca "llámanos": hay quien
  no coge el teléfono ni queriendo.

SI TE PREGUNTAN QUÉ ERES
Si alguien pregunta de verdad si eres una persona, un robot o una máquina, no
lo niegas. Lo dices con naturalidad y sigues a lo tuyo, sin dar un discurso:
"Perra de verdad no soy, ojalá. Soy la que atiende aquí. Pero lo que te digo de
fechas y precios sale de la agenda de la casa, eso va a misa."
No lo sueltes si no te lo preguntan: no hace falta ir avisando.

LO QUE NUNCA HACES
- NUNCA te inventes un precio, una fecha libre ni una norma. Lo miras con tus
  herramientas. Si no tienes herramienta para algo, lo dices.
- NUNCA reserves sin haber enseñado antes el desglose completo y sin que el
  cliente te haya dicho que sí, claramente. Un "vale" a otra cosa no cuenta.
- NUNCA prometas una plaza antes de mirarla.
- Si una herramienta te dice que no, repites su motivo tal cual. Está escrito
  para el cliente: no lo suavices ni lo adornes.

LO QUE SABES DE LA CASA
- Se reserva un alojamiento entero, y dentro caben de 1 a 3 perros del mismo dueño.
- La reserva mínima son dos noches.
- Se paga por adelantado, por transferencia, y hay 24 horas para mandar el
  justificante. Si no llega, el sitio se suelta.
- Se cancela sin coste hasta 7 días antes. Después ya no.
- Entregas y recogidas: de lunes a viernes y domingos, de 10:00 a 12:30 y de
  16:30 a 19:00. Sábados solo de 10:00 a 12:30. Fuera de eso hay recargo y es
  previa consulta: el importe lo miras con recargo_por_hora, no lo digas de
  memoria ni contestes que no lo sabes. El recargo es POR CADA MOVIMIENTO: si
  lo deja y lo recoge fuera de hora, son dos. Dilo, que se da por sabido y
  luego sorprende. Manda siempre la franja más cara: un sábado a las 22:00 va
  por la de noche, no por la de fin de semana.
- Un perro que necesita manejo de peligrosidad va a un alojamiento propio y
  siempre solo. Eso lo deciden Santi y Elena, nunca el cliente y nunca tú.`;

/* ------------------------------------------------------------
   Las herramientas. Cada una llama a la base de datos; ninguna
   calcula nada por su cuenta.
   ------------------------------------------------------------ */
const HERRAMIENTAS: Anthropic.Tool[] = [
  {
    name: "cuanto_cuesta",
    description:
      "Calcula el precio de una estancia, con su desglose línea a línea. " +
      "Úsala SIEMPRE antes de decir un importe. No calcules tú.",
    input_schema: {
      type: "object",
      properties: {
        entrada: { type: "string", description: "Fecha y hora de entrada, 'AAAA-MM-DD HH:MM'" },
        salida:  { type: "string", description: "Fecha y hora de recogida, 'AAAA-MM-DD HH:MM'" },
        perros:  { type: "integer", description: "Cuántos perros van en el mismo alojamiento (1 a 3)" },
      },
      required: ["entrada", "salida", "perros"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "hay_sitio",
    description:
      "Comprueba si queda alojamiento libre para esas fechas. Úsala SIEMPRE antes " +
      "de decir que hay sitio. Devuelve el motivo si no lo hay.",
    input_schema: {
      type: "object",
      properties: {
        entrada: { type: "string" },
        salida:  { type: "string" },
        perros:  { type: "integer" },
      },
      required: ["entrada", "salida", "perros"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "recargo_por_hora",
    description:
      "Cuánto cuesta entregar o recoger a una hora concreta. Úsala SIEMPRE que " +
      "pregunten por una hora fuera del horario normal, en vez de decir que no lo sabes. " +
      "Devuelve 0 si esa hora está dentro de horario.",
    input_schema: {
      type: "object",
      properties: {
        momento: { type: "string",
                   description: "Día y hora, 'AAAA-MM-DD HH:MM'. Si solo te dan la hora, " +
                                "usa un día que encaje con lo que preguntan." },
      },
      required: ["momento"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "sus_perros",
    description:
      "Los perros que este cliente tiene dados de alta, con su nombre, chip y " +
      "fechas de vacunas. Úsala antes de reservar, para saber a quién se refiere.",
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
    strict: true,
  },
  {
    name: "dar_de_alta_perro",
    description:
      "Da de alta un perro nuevo en la ficha del cliente. Pregúntale todo antes: " +
      "nombre, número de chip (15 dígitos), fecha de nacimiento y sexo. " +
      "La raza, la comida y los cuidados son opcionales pero ayudan mucho.",
    input_schema: {
      type: "object",
      properties: {
        nombre:           { type: "string" },
        chip:             { type: "string", description: "15 dígitos" },
        fecha_nacimiento: { type: "string", description: "AAAA-MM-DD" },
        sexo:             { type: "string", enum: ["macho", "hembra"] },
        raza:             { type: "string" },
        pautas_alimentacion: { type: "string" },
        cuidados:         { type: "string" },
      },
      required: ["nombre", "chip", "fecha_nacimiento", "sexo", "raza",
                 "pautas_alimentacion", "cuidados"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "crear_reserva",
    description:
      "Crea la reserva. SOLO después de enseñar el desglose de cuanto_cuesta y de " +
      "que el cliente diga que sí claramente. Si la base de datos la rechaza, " +
      "cuéntale el motivo tal cual.",
    input_schema: {
      type: "object",
      properties: {
        perros:  { type: "array", items: { type: "string" },
                   description: "Los identificadores de los perros, de sus_perros" },
        entrada: { type: "string" },
        salida:  { type: "string" },
      },
      required: ["perros", "entrada", "salida"],
      additionalProperties: false,
    },
    strict: true,
  },
];

/* ------------------------------------------------------------
   Ejecutar una herramienta. Todo pasa por la base de datos con
   la sesión del cliente: sus reglas se aplican solas.
   ------------------------------------------------------------ */
async function ejecutar(nombre: string, args: any, db: any, quienEs: string) {
  try {
    switch (nombre) {
      case "cuanto_cuesta": {
        const { data, error } = await db.rpc("presupuesto", {
          la_entrada: args.entrada, la_salida: args.salida,
          el_tipo: "normal", los_perros: args.perros, con_curas: 0, los_extras: [],
        });
        if (error) return { error: error.message };
        return data;
      }
      case "hay_sitio": {
        const { data, error } = await db.rpc("hay_sitio", {
          la_entrada: args.entrada, la_salida: args.salida,
          el_tipo: "normal", los_perros: args.perros,
        });
        if (error) return { error: error.message };
        return data;
      }
      case "recargo_por_hora": {
        const { data, error } = await db.rpc("recargo_horario", { momento: args.momento });
        if (error) return { error: error.message };
        return { euros: data, dentro_de_horario: Number(data) === 0 };
      }
      case "sus_perros": {
        const { data, error } = await db.from("perro")
          .select("id, nombre, chip, fecha_nacimiento, sexo, raza, sanidad, agresivo_con_personas");
        if (error) return { error: error.message };
        return data;
      }
      case "dar_de_alta_perro": {
        const { data, error } = await db.from("perro").insert({
          cliente_id: quienEs,
          nombre: args.nombre,
          chip: String(args.chip).replace(/[\s-]/g, ""),
          fecha_nacimiento: args.fecha_nacimiento,
          sexo: args.sexo,
          raza: args.raza ?? "",
          pautas_alimentacion: args.pautas_alimentacion ?? "",
          cuidados: args.cuidados ?? "",
        }).select("id, nombre").single();
        if (error) return { error: error.message };
        return data;
      }
      case "crear_reserva": {
        const { data, error } = await db.rpc("crear_reserva", {
          el_cliente: quienEs, los_perros: args.perros,
          la_entrada: args.entrada, la_salida: args.salida,
          los_extras: [], quien: "zapatilla",
        });
        if (error) return { error: error.message };
        return data;
      }
      default:
        return { error: "Esa herramienta no existe." };
    }
  } catch (e) {
    return { error: String(e?.message ?? e) };
  }
}

/* ------------------------------------------------------------ */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cabeceras() });

  try {
    const jwt = req.headers.get("Authorization");
    if (!jwt) return responde({ error: "Hay que entrar con tu cuenta para hablar conmigo." }, 401);

    /* La sesión del cliente, no una llave maestra: las reglas de
       la base de datos se aplican igual que si reservara él. */
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: jwt } } },
    );

    const { data: { user } } = await db.auth.getUser();
    if (!user) return responde({ error: "No hemos podido comprobar tu cuenta." }, 401);

    const { mensajes } = await req.json();
    if (!Array.isArray(mensajes)) return responde({ error: "Faltan los mensajes." }, 400);

    const claude = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });
    const historia: Anthropic.MessageParam[] = [...mensajes];

    /* El bucle: Claude pide herramientas, se las damos, sigue.
       El tope evita que una conversación se vaya de madre y de
       factura. */
    for (let vuelta = 0; vuelta < 8; vuelta++) {
      const respuesta = await claude.messages.create({
        model: MODELO,
        max_tokens: 4096,
        /* Esto es una conversación de mostrador, no un problema
           difícil: con esfuerzo bajo contesta antes y cuesta menos,
           y la calidad aguanta de sobra. Siete segundos esperando
           a que te digan un precio se hacen eternos. */
        output_config: { effort: "low" },
        system: [{ type: "text", text: COMO_ES, cache_control: { type: "ephemeral" } }],
        tools: HERRAMIENTAS,
        messages: historia,
      });

      historia.push({ role: "assistant", content: respuesta.content });

      if (respuesta.stop_reason !== "tool_use") {
        const texto = respuesta.content
          .filter((b) => b.type === "text").map((b: any) => b.text).join("\n");
        return responde({ texto, historia });
      }

      const resultados: Anthropic.ToolResultBlockParam[] = [];
      for (const bloque of respuesta.content) {
        if (bloque.type !== "tool_use") continue;
        const salida = await ejecutar(bloque.name, bloque.input, db, user.id);
        resultados.push({
          type: "tool_result",
          tool_use_id: bloque.id,
          content: JSON.stringify(salida),
          is_error: !!(salida as any)?.error,
        });
      }
      historia.push({ role: "user", content: resultados });
    }

    return responde({
      texto: "Uy, me he liado. ¿Me lo cuentas otra vez, más corto? " +
             "O escríbenos al WhatsApp 673 229 399 (https://wa.me/34673229399) " +
             "y te atendemos nosotros.",
      historia,
    });

  } catch (e) {
    console.error("[Zapatilla]", e);
    return responde({ error: "Se nos ha atragantado algo. Inténtalo en un momento." }, 500);
  }
});

const cabeceras = () => ({
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
});

const responde = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: cabeceras() });
