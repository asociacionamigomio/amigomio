/* ============================================================
   Todo lo que habla con Supabase pasa por aquí. Así, el día que
   haya que cambiar cómo se guardan las cosas, se toca un fichero
   y no doce.

   Los mensajes de error que salen de aquí se le enseñan tal cual
   al cliente: están escritos para que los entienda.
   ============================================================ */
import { supabase } from "./sesion.js";
import { normalizarChip } from "./perro.js";

/* ------------------------------------------------------------
   Mi ficha de cliente
   ------------------------------------------------------------ */
export async function miFicha() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  let { data } = await supabase.from("cliente").select("*").eq("id", user.id).maybeSingle();

  if (!data) {
    /* Primera vez que entra: se crea su ficha sola. Si su correo
       está en admin_autorizado, el trigger la marca de
       administración sin que nadie toque nada.

       El error NO se traga: callarlo costó una tarde de buscar por
       qué nadie era administrador. */
    const { data: nueva, error } = await supabase.from("cliente")
      .insert({ id: user.id }).select().single();
    if (error) {
      console.error("[AmigoMío] no se pudo crear la ficha de cliente:", error);
      throw error;
    }
    data = nueva;
  }
  return data;
}

export async function guardarMiFicha(datos) {
  const { data: { user } } = await supabase.auth.getUser();
  /* es_admin y paga_en_persona no se mandan nunca desde aquí: los
     devuelve a su sitio el trigger cliente_no_se_asciende, pero
     mejor ni intentarlo. */
  const { es_admin, paga_en_persona, id, creado, ...resto } = datos;
  const { error } = await supabase.from("cliente").update(resto).eq("id", user.id);
  if (error) return { ok: false, mensaje: "No hemos podido guardar tus datos." };
  return { ok: true, mensaje: "Guardado." };
}

/* ------------------------------------------------------------
   Perros
   ------------------------------------------------------------ */
/**
 * MIS perros. Se filtra por el dueño a propósito, aunque RLS ya
 * proteja: administración puede ver los perros de todo el mundo,
 * así que sin este filtro «Mis perros» le enseñaría los de todos
 * los clientes, y los avisos de caducidad mezclarían las vacunas
 * de sus perros con las de los ajenos.
 *
 * A los perros de los clientes se llega por el panel de Clientes,
 * que es donde tiene sentido.
 */
export async function misPerros() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase.from("perro")
    .select("*").eq("cliente_id", user.id).order("nombre");
  if (error) throw error;
  return data || [];
}

export async function unPerro(id) {
  const { data, error } = await supabase.from("perro").select("*").eq("id", id).single();
  if (error) return null;
  return data;
}

export async function guardarPerro(datos, { borrador = false } = {}) {
  const { data: { user } } = await supabase.auth.getUser();

  if (datos.id) {
    /* Chip y nombre no se mandan en las modificaciones: los rechaza
       el trigger y además no queremos ni intentarlo. Para cambiarlos
       está pedirCambio(). */
    const { id, chip, nombre, cliente_id, creado, ...resto } = datos;
    const { error } = await supabase.from("perro")
      .update({ ...resto, borrador }).eq("id", datos.id);
    if (error) return { ok: false, mensaje: mensajeDeError(error) };
    return { ok: true, id: datos.id, mensaje: "Guardado." };
  }

  const fila = { ...datos, cliente_id: user.id, borrador,
                 chip: normalizarChip(datos.chip || "") };
  delete fila.id;

  const { data, error } = await supabase.from("perro").insert(fila).select("id").single();
  if (error) return { ok: false, mensaje: mensajeDeError(error) };
  return { ok: true, id: data.id, mensaje: "" };
}

export async function borrarPerro(id) {
  const { error } = await supabase.from("perro").delete().eq("id", id);
  return { ok: !error };
}

function mensajeDeError(error) {
  const m = error?.message || "";
  if (/duplicate key.*perro_chip/i.test(m) || /duplicate key/i.test(m) && /chip/i.test(m))
    return "Ese chip ya está dado de alta. Si es tu perro y no lo ves aquí, avísanos.";
  if (/chip solo se cambia|nombre solo se cambia/i.test(m))
    return m;  // ya viene escrito para el cliente, desde el trigger
  if (/row-level security|violates row-level/i.test(m))
    return "Eso no lo puedes tocar desde aquí.";
  return "No hemos podido guardarlo. Inténtalo en un momento.";
}

/* ------------------------------------------------------------
   Solicitudes de cambio de chip o nombre
   ------------------------------------------------------------ */
export async function pedirCambio({ perroId, campo, valorActual, valorNuevo, motivo }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("solicitud_cambio").insert({
    perro_id: perroId, cliente_id: user.id, campo,
    valor_actual: valorActual, valor_nuevo: valorNuevo, motivo: motivo || "",
  });
  if (error) return { ok: false, mensaje: "No hemos podido enviar la solicitud." };
  return { ok: true, mensaje: "Recibido. Lo miramos y te decimos algo." };
}

export async function misSolicitudes(perroId) {
  const { data } = await supabase.from("solicitud_cambio")
    .select("*").eq("perro_id", perroId).order("creada", { ascending: false });
  return data || [];
}

/* ------------------------------------------------------------
   Administración
   ------------------------------------------------------------ */
export async function solicitudesPendientes() {
  /* `cliente!...cliente_id_fkey` y no `cliente` a secas: la tabla
     apunta DOS veces a cliente —quién la pide y quién la resuelve—
     y sin decir cuál, Supabase se niega a adivinar. */
  const { data, error } = await supabase.from("solicitud_cambio")
    .select("*, perro(nombre, chip), cliente!solicitud_cambio_cliente_id_fkey(nombre, apellidos, telefono)")
    .eq("estado", "pendiente").order("creada");
  if (error) throw error;
  return data || [];
}

/**
 * Aprobar NO es sólo marcar la solicitud: hay que escribir el valor
 * nuevo en el perro. Si se hace sólo lo primero, administración cree
 * que lo ha resuelto y el perro sigue con el chip viejo hasta que
 * alguien se presenta con un animal que no coincide.
 */
export async function resolverSolicitud(id, { aprobar }) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data: solicitud, error: e1 } = await supabase
    .from("solicitud_cambio").select("*").eq("id", id).single();
  if (e1) return { ok: false, mensaje: "No encontramos esa solicitud." };

  if (aprobar) {
    const { error: e2 } = await supabase.from("perro")
      .update({ [solicitud.campo]: solicitud.valor_nuevo })
      .eq("id", solicitud.perro_id);
    if (e2) return { ok: false, mensaje: "No hemos podido cambiar el dato del perro." };
  }

  const { error: e3 } = await supabase.from("solicitud_cambio").update({
    estado: aprobar ? "aprobada" : "rechazada",
    resuelta_por: user.id,
    resuelta_el: new Date().toISOString(),
  }).eq("id", id);

  if (e3) return { ok: false,
                   mensaje: "El dato se cambió, pero no pudimos cerrar la solicitud. Avísanos." };

  return { ok: true, mensaje: aprobar ? "Aprobada y aplicada." : "Rechazada." };
}

export async function clientes(busqueda = "") {
  let q = supabase.from("cliente").select("*").order("apellidos");
  if (busqueda) {
    const b = busqueda.replace(/[%,]/g, "");
    q = q.or(`nombre.ilike.%${b}%,apellidos.ilike.%${b}%,telefono.ilike.%${b}%,dni.ilike.%${b}%`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function perrosDe(clienteId) {
  const { data } = await supabase.from("perro").select("*").eq("cliente_id", clienteId).order("nombre");
  return data || [];
}

export async function autorizarPagoEnPersona(clienteId, valor) {
  const { error } = await supabase.from("cliente")
    .update({ paga_en_persona: valor }).eq("id", clienteId);
  if (error) return { ok: false, mensaje: "No hemos podido cambiarlo." };
  return { ok: true, mensaje: valor ? "Puede pagar en persona." : "Ya no puede pagar en persona." };
}

/* ------------------------------------------------------------
   Tarifas, festivos, extras y ajustes.

   Las tres funciones del motor —presupuesto, hay_sitio y
   precio_noche— viven en la base de datos y se llaman con rpc().
   Esa es la misma puerta por la que entrará Zapatilla: el
   asistente no calcula precios, los pregunta. Si se inventa uno,
   el motor le dice que no igual que a todo el mundo.
   ------------------------------------------------------------ */
export async function presupuesto({ entrada, salida, tipo = "normal", perros = 1,
                                    conCuras = 0, extras = [] }) {
  const { data, error } = await supabase.rpc("presupuesto", {
    la_entrada: entrada, la_salida: salida, el_tipo: tipo,
    los_perros: perros, con_curas: conCuras, los_extras: extras,
  });
  if (error) return { ok: false, mensaje: error.message };
  return { ok: true, ...data };
}

export async function haySitio({ entrada, salida, tipo = "normal", perros = 1 }) {
  const { data, error } = await supabase.rpc("hay_sitio", {
    la_entrada: entrada, la_salida: salida, el_tipo: tipo, los_perros: perros,
  });
  if (error) return { hay: false, motivo: "No hemos podido comprobarlo." };
  return data;
}

export async function tarifas() {
  const { data } = await supabase.from("tarifa").select("*").order("id");
  return data || [];
}

export async function guardarTarifa(id, importe) {
  const { error } = await supabase.from("tarifa").update({ importe }).eq("id", id);
  return { ok: !error, mensaje: error ? "No hemos podido guardarlo." : "Guardado." };
}

export async function festivos(anio) {
  const { data } = await supabase.from("festivo").select("*")
    .gte("fecha", `${anio}-01-01`).lte("fecha", `${anio}-12-31`).order("fecha");
  return data || [];
}

export async function anadirFestivo({ fecha, nombre, ambito = "local" }) {
  const { error } = await supabase.from("festivo").insert({ fecha, nombre, ambito });
  if (error) return { ok: false, mensaje: /duplicate/i.test(error.message)
    ? "Ese día ya estaba puesto." : "No hemos podido añadirlo." };
  return { ok: true, mensaje: "Añadido." };
}

export async function quitarFestivo(fecha) {
  const { error } = await supabase.from("festivo").delete().eq("fecha", fecha);
  return { ok: !error };
}

export async function extras() {
  const { data } = await supabase.from("extra").select("*").order("lo_cobra").order("nombre");
  return data || [];
}

export async function guardarExtra(id, cambios) {
  const { error } = await supabase.from("extra").update(cambios).eq("id", id);
  return { ok: !error, mensaje: error ? "No hemos podido guardarlo." : "Guardado." };
}

export async function ajustes() {
  const { data } = await supabase.from("ajuste").select("*").order("clave");
  return data || [];
}

export async function guardarAjuste(clave, valor) {
  const { error } = await supabase.from("ajuste").update({ valor }).eq("clave", clave);
  return { ok: !error, mensaje: error ? "No hemos podido guardarlo." : "Guardado." };
}

/* ------------------------------------------------------------
   Reservas
   ------------------------------------------------------------ */
export async function crearReserva({ perros, entrada, salida, extras = [], quien = "cliente" }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.rpc("crear_reserva", {
    el_cliente: user.id, los_perros: perros,
    la_entrada: entrada, la_salida: salida,
    los_extras: extras, quien,
  });
  /* El motor rechaza con mensajes escritos para el cliente:
     se le enseñan tal cual, no se adornan. */
  if (error) return { ok: false, mensaje: error.message };
  return { ok: true, ...data };
}

export async function misReservas() {
  const { data, error } = await supabase.from("reserva")
    .select("*, alojamiento(nombre, tipo), reserva_perro(perro(nombre))")
    .order("entrada", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function reservasAbiertas() {
  const { data } = await supabase.rpc("ajuste_publico", { la_clave: "reservas_abiertas" });
  return data === "si";
}

export async function cancelarReserva(id) {
  const { error } = await supabase.from("reserva")
    .update({ estado: "cancelada" }).eq("id", id);
  return { ok: !error, mensaje: error ? "No hemos podido cancelarla." : "Cancelada." };
}
