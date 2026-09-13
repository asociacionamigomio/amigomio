/* ============================================================
   Todo lo que habla con Supabase pasa por aquí. Así, el día que
   haya que cambiar cómo se guardan las cosas, se toca un fichero
   y no doce.

   Los mensajes de error que salen de aquí se le enseñan tal cual
   al cliente: están escritos para que los entienda.
   ============================================================ */
import { supabase, usuarioActual } from "./sesion.js";
import { normalizarChip } from "./perro.js";
import { rutaDocumento, encoger, queLePasa, LADO_FOTO } from "./documentos.js";

/* ------------------------------------------------------------
   Mi ficha de cliente
   ------------------------------------------------------------ */
/* Las columnas que seguro se pueden leer aunque la base se haya
   quedado a medias. Es el recambio, no lo normal: lo normal es
   `select("*")`. */
const COLUMNAS_DE_SIEMPRE =
  "id, nombre, apellidos, dni, domicilio, telefono, recoge_nombre, recoge_dni, " +
  "paga_en_persona, es_admin, descuento_pct, descuento_nota, consiente_datos, creado";

export async function miFicha() {
  const user = await usuarioActual();
  if (!user) return null;

  let { data, error: alPreguntar } = await supabase.from("cliente")
    .select("*").eq("id", user.id).maybeSingle();

  /* 42501 = «permiso denegado». Los permisos de `cliente` están
     dados COLUMNA POR COLUMNA (db/perfiles.sql), así que en cuanto
     se añade una columna nueva a la tabla y no se apunta en esa
     lista, `select("*")` deja de valer y se cae la ficha ENTERA.

     Pasó el 13/09/2026 con `quiere_push`, que llega con el SQL de
     las notificaciones: desde el momento en que se aplicó, ningún
     cliente podía traer su ficha. Sin ficha no hay nombre y no
     salen las opciones de administración.

     Se reintenta pidiendo las columnas de siempre. Lo que se
     pierde es la casilla nueva; lo que se salva es la aplicación.
     El arreglo de verdad está en la base, pero el navegador se
     despliega antes que la base. Siempre. */
  if (alPreguntar?.code === "42501") {
    console.warn("[AmigoMío] faltan permisos de alguna columna de cliente; " +
                 "se piden las de siempre. Hay que aplicar db/perfiles.sql.");
    ({ data, error: alPreguntar } = await supabase.from("cliente")
      .select(COLUMNAS_DE_SIEMPRE).eq("id", user.id).maybeSingle());
  }

  /* UNA CONSULTA QUE FALLA NO ES UNA CONSULTA QUE NO ENCUENTRA NADA.

     Aquí estaba el «no carga, no abre» de Santiago (13/09/2026).
     Esto era `let { data } = await ...`, con el error a la basura.
     Si la consulta fallaba —un segundo de mala cobertura—, `data`
     venía vacío, el código concluía «es la primera vez que entra»
     e intentaba CREARLE una ficha que ya tenía. Eso fallaba, y ahí
     sí reventaba: se llevaba por delante el arranque entero.

     Por eso le pasaba a él y no a un visitante sin entrar: un
     visitante no llega nunca hasta esta línea. Y confundir las dos
     cosas no sólo rompe la pantalla — escribe en la base de datos. */
  if (alPreguntar) {
    console.error("[AmigoMío] no se pudo preguntar por la ficha:", alPreguntar);
    throw alPreguntar;
  }

  if (data) return data;

  /* Ahora sí: la base ha contestado, y ha contestado que no tiene
     ficha. Primera vez que entra, se le crea sola. Si su correo
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
  return nueva;
}

export async function guardarMiFicha(datos) {
  const user = await usuarioActual();
  /* es_admin y paga_en_persona no se mandan nunca desde aquí: los
     devuelve a su sitio el trigger cliente_no_se_asciende, pero
     mejor ni intentarlo. */
  /* `foto` y `perfil_visible` SÍ se mandan: son del cliente y
     los decide él. Los que se quitan son los que pone
     administración, y el trigger los devolvería a su sitio de
     todos modos — pero mejor ni intentarlo. */
  const { es_admin, paga_en_persona, descuento_pct, descuento_nota,
          id, creado, ...resto } = datos;

  let { error } = await supabase.from("cliente").update(resto).eq("id", user.id);

  /* La base va por detrás del navegador: siempre. PGRST204 es
     «esa columna no existe». Pasó con `quiere_correos`, que
     llega con el SQL de los avisos: mientras no se aplique, el
     cliente no podía guardar NADA de su ficha, ni el teléfono.

     Se quitan las columnas que todavía no existen y se vuelve a
     intentar. Lo que se pierde es la casilla nueva; lo que se
     salva es la ficha entera. */
  if (error?.code === "PGRST204") {
    const todavia_no = ["quiere_correos", "foto", "perfil_visible"];
    const seguro = Object.fromEntries(
      Object.entries(resto).filter(([campo]) => !todavia_no.includes(campo)));
    ({ error } = await supabase.from("cliente").update(seguro).eq("id", user.id));
  }

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
  const user = await usuarioActual();
  if (!user) return [];
  const { data, error } = await supabase.from("perro")
    .select("*").eq("cliente_id", user.id).order("nombre");
  if (error) throw error;
  return data || [];
}

/**
 * TODOS los perros, para administración.
 *
 * `misPerros()` enseña los del que ha entrado y punto — también
 * a administración, porque «Mis perros» son los suyos y
 * mezclarlos ensucia hasta los avisos de vacunas del inicio.
 * Esta es la otra puerta: la de buscar el perro de un cliente.
 *
 * Quien no sea administración no ve nada aquí: lo impide RLS,
 * no esta función.
 */
export async function todosLosPerros(busca = "") {
  let q = supabase.from("perro")
    .select("*, cliente(nombre, apellidos, telefono)")
    .order("nombre");

  const b = busca.trim();
  if (b) {
    /* Por nombre del perro o por chip. Del dueño se filtra
       después: PostgREST no sabe buscar dentro de una tabla
       enlazada y pedírselo daría un error raro. */
    q = q.or(`nombre.ilike.%${b}%,chip.ilike.%${b}%`);
  }

  const { data, error } = await q;
  if (error) return [];
  return data || [];
}

/** Los mismos, buscando también por el nombre del dueño. */
export async function perrosBuscando(busca = "") {
  const b = busca.trim().toLowerCase();
  if (!b) return todosLosPerros();

  const [porPerro, todos] = await Promise.all([
    todosLosPerros(b),
    todosLosPerros(),
  ]);

  const porDueno = todos.filter(p =>
    `${p.cliente?.nombre ?? ""} ${p.cliente?.apellidos ?? ""} ${p.cliente?.telefono ?? ""}`
      .toLowerCase().includes(b));

  /* Sin repetir: un perro puede casar por su nombre Y por el de
     su dueño. */
  const vistos = new Set();
  return [...porPerro, ...porDueno].filter(p =>
    vistos.has(p.id) ? false : vistos.add(p.id));
}

export async function unPerro(id) {
  /* Con el dueño colgando. A un cliente RLS le devuelve sólo su
     propia ficha de cliente, así que esto no le enseña nada que
     no pudiera ver ya; a administración le trae el teléfono,
     que es lo que hace falta para escribirle desde aquí.

     Si la consulta con el dueño falla —una base que todavía no
     tiene algo, o un permiso— se pide el perro a secas: no
     poder ver el teléfono no puede impedir abrir la ficha. */
  const { data, error } = await supabase.from("perro")
    .select("*, cliente(nombre, apellidos, telefono)").eq("id", id).single();
  if (!error) return data;

  const solo = await supabase.from("perro").select("*").eq("id", id).single();
  return solo.error ? null : solo.data;
}

export async function guardarPerro(datos, { borrador = false } = {}) {
  const user = await usuarioActual();

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
  const user = await usuarioActual();
  const { error } = await supabase.from("solicitud_cambio").insert({
    perro_id: perroId, cliente_id: user.id, campo,
    valor_actual: valorActual, valor_nuevo: valorNuevo, motivo: motivo || "",
  });
  if (error) {
    /* El error DE VERDAD, al registro. Un mensaje amable sin
       rastro de la causa es lo que convierte un fallo de cinco
       minutos en un día entero (13/09/2026). */
    console.error("[AmigoMío] no se pudo pedir el cambio:", error);
    window.apuntarElFallo?.("al pedir un cambio de chip o nombre", error);
    return { ok: false, mensaje: "No hemos podido enviar la solicitud." };
  }
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
  const user = await usuarioActual();

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

/** El descuento del cliente fijo. Sólo lo deja la base a administración. */
export async function ponerDescuento(clienteId, pct, nota = "") {
  const numero = Number(pct);
  if (!Number.isFinite(numero) || numero < 0 || numero > 100)
    return { ok: false, mensaje: "El descuento va de 0 a 100." };

  const { error } = await supabase.from("cliente")
    .update({ descuento_pct: numero, descuento_nota: nota }).eq("id", clienteId);
  if (error) return { ok: false, mensaje: "No hemos podido cambiarlo." };
  return { ok: true, mensaje: numero > 0
    ? `Descuento del ${numero} % puesto.` : "Descuento quitado." };
}

/* ------------------------------------------------------------
   Promociones: un descuento con fecha de caducidad, para todos.
   ------------------------------------------------------------ */
export async function promociones() {
  const { data } = await supabase.from("promocion").select("*").order("desde", { ascending: false });
  return data || [];
}

export async function guardarPromocion(promo) {
  const fila = {
    nombre: promo.nombre, pct: Number(promo.pct),
    desde: promo.desde, hasta: promo.hasta, activa: promo.activa !== false,
  };
  if (!fila.nombre) return { ok: false, mensaje: "Ponle un nombre: lo va a ver el cliente." };
  if (!(fila.pct > 0 && fila.pct <= 100)) return { ok: false, mensaje: "El descuento va de 1 a 100." };
  if (!fila.desde || !fila.hasta) return { ok: false, mensaje: "Faltan las fechas." };
  if (fila.hasta < fila.desde) return { ok: false, mensaje: "La fecha de fin va después de la de inicio." };

  const { error } = promo.id
    ? await supabase.from("promocion").update(fila).eq("id", promo.id)
    : await supabase.from("promocion").insert(fila);
  if (error) return { ok: false, mensaje: "No hemos podido guardarla." };
  return { ok: true, mensaje: "Guardada." };
}

export async function borrarPromocion(id) {
  const { error } = await supabase.from("promocion").delete().eq("id", id);
  return { ok: !error, mensaje: error ? "No hemos podido quitarla." : "Quitada." };
}

/**
 * Corregir los datos de un cliente desde el panel.
 *
 * NO se manda `es_admin`: se es administrador por estar en la
 * lista de correos, no porque alguien le dé a un botón. Si se
 * pudiera desde la pantalla, el día que alguien se siente en una
 * sesión abierta se hace administrador en dos clics. Tampoco el
 * correo: es la identidad con la que entra.
 */
export async function guardarCliente(clienteId, datos) {
  const fila = {
    nombre: datos.nombre ?? "", apellidos: datos.apellidos ?? "",
    dni: datos.dni ?? "", domicilio: datos.domicilio ?? "",
    telefono: datos.telefono ?? "",
    recoge_nombre: datos.recoge_nombre ?? "", recoge_dni: datos.recoge_dni ?? "",
  };
  const { error } = await supabase.from("cliente").update(fila).eq("id", clienteId);
  if (error) return { ok: false, mensaje: "No hemos podido guardar los datos." };
  return { ok: true, mensaje: "Datos guardados." };
}

/** Escribirle a un cliente. Lo encola la base; lo manda el servidor. */
export async function escribirACliente(clienteId, asunto, cuerpo) {
  if (!asunto?.trim()) return { ok: false, mensaje: "Falta el asunto." };
  if (!cuerpo?.trim()) return { ok: false, mensaje: "Falta el texto del aviso." };

  const { data, error } = await supabase.rpc("escribir_a_cliente", {
    el_cliente: clienteId, el_asunto: asunto.trim(), el_cuerpo: cuerpo.trim(),
  });
  if (error) return { ok: false, mensaje: error.message };
  return { ok: true, mensaje: data?.mensaje || "Va de camino." };
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
                                    conCuras = 0, extras = [], cliente = null }) {
  /* Con el cliente, para que le salga SU precio. Si no se pasa,
     se usa el que está dentro de la aplicación: el presupuesto
     de la pantalla de reservar es el suyo. Administración sí lo
     pasa a mano, que reserva a nombre de otros. */
  const quien = cliente ?? (await usuarioActual())?.id ?? null;

  const comunes = {
    la_entrada: entrada, la_salida: salida, el_tipo: tipo,
    los_perros: perros, con_curas: conCuras, los_extras: extras,
  };

  let { data, error } = await supabase.rpc("presupuesto", { ...comunes, el_cliente: quien });

  /* EL NAVEGADOR SE DESPLIEGA ANTES QUE LA BASE. Siempre: uno
     va con `git push` y la otra cuando alguien pega el SQL en
     Supabase. El 12/09/2026 esto dejó a todo el mundo sin poder
     reservar con un «Could not find the function
     public.presupuesto(...)».

     PGRST202 es «no existe esa función con esa firma». Si sale,
     se pregunta otra vez sin el parámetro nuevo: el cliente se
     queda sin ver su descuento hasta que se aplique el SQL, que
     es infinitamente mejor que no poder reservar. */
  if (error?.code === "PGRST202") {
    ({ data, error } = await supabase.rpc("presupuesto", comunes));
  }

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
  const user = await usuarioActual();
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
  /* Filtrar por `cliente_id` NO es redundante con RLS: a
     administración RLS le deja ver las de TODOS, y sin esta
     línea a Santiago le salían en «Mis reservas» y en el inicio
     las estancias de todos los clientes. Mismo fallo que tuvo
     `misPerros()`.
     La regla, y hay prueba que la vigila: lo que se llama «mío»
     filtra por quien ha entrado. */
  const user = await usuarioActual();
  if (!user) return [];

  const { data, error } = await supabase.from("reserva")
    .select("*, alojamiento(nombre, tipo), reserva_perro(perro(nombre))")
    .eq("cliente_id", user.id)
    .order("entrada", { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * Dónde se transfiere.
 *
 * Va en su propia función de Postgres y no con los otros ajustes
 * porque `ajuste_publico` la puede llamar CUALQUIERA de internet:
 * la clave anónima está en el repositorio, y el repositorio es
 * público. El número de cuenta no es una contraseña, pero tampoco
 * es para publicarlo en abierto.
 *
 * Y si la base todavía no la tiene (PGRST202), se devuelve vacío:
 * la pantalla sale igual, sólo que sin el número. EL NAVEGADOR SE
 * DESPLIEGA ANTES QUE LA BASE. SIEMPRE.
 */
export async function datosParaPagar() {
  const { data, error } = await supabase.rpc("datos_para_pagar");
  if (error) {
    if (error.code !== "PGRST202")
      console.error("[AmigoMío] no se pudo traer dónde pagar:", error);
    return null;
  }
  return data?.iban ? data : null;
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

/* ------------------------------------------------------------
   Administración: el cuadro, la hoja del día y la estancia
   ------------------------------------------------------------ */
export async function cuadrante(desde, hasta) {
  const { data, error } = await supabase.rpc("cuadrante", { desde, hasta });
  if (error) throw error;
  return data;
}

export async function hojaDelDia(dia) {
  const { data, error } = await supabase.rpc("hoja_del_dia", { el_dia: dia });
  if (error) throw error;
  return data;
}

export async function unaEstancia(id) {
  const { data, error } = await supabase.from("reserva")
    .select(`*, alojamiento(nombre, tipo),
             cliente!reserva_cliente_id_fkey(nombre, apellidos, telefono, recoge_nombre, recoge_dni),
             reserva_perro(peso, en_celo, perro(*))`)
    .eq("id", id).single();
  if (error) return null;
  return data;
}

export async function incidenciasDe(reservaId) {
  const { data } = await supabase.from("incidencia")
    .select("*").eq("reserva_id", reservaId).order("cuando", { ascending: false });
  return data || [];
}

export async function anotarIncidencia({ reservaId, perroId, tipo = "nota", texto }) {
  const user = await usuarioActual();
  const { error } = await supabase.from("incidencia")
    .insert({ reserva_id: reservaId, perro_id: perroId || null, tipo, texto, la_puso: user.id });
  return { ok: !error, mensaje: error ? "No hemos podido anotarlo." : "Anotado." };
}

export async function moverDeAlojamiento(reservaId, alojamientoId) {
  const { error } = await supabase.from("reserva")
    .update({ alojamiento_id: alojamientoId }).eq("id", reservaId);
  /* La base de datos rechaza el solape: no hace falta comprobarlo
     antes, basta con contar lo que responde. */
  if (error) return { ok: false, mensaje: /exclusion|solap/i.test(error.message)
    ? "Ese alojamiento ya está ocupado esas noches." : "No hemos podido moverlo." };
  return { ok: true, mensaje: "Movido." };
}

export async function cambiarEstado(reservaId, estado) {
  const { error } = await supabase.from("reserva").update({ estado }).eq("id", reservaId);
  return { ok: !error, mensaje: error ? "No hemos podido cambiarlo." : "Hecho." };
}

/* ------------------------------------------------------------
   Los papeles del perro: la cartilla, el seguro, la licencia.

   El cubo `cartillas` es PRIVADO. Una cartilla lleva el chip del
   animal y los datos del propietario, así que no se sirve en
   abierto: para verla se pide un enlace firmado, que caduca.
   ------------------------------------------------------------ */
const CUBO = "cartillas";

/** Los papeles que tiene este perro, el último arriba. */
export async function documentosDe(perroId) {
  const { data, error } = await supabase.from("documento_perro")
    .select("*").eq("perro_id", perroId).order("subido", { ascending: false });
  if (error) return [];
  return data || [];
}

/**
 * Sube un papel. La foto se encoge antes: una de móvil son
 * cuatro megas y esto se usa muchas veces desde la calle.
 */
export async function subirDocumento(perroId, tipo, fichero, nota = "") {
  const pega = queLePasa(fichero);
  if (pega) return { ok: false, mensaje: pega };

  const user = await usuarioActual();
  if (!user) return { ok: false, mensaje: "Vuelve a entrar, que se ha caído la sesión." };

  const encogido = await encoger(fichero);
  const ruta = rutaDocumento(user.id, perroId, tipo, encogido.name || fichero.name);

  const { error: fallo } = await supabase.storage.from(CUBO)
    .upload(ruta, encogido, { contentType: encogido.type, upsert: false });
  if (fallo) return { ok: false, mensaje: "No hemos podido subirlo. Inténtalo otra vez." };

  const { error } = await supabase.from("documento_perro")
    .insert({ perro_id: perroId, tipo, ruta, nota });
  if (error) {
    /* El fichero se subió pero el apunte no: se quita, que si no
       queda un huérfano que nadie va a ver nunca. */
    await supabase.storage.from(CUBO).remove([ruta]);
    return { ok: false, mensaje: "No hemos podido guardarlo. Inténtalo otra vez." };
  }
  return { ok: true, mensaje: "Subido. Gracias." };
}

/** Un enlace para verlo, que caduca a la hora. */
export async function verDocumento(ruta, segundos = 3600) {
  const { data, error } = await supabase.storage.from(CUBO)
    .createSignedUrl(ruta, segundos);
  return error ? null : data.signedUrl;
}

export async function borrarDocumento(id, ruta) {
  const { error } = await supabase.from("documento_perro").delete().eq("id", id);
  if (error) return { ok: false, mensaje: "No hemos podido quitarlo." };
  await supabase.storage.from(CUBO).remove([ruta]);
  return { ok: true, mensaje: "Quitado." };
}

/* ------------------------------------------------------------
   El justificante de la transferencia.

   El cliente lo sube; eso PARA EL RELOJ pero no confirma nada.
   Confirma administración, después de ver el dinero en la
   cuenta: una foto puede ser de cualquier cosa.
   ------------------------------------------------------------ */
const CUBO_JUSTIFICANTES = "justificantes";

export async function subirJustificante(reservaId, fichero) {
  const pega = queLePasa(fichero);
  if (pega) return { ok: false, mensaje: pega };

  const user = await usuarioActual();
  if (!user) return { ok: false, mensaje: "Vuelve a entrar, que se ha caído la sesión." };

  const encogido = await encoger(fichero);
  const ruta = rutaDocumento(user.id, reservaId, "justificante",
                             encogido.name || fichero.name);

  const { error: fallo } = await supabase.storage.from(CUBO_JUSTIFICANTES)
    .upload(ruta, encogido, { contentType: encogido.type, upsert: false });
  if (fallo) return { ok: false, mensaje: "No hemos podido subirlo. Inténtalo otra vez." };

  /* El apunte lo hace la base, no esta línea: ahí es donde se
     comprueba que la reserva es tuya y que todavía espera el
     papel. */
  const { data, error } = await supabase.rpc("subir_justificante", {
    la_reserva: reservaId, la_ruta: ruta,
  });
  if (error) {
    await supabase.storage.from(CUBO_JUSTIFICANTES).remove([ruta]);
    return { ok: false, mensaje: error.message };
  }
  return { ok: true, mensaje: data?.mensaje || "Recibido. Lo miramos y te confirmamos." };
}

/** Un enlace para mirarlo, que caduca a la hora. */
export async function verJustificante(ruta, segundos = 3600) {
  const { data, error } = await supabase.storage.from(CUBO_JUSTIFICANTES)
    .createSignedUrl(ruta, segundos);
  return error ? null : data.signedUrl;
}

export async function validarJustificante(reservaId) {
  const { error } = await supabase.rpc("validar_justificante", { la_reserva: reservaId });
  return error ? { ok: false, mensaje: error.message }
               : { ok: true, mensaje: "Reserva confirmada." };
}

export async function rechazarJustificante(reservaId, motivo) {
  const { data, error } = await supabase.rpc("rechazar_justificante", {
    la_reserva: reservaId, el_motivo: motivo || "",
  });
  return error ? { ok: false, mensaje: error.message }
               : { ok: true, mensaje: data?.mensaje || "Rechazado." };
}

/** El reloj, a mano. Lo mismo que hace el cron cada diez minutos. */
export async function caducarReservas() {
  const { data, error } = await supabase.rpc("caducar_reservas");
  if (error) return { ok: false, mensaje: "No hemos podido pasar el reloj." };
  return { ok: true, cuantas: data,
           mensaje: data === 0 ? "No había ninguna por soltar."
             : `${data} reserva${data === 1 ? "" : "s"} sin pagar, soltada${data === 1 ? "" : "s"}.` };
}

/* ------------------------------------------------------------
   El libro de registro y las cuentas.

   Los dos llevan DNI y domicilio, así que la base sólo se los
   da a administración: aquí no hay ninguna comprobación porque
   no serviría de nada.
   ------------------------------------------------------------ */
export async function libroDeEstancias(desde, hasta) {
  const { data, error } = await supabase.rpc("libro_entradas_salidas", { desde, hasta });
  if (error) return { ok: false, mensaje: error.message, filas: [] };
  return { ok: true, filas: data || [] };
}

export async function ingresosPorMes(anio = null) {
  const { data, error } = await supabase.rpc("ingresos_por_mes", { el_anio: anio });
  if (error) return { ok: false, mensaje: error.message, meses: [] };
  return { ok: true, meses: data || [] };
}

/* ------------------------------------------------------------
   Bloquear fechas.

   Sirve para obras, desinfección o vacaciones, y para algo más
   inmediato: dejarle a Wix los boxes que siga vendiendo él,
   para que los dos sistemas no vendan la misma noche.
   ------------------------------------------------------------ */
export async function alojamientos() {
  const { data } = await supabase.from("alojamiento")
    .select("id, nombre, tipo, capacidad, activo")
    .eq("activo", true).order("id");
  return data || [];
}

export async function bloqueos() {
  const { data } = await supabase.from("bloqueo")
    .select("*, alojamiento(nombre)").order("desde", { ascending: false });
  return data || [];
}

/** `alojamientos` vacío = todos. */
export async function bloquearFechas(alojamientos, desde, hasta, motivo = "") {
  if (!desde || !hasta) return { ok: false, mensaje: "Faltan las fechas." };
  if (hasta < desde) return { ok: false, mensaje: "La fecha de fin va después de la de inicio." };

  const { data, error } = await supabase.rpc("bloquear_fechas", {
    los_alojamientos: alojamientos?.length ? alojamientos : null,
    el_desde: desde, el_hasta: hasta, el_motivo: motivo,
  });
  /* El mensaje de la base viene con el nombre del alojamiento y
     la fecha del choque: se le enseña tal cual, que es mucho más
     útil que un «no se puede». */
  if (error) return { ok: false, mensaje: error.message };
  return { ok: true, mensaje: data?.puestos === 1
    ? "Bloqueado." : `${data?.puestos} alojamientos bloqueados.` };
}

export async function quitarBloqueo(id) {
  const { error } = await supabase.from("bloqueo").delete().eq("id", id);
  return { ok: !error, mensaje: error ? "No hemos podido quitarlo." : "Quitado." };
}

/* ------------------------------------------------------------
   Las fotos: la del cliente y la de cada perro.

   Van al cubo `fotos-perros`, que es privado igual que los
   demás: una foto es un dato personal, y la de un perro con su
   nombre al lado también.

   Se guardan más pequeñas que las cartillas: en una cartilla hay
   que leer fechas escritas a mano; en una cara o un perro, no. Y
   éstas se cargan en listas, varias a la vez.
   ------------------------------------------------------------ */
const CUBO_FOTOS = "fotos-perros";

/**
 * Sube una foto y devuelve su ruta.
 *
 * `de` es "perfil" o el identificador del perro: sirve para
 * saber de quién es sin abrirla.
 */
export async function subirFoto(fichero, de = "perfil") {
  const pega = queLePasa(fichero);
  if (pega) return { ok: false, mensaje: pega };
  if (!fichero.type?.startsWith("image/"))
    return { ok: false, mensaje: "Eso tiene que ser una foto." };

  const user = await usuarioActual();
  if (!user) return { ok: false, mensaje: "Vuelve a entrar, que se ha caído la sesión." };

  const encogida = await encoger(fichero, LADO_FOTO);
  const ruta = rutaDocumento(user.id, de, "foto", encogida.name || fichero.name);

  const { error } = await supabase.storage.from(CUBO_FOTOS)
    .upload(ruta, encogida, { contentType: encogida.type, upsert: false });
  if (error) return { ok: false, mensaje: "No hemos podido subirla. Inténtalo otra vez." };

  return { ok: true, ruta, mensaje: "Foto guardada." };
}

/** Un enlace para verla. El cubo es privado, así que va firmado. */
export async function verFoto(ruta, segundos = 3600) {
  if (!ruta) return null;
  const { data, error } = await supabase.storage.from(CUBO_FOTOS)
    .createSignedUrl(ruta, segundos);
  return error ? null : data.signedUrl;
}

/** Varias de una vez: una lista de perros pide muchas a la vez. */
export async function verFotos(rutas) {
  const limpias = rutas.filter(Boolean);
  if (!limpias.length) return {};
  const { data } = await supabase.storage.from(CUBO_FOTOS)
    .createSignedUrls(limpias, 3600);
  const mapa = {};
  for (const f of data || []) if (f.signedUrl) mapa[f.path] = f.signedUrl;
  return mapa;
}

/* ------------------------------------------------------------
   Los perfiles que otros clientes pueden ver.

   Se pregunta por las VISTAS, no por las tablas: las vistas
   sólo tienen las columnas que se pueden enseñar. Preguntar por
   `cliente` devolvería el DNI y el domicilio.
   ------------------------------------------------------------ */
export async function perfilesVisibles() {
  const { data, error } = await supabase
    .from("perfiles_publicos").select("*").order("nombre");
  if (error) return [];
  return data || [];
}

export async function perrosVisibles() {
  const { data, error } = await supabase
    .from("perros_publicos").select("*").order("nombre");
  if (error) return [];
  return data || [];
}

/* ------------------------------------------------------------
   Educación y deporte.

   No es una reserva: no hay plazas ni precio ni reloj. Es una
   conversación que empieza.
   ------------------------------------------------------------ */
export async function mostrarInteres(tipo, perroId = null, mensaje = "") {
  const { data, error } = await supabase.rpc("mostrar_interes", {
    el_tipo: tipo, el_perro: perroId || null, el_mensaje: mensaje,
  });
  if (error) return { ok: false, mensaje: error.message };
  return { ok: true, ...data };
}

export async function misIntereses() {
  const user = await usuarioActual();
  if (!user) return [];
  /* Filtrando por cliente: a administración RLS le devolvería
     los de todos, y ésta es la pantalla del cliente. */
  const { data } = await supabase.from("interes")
    .select("*").eq("cliente_id", user.id).order("creada", { ascending: false });
  return data || [];
}

export async function retirarInteres(id) {
  const { error } = await supabase.from("interes").delete().eq("id", id);
  return { ok: !error, mensaje: error ? "No hemos podido quitarlo." : "Quitado." };
}

/** Todos, para administración. */
export async function intereses() {
  const { data } = await supabase.from("interes")
    .select("*, cliente(nombre, apellidos, telefono), perro(nombre, raza)")
    .order("creada", { ascending: false });
  return data || [];
}

/* ------------------------------------------------------------
   Lo que está esperando a administración.

   Santiago, 13/09/2026: «en el perfil de administración no me
   salen las cosas para validar». Y no salían: para verlas había
   que ir al cuadrante y pinchar las reservas una por una, a ver
   si alguna tenía algo. Eso no es administrar, es buscar.

   Las cuatro consultas van a la vez y con `allSettled`: si una
   falla, las otras tres salen igual. Enseñar tres cuartas partes
   de lo que hay que hacer es infinitamente mejor que enseñar una
   pantalla de error — y lo que falle se dice, no se esconde.
   ------------------------------------------------------------ */
export async function cosasPorValidar() {
  const conDueno = "*, cliente(nombre, apellidos, telefono), " +
                   "reserva_perro(perro(nombre)), alojamiento(nombre)";

  const [justificantes, esperando, cambios, interesados, canceladas] = await Promise.allSettled([
    /* 1. Justificante subido, esperando tu visto bueno. LO QUE MÁS
          CORRE: hay alguien que ya ha pagado. */
    supabase.from("reserva").select(conDueno)
      .eq("estado", "revisando").order("entrada"),

    /* 2. Reservada pero sin justificante. Caducan solas a las 24 h,
          así que enterarse tarde es perder la reserva. */
    supabase.from("reserva").select(conDueno)
      .eq("estado", "pendiente").order("entrada"),

    /* 3. Cambios de chip o de nombre. */
    supabase.from("solicitud_cambio")
      .select("*, perro(nombre, chip), cliente!solicitud_cambio_cliente_id_fkey(nombre, apellidos, telefono)")
      .eq("estado", "pendiente").order("creada"),

    /* 4. Quién ha dicho que le interesa educación o deporte. */
    supabase.from("interes")
      .select("*, cliente(nombre, apellidos, telefono), perro(nombre, raza)")
      .eq("estado", "nueva").order("creada", { ascending: false }),

    /* 5. Canceladas y todavía sin mirar. No hay nada que validar,
          pero sí que ENTERARSE: ese alojamiento ha quedado libre
          esas noches y se puede volver a vender. */
    supabase.from("reserva").select(conDueno)
      .eq("estado", "cancelada").eq("cancelacion_vista", false)
      .order("entrada"),
  ]);

  const saca = r => (r.status === "fulfilled" && !r.value.error)
    ? (r.value.data || []) : null;   // null = no se ha podido preguntar

  return {
    justificantes: saca(justificantes),
    esperando:     saca(esperando),
    cambios:       saca(cambios),
    interesados:   saca(interesados),
    /* Si la base todavía no tiene la columna, esta consulta falla y
       `saca` devuelve null: se enseña lo demás y se dice que faltó
       algo. EL NAVEGADOR SE DESPLIEGA ANTES QUE LA BASE. */
    canceladas:    saca(canceladas),
  };
}

/** Dar una cancelación por vista: deja de salir en la lista. */
export async function darCancelacionPorVista(reservaId) {
  const { error } = await supabase.from("reserva")
    .update({ cancelacion_vista: true }).eq("id", reservaId);
  return { ok: !error, mensaje: error ? "No hemos podido marcarla." : "" };
}

/**
 * Cuántas cosas esperan, por sección del menú. Para el punto rojo.
 *
 * Devuelve sólo NÚMEROS, no las filas: esto se llama cada vez que
 * se repinta el menú y traerse las fichas enteras para contarlas
 * sería pagar por algo que no se enseña.
 *
 * Si algo falla se devuelve cero y a otra cosa: quedarse sin punto
 * es una molestia; quedarse sin menú, no.
 */
export async function pendientes() {
  const cuenta = async consulta => {
    try {
      const { count, error } = await consulta;
      return error ? 0 : (count || 0);
    } catch { return 0; }
  };

  const [a, b, c, d, e] = await Promise.all([
    cuenta(supabase.from("reserva").select("id", { count: "exact", head: true })
      .eq("estado", "revisando")),
    cuenta(supabase.from("reserva").select("id", { count: "exact", head: true })
      .eq("estado", "pendiente")),
    cuenta(supabase.from("solicitud_cambio").select("id", { count: "exact", head: true })
      .eq("estado", "pendiente")),
    cuenta(supabase.from("interes").select("id", { count: "exact", head: true })
      .eq("estado", "nueva")),
    cuenta(supabase.from("reserva").select("id", { count: "exact", head: true })
      .eq("estado", "cancelada").eq("cancelacion_vista", false)),
  ]);

  /* Por sección del menú, que es donde se pinta el punto. */
  return { validar: a + b + c + d + e };
}

export async function atenderInteres(id, estado, nota = "") {
  const fila = { estado, nota };
  if (estado !== "nueva") fila.atendida = new Date().toISOString();
  const { error } = await supabase.from("interes").update(fila).eq("id", id);
  return { ok: !error, mensaje: error ? "No hemos podido guardarlo." : "Guardado." };
}
