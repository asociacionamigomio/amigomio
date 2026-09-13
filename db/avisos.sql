-- ============================================================
-- AVISOS POR CORREO
--
-- Hasta ahora avisábamos de que a Luna le caduca la rabia… si
-- el cliente entraba en la aplicación. Un aviso que hay que ir
-- a buscar no es un aviso, y el que más lo necesita —el que no
-- entra nunca— era justo el que no se enteraba.
--
-- Tres decisiones que no son evidentes:
--
-- 1. LOS CORREOS NO SE MANDAN DESDE EL NAVEGADOR. Se encolan
--    aquí y los manda el servidor. Desde la pantalla se
--    perderían al cerrar la pestaña, se mandarían dos veces al
--    recargar, y haría falta la clave del proveedor en el
--    navegador, que es como publicarla.
--
-- 2. CADA AVISO LLEVA UNA MARCA de qué es y de qué va, y la
--    marca es única. Con ella no se manda dos veces lo mismo, y
--    ése es exactamente el fallo que convierte un servicio útil
--    en correo basura.
--
-- 3. LO QUE FALLA SE REINTENTA UN NÚMERO DE VECES Y LUEGO SE
--    RINDE. Reintentar sin fin contra una dirección que no
--    existe es una factura creciendo sola.
--
-- Aplicar DESPUÉS de reloj.sql.
-- ============================================================

-- Quien no quiere que le escribamos, no recibe nada. Si no se
-- puede parar, es spam.
alter table cliente add column if not exists quiere_correos boolean not null default true;

comment on column cliente.quiere_correos is
  'Si es falso no se le encola ningún aviso. Lo cambia el propio cliente desde su ficha';

create table if not exists aviso (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid references cliente(id) on delete cascade,

  -- A dónde. Se copia aquí y no se mira el cliente al enviar:
  -- si cambia de correo, el aviso ya mandado tiene que seguir
  -- diciendo a dónde fue.
  correo      text not null,

  asunto      text not null,
  cuerpo      text not null,          -- texto plano; el HTML lo monta quien envía

  -- De qué va, para saber qué se manda y poder contarlo.
  motivo      text not null check (motivo in (
                'sanidad',        -- algo de la cartilla caduca
                'pago',           -- la reserva va a caducar sin justificante
                'confirmacion',   -- pago comprobado: ya está todo listo
                'recordatorio',   -- la estancia empieza mañana
                'justificante',   -- lo hemos recibido / no nos vale
                'mano')),         -- lo escribió administración

  -- La marca de agua. Única: un cron que se dispare dos veces
  -- NO manda dos correos.
  marca       text not null unique,

  estado      text not null default 'pendiente'
              check (estado in ('pendiente','enviando','enviado','rendido')),
  intentos    integer not null default 0,
  fallo       text not null default '',

  creado      timestamptz not null default now(),
  enviado     timestamptz
);

create index if not exists aviso_por_enviar on aviso (creado) where estado = 'pendiente';

alter table aviso enable row level security;

-- La cola lleva la dirección y el texto de todos los clientes:
-- no la lee nadie más.
drop policy if exists aviso_solo_admin on aviso;
create policy aviso_solo_admin on aviso
  for all using (es_admin()) with check (es_admin());

-- ------------------------------------------------------------
-- Meter uno en la cola.
--
-- Si la marca ya está, no hace nada y lo dice: es la forma de
-- que preparar_avisos() se pueda ejecutar cada hora sin miedo.
-- ------------------------------------------------------------
create or replace function encolar_aviso(
  el_cliente uuid,
  el_motivo  text,
  la_marca   text,
  el_asunto  text,
  el_cuerpo  text
) returns boolean language plpgsql security definer
set search_path = public as $$
declare
  su_correo text;
  quiere    boolean;
begin
  select u.email, c.quiere_correos into su_correo, quiere
    from cliente c join auth.users u on u.id = c.id
   where c.id = el_cliente;

  if su_correo is null then return false; end if;
  if not coalesce(quiere, true) then return false; end if;

  insert into aviso (cliente_id, correo, asunto, cuerpo, motivo, marca)
       values (el_cliente, su_correo, el_asunto, el_cuerpo, el_motivo, la_marca)
  on conflict (marca) do nothing;

  return found;
end $$;

-- ------------------------------------------------------------
-- Qué hay que avisar hoy.
--
-- Se puede llamar todas las veces que haga falta: lo que ya
-- está encolado no se vuelve a encolar, porque la marca lleva
-- la fecha o el identificador de lo que avisa.
-- ------------------------------------------------------------
create or replace function preparar_avisos()
returns integer language plpgsql security definer
set search_path = public as $$
declare
  puestos integer := 0;
  f       record;
begin
  if not es_admin_o_servidor() then
    raise exception 'Esto lo dispara el servidor.';
  end if;

  -- ---------- 1. La reserva que va a caducar sin pagar ----------
  -- Es el aviso que más dinero salva: el cliente que se
  -- despistó y va a perder el sitio en unas horas.
  for f in
    select r.id, r.cliente_id, r.entrada, r.expira, r.total
      from reserva r
     where r.estado = 'pendiente'
       and r.expira is not null
       and r.expira between now() and now() + interval '6 hours'
  loop
    if encolar_aviso(
         f.cliente_id, 'pago', 'pago:' || f.id,
         'Tu reserva en AmigoMío se suelta en unas horas',
         'Hola:' || chr(10) || chr(10) ||
         'Todavía no nos ha llegado el justificante de la transferencia de tu reserva '
         || 'del ' || to_char(f.entrada, 'DD/MM/YYYY') || ', y el sitio se suelta '
         || 'el ' || to_char(f.expira, 'DD/MM/YYYY') || ' a las '
         || to_char(f.expira, 'HH24:MI') || '.' || chr(10) || chr(10) ||
         'Si ya lo has pagado, súbenos el resguardo desde «Mis reservas» y listo. '
         || 'Y si necesitas el número de cuenta o te ha pasado algo, escríbenos por '
         || 'WhatsApp al 673 229 399 y lo vemos.' || chr(10) || chr(10) ||
         'Un saludo,' || chr(10) || 'AmigoMío')
    then puestos := puestos + 1; end if;
  end loop;

  -- ---------- 2. La estancia que empieza mañana ----------
  for f in
    select r.id, r.cliente_id, r.entrada,
           (select string_agg(p.nombre, ' y ') from reserva_perro rp
              join perro p on p.id = rp.perro_id where rp.reserva_id = r.id) as perros
      from reserva r
     where r.estado = 'confirmada'
       and r.entrada::date = (now() + interval '1 day')::date
  loop
    if encolar_aviso(
         f.cliente_id, 'recordatorio', 'recordatorio:' || f.id,
         'Mañana te esperamos en AmigoMío',
         'Hola:' || chr(10) || chr(10) ||
         'Mañana ' || to_char(f.entrada, 'DD/MM') || ' a las '
         || to_char(f.entrada, 'HH24:MI') || ' esperamos a '
         || coalesce(f.perros, 'tu perro') || '.' || chr(10) || chr(10) ||
         'Acuérdate del pasaporte sanitario, que sin él no podemos hacer la entrada. '
         || 'Lo demás te lo contamos en el correo de la confirmación.' || chr(10) || chr(10) ||
         'Si te surge cualquier cosa, escríbenos por WhatsApp al 673 229 399.'
         || chr(10) || chr(10) ||
         'Hasta mañana,' || chr(10) || 'AmigoMío')
    then puestos := puestos + 1; end if;
  end loop;

  -- ---------- 3. Lo de la cartilla que caduca ----------
  -- La cuenta fina de cuándo avisa cada cosa vive en
  -- js/sanidad.js, que es donde se puede leer y probar. Aquí se
  -- usa una red más gruesa —treinta días— y el correo dice que
  -- lo mire en la aplicación, que es donde está el detalle. Así
  -- no hay dos reglas distintas diciendo cosas distintas.
  for f in
    select p.cliente_id,
           string_agg(distinct p.nombre, ', ') as perros,
           min(v.caduca) as primera
      from perro p
      cross join lateral (
        /* `nullif(..., '')` y no `is not null`: el formulario
           guarda `"fecha": ""` cuando el campo se deja en
           blanco, y una cadena vacía NO es nula. Con `is not
           null` pasaba el filtro y reventaba en el cast:

             22007: invalid input syntax for type date: ""

           Convertida a nulo, la fecha sale nula, el `between`
           de abajo la descarta y no hay que ordenar nada. */
        select nullif(p.sanidad -> k ->> 'fecha', '')::date
               + case when k = 'desparasitacion_interna' then 30 else 365 end as caduca
          from jsonb_object_keys(p.sanidad) k
      ) v
     where not p.borrador
       and v.caduca between current_date and current_date + 30
     group by p.cliente_id
  loop
    if encolar_aviso(
         f.cliente_id, 'sanidad',
         -- Una vez al mes como mucho: la marca lleva el mes.
         'sanidad:' || f.cliente_id || ':' || to_char(current_date, 'YYYY-MM'),
         'A ' || f.perros || ' le caduca algo de la cartilla',
         'Hola:' || chr(10) || chr(10) ||
         'Le echamos un ojo a las fechas de ' || f.perros || ' y hay algo que caduca '
         || 'pronto. Lo tienes detallado en la aplicación, en «Mis perros».'
         || chr(10) || chr(10) ||
         'No es nada urgente ni te impide reservar: es para que no te pille el día '
         || 'de la entrada.' || chr(10) || chr(10) ||
         'Si tienes dudas, escríbenos por WhatsApp al 673 229 399.' || chr(10) || chr(10) ||
         'Un saludo,' || chr(10) || 'AmigoMío')
    then puestos := puestos + 1; end if;
  end loop;

  return puestos;
end $$;

-- ------------------------------------------------------------
-- «YA ESTÁ TODO LISTO»
--
-- Se manda cuando administración da por bueno el pago. Es el
-- correo que se lee DOS VECES: al recibirlo y la víspera,
-- buscando qué había que traer. Por eso lleva todo, y en este
-- orden:
--
--   1. Qué está confirmado — lo que se viene a comprobar.
--   2. Los horarios — la pregunta número uno por teléfono.
--   3. Qué puede traer — la lista de Santiago.
--   4. Lo imprescindible, aparte y marcado: sin pasaporte el
--      perro no entra, y enterarse en la puerta con el coche
--      cargado es tarde.
--
-- Las fechas, las horas y el importe salen de la reserva. Un
-- correo que dice una hora distinta de la reservada es peor que
-- no mandar correo.
-- ------------------------------------------------------------
create or replace function avisar_reserva_confirmada(la_reserva uuid)
returns boolean language plpgsql security definer
set search_path = public as $$
declare
  r       reserva;
  perros  text;
  aloj    text;
begin
  select * into r from reserva where id = la_reserva;
  if not found then return false; end if;

  select string_agg(p.nombre, ' y ' order by p.nombre) into perros
    from reserva_perro rp join perro p on p.id = rp.perro_id
   where rp.reserva_id = r.id;

  select a.nombre into aloj from alojamiento a where a.id = r.alojamiento_id;

  return encolar_aviso(
    r.cliente_id, 'confirmacion',
    -- Una vez por reserva: administración puede darle al botón
    -- dos veces, o confirmar algo ya confirmado.
    'confirmacion:' || r.id,

    'Todo listo para ' || coalesce(perros, 'tu perro') || ' en AmigoMío',

    'Hola:' || chr(10) || chr(10) ||
    'Hemos recibido el pago. La reserva está confirmada.' || chr(10) || chr(10) ||

    '-- TU RESERVA --' || chr(10) ||
    coalesce(perros, 'Tu perro') || chr(10) ||
    'Entrada: ' || to_char(r.entrada, 'DD/MM/YYYY') || ' a las '
                 || to_char(r.entrada, 'HH24:MI') || chr(10) ||
    'Salida:  ' || to_char(r.salida,  'DD/MM/YYYY') || ' a las '
                 || to_char(r.salida,  'HH24:MI') || chr(10) ||
    coalesce('Alojamiento: ' || aloj || chr(10), '') ||
    'Total: ' || trim(to_char(r.total, 'FM999999D99')) || ' euros (pagado)'
    || chr(10) || chr(10) ||

    '-- HORARIOS DE ENTREGA Y RECOGIDA --' || chr(10) ||
    'De lunes a viernes y domingos: de 10:00 a 12:30 y de 16:30 a 19:00.' || chr(10) ||
    'Sábados: de 10:00 a 12:30.' || chr(10) ||
    'Fuera de esas horas se puede, avisando antes, y lleva recargo. '
    || 'Escríbenos por WhatsApp al 673 229 399 y lo vemos.' || chr(10) || chr(10) ||

    '-- LO QUE PUEDES TRAER --' || chr(10) ||
    '- Alguna mantita o camita a la que tu perro esté habituado.' || chr(10) ||
    '- Alguno de sus juguetes.' || chr(10) ||
    '- Su comida, y cuéntanos sus pautas de alimentación.' || chr(10) ||
    '- Si toma alguna medicación, tráela con la posología. El servicio de '
    || 'medicación oral no tiene coste adicional.' || chr(10) || chr(10) ||

    '-- IMPRESCINDIBLE PARA ENTRAR --' || chr(10) ||
    'Trae el pasaporte sanitario: comprobamos la titularidad y hacemos una '
    || 'lectura de chip. Sin eso no podemos hacer la entrada.' || chr(10) || chr(10) ||

    'Ya está todo preparado. Tu perro también necesita vacaciones: '
    || 'ser tu mejor amigo es agotador.' || chr(10) || chr(10) ||
    'Un saludo,' || chr(10) || 'AmigoMío');
end $$;

revoke all on function avisar_reserva_confirmada(uuid) from public;
grant execute on function avisar_reserva_confirmada(uuid) to authenticated;

-- ------------------------------------------------------------
-- Escribirle a un cliente a mano, desde el panel.
-- ------------------------------------------------------------
create or replace function escribir_a_cliente(
  el_cliente uuid,
  el_asunto  text,
  el_cuerpo  text
) returns jsonb language plpgsql security definer
set search_path = public as $$
declare
  puesto boolean;
begin
  if not es_admin() then
    raise exception 'Los avisos los manda administración.';
  end if;

  if coalesce(trim(el_asunto), '') = '' or coalesce(trim(el_cuerpo), '') = '' then
    raise exception 'Falta el asunto o el texto.';
  end if;

  -- La marca lleva el reloj hasta el segundo: escribirle dos
  -- veces lo mismo a propósito tiene que poder hacerse.
  puesto := encolar_aviso(
    el_cliente, 'mano',
    'mano:' || el_cliente || ':' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS'),
    el_asunto, el_cuerpo);

  if not puesto then
    raise exception 'Ese cliente no tiene correo, o ha pedido que no le escribamos.';
  end if;

  return jsonb_build_object('ok', true, 'mensaje', 'Va de camino.');
end $$;

revoke all on function preparar_avisos() from public;
revoke all on function escribir_a_cliente(uuid, text, text) from public;
grant execute on function preparar_avisos()                     to authenticated;
grant execute on function escribir_a_cliente(uuid, text, text)  to authenticated;

-- ------------------------------------------------------------
-- Que lo prepare el servidor, una vez cada hora.
-- ------------------------------------------------------------
do $$
begin
  create extension if not exists pg_cron;

  perform cron.unschedule('preparar-avisos')
    where exists (select 1 from cron.job where jobname = 'preparar-avisos');

  perform cron.schedule('preparar-avisos', '7 * * * *', 'select preparar_avisos()');

  raise notice 'Avisos: se preparan cada hora.';
exception when others then
  raise warning 'pg_cron no está disponible (%). Los avisos se preparan desde el panel.',
    sqlerrm;
end $$;

-- ============================================================
-- PRUEBAS. Aplicar este fichero ES ejecutarlas.
-- ============================================================
do $$
declare
  el_cliente uuid;
  puestos    integer;
  cuantos    integer;
begin
  select id into el_cliente from cliente limit 1;
  if el_cliente is null then
    raise notice 'Sin clientes todavía: los avisos se probarán cuando los haya.';
    return;
  end if;

  -- Encolar dos veces la MISMA marca deja un solo correo.
  perform encolar_aviso(el_cliente, 'mano', 'PRUEBA:marca-repetida',
                        'Prueba', 'Cuerpo de prueba');
  perform encolar_aviso(el_cliente, 'mano', 'PRUEBA:marca-repetida',
                        'Prueba otra vez', 'Otro cuerpo');

  select count(*) into cuantos from aviso where marca = 'PRUEBA:marca-repetida';
  assert cuantos <= 1,
    'la marca tiene que impedir el correo repetido, había ' || cuantos;

  -- A quien no quiere correos no se le encola nada.
  update cliente set quiere_correos = false where id = el_cliente;
  assert encolar_aviso(el_cliente, 'mano', 'PRUEBA:no-quiere', 'No', 'No') = false,
    'a quien ha dicho que no, no se le escribe';
  update cliente set quiere_correos = true where id = el_cliente;

  -- preparar_avisos() se puede llamar dos veces seguidas sin
  -- duplicar nada: es la garantía de que el cron no hace daño.
  puestos := preparar_avisos();
  assert preparar_avisos() = 0,
    'la segunda pasada seguida no puede encolar nada nuevo';

  delete from aviso where marca like 'PRUEBA:%';

  raise notice 'Avisos: todas las comprobaciones pasan.';
end $$;

-- ============================================================
-- QUE SALGAN SOLOS
--
-- `preparar_avisos()` los mete en la cola; la Edge Function
-- `avisos` los entrega. Falta quien la llame, y eso lo hace
-- Postgres con pg_net, cada cinco minutos.
--
-- EL SECRETO. La función pide una contraseña en la cabecera
-- `x-cron-secret` — sin ella, cualquiera con la URL podría
-- vaciar la cola de correos de AmigoMío. Esa contraseña vive en
-- `ajuste`, que tiene RLS y NO la lee nadie que no sea
-- administración; es donde ya vive el IBAN.
--
-- Mientras el ajuste esté vacío, esto NO programa nada y lo
-- dice. Programar un cron que va a fallar cada cinco minutos
-- sólo llena el registro de ruido.
-- ============================================================
insert into ajuste (clave, valor, nota) values
  ('cron_secret', '',
   'Contraseña que dispara el envío de correos. La misma que el secreto CRON_SECRET de Edge Functions. VACÍO = los correos no salen solos'),
  ('url_avisos', 'https://sovzbrrpcbmnevrdwaej.supabase.co/functions/v1/avisos',
   'Dónde vive la función que entrega los correos'),
  ('anon_key', 'sb_publishable_1eNdsYkpqefEIwJU7aakrw_UwzFu9kP',
   'La llave PÚBLICA de Supabase, la misma que lleva el navegador. No es un secreto: sin ella la puerta de Supabase rechaza la llamada antes de llegar a la función')
on conflict (clave) do nothing;

do $$
declare
  secreto text;
  url     text;
begin
  select valor into secreto from ajuste where clave = 'cron_secret';
  select valor into url     from ajuste where clave = 'url_avisos';

  if coalesce(secreto, '') = '' then
    raise notice 'Los correos NO saldrán solos todavía: falta poner `cron_secret` en los ajustes.';
    return;
  end if;

  create extension if not exists pg_net;
  create extension if not exists pg_cron;

  perform cron.unschedule('mandar-avisos')
    where exists (select 1 from cron.job where jobname = 'mandar-avisos');

  /* DOS llaves, y hacen falta las dos.
   *
   * `Authorization` con la llave PÚBLICA es lo que exige la
   * puerta de Supabase, que tiene «Verify JWT» encendido. Sin
   * ella la llamada se rechaza ANTES de llegar a la función:
   *
   *   401 UNAUTHORIZED_NO_AUTH_HEADER — Missing authorization header
   *
   * `x-cron-secret` con la contraseña es lo que exige nuestra
   * función. Son dos puertas seguidas, no una repetida: la de
   * Supabase deja pasar a cualquiera con la llave pública —que
   * lleva hasta el navegador— y la nuestra sólo al servidor. */
  perform cron.schedule('mandar-avisos', '*/5 * * * *', format($f$
    select net.http_post(
      url     := %L,
      headers := jsonb_build_object(
                   'Content-Type',   'application/json',
                   'Authorization',  'Bearer ' || (select valor from ajuste where clave = 'anon_key'),
                   'x-cron-secret',  (select valor from ajuste where clave = 'cron_secret')),
      body    := '{}'::jsonb
    );
  $f$, url));

  raise notice 'Los correos se entregan cada cinco minutos.';
exception when others then
  raise warning 'No se ha podido programar el envío (%). Se puede disparar a mano.', sqlerrm;
end $$;
