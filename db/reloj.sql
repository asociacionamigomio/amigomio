-- ============================================================
-- EL RELOJ DE LAS 24 HORAS, Y EL JUSTIFICANTE
--
-- Esto tapa el agujero más grave que tenía la aplicación: la
-- reserva se creaba con fecha de caducidad, al cliente se le
-- ENSEÑABA («tienes hasta el jueves a las 18:30») y no había
-- nada que la ejecutara. Un box pedido para Semana Santa y no
-- pagado se quedaba bloqueado para siempre.
--
-- El camino completo de una reserva sin pagar por adelantado:
--
--   pendiente ──(el cliente sube el papel)──▶ revisando
--       │                                        │
--       │                          ┌─────────────┴─────────────┐
--       │                          ▼                           ▼
--       │                  (administración               (administración
--       │                    lo valida)                    lo rechaza)
--       │                          │                           │
--       │                          ▼                           ▼
--       │                     confirmada              vuelve a pendiente,
--       ▼                                              con reloj nuevo
--   caducada (a las 24 h)
--
-- Dos decisiones que no son evidentes:
--
-- 1. SUBIR EL PAPEL NO CONFIRMA NADA. Una foto puede ser de
--    cualquier cosa. La transferencia se ve en la cuenta, no en
--    la foto. Pero SÍ para el reloj: quien ha pagado y ha
--    mandado el resguardo no puede perder el sitio mientras
--    nosotros tardamos en mirarlo.
-- 2. RECHAZARLO NO MATA LA RESERVA. Le da un plazo nuevo. Si no,
--    perdemos un cliente por una foto movida.
--
-- Aplicar DESPUÉS de reservas.sql y crear-reserva.sql.
-- ============================================================

-- Dónde está el papel y qué se sabe de él. `justificante` ya
-- existía como columna suelta y no se usaba.
alter table reserva add column if not exists justificante_subido timestamptz;
alter table reserva add column if not exists justificante_nota   text not null default '';

comment on column reserva.justificante is
  'Ruta dentro del cubo `justificantes`. La primera carpeta es el id del usuario';

-- ============================================================
-- EL RELOJ
--
-- `security definer` porque tiene que cambiar reservas de
-- cualquiera: es el servidor, no una persona. Y por eso mismo
-- vigila su propia puerta.
-- ============================================================
create or replace function caducar_reservas()
returns integer language plpgsql security definer
set search_path = public as $$
declare
  cuantas integer;
begin
  -- La puerta: o la llama el servidor (el cron), o la llama
  -- administración desde el panel. Nadie más.
  if not es_admin_o_servidor() then
    raise exception 'Esto no lo decides tú.';
  end if;

  -- Sólo las pendientes que ya pasaron de hora. Una confirmada
  -- NO se toca aunque le quede un `expira` puesto: quien ya
  -- pagó no pierde su sitio por un descuido nuestro. Y una en
  -- `revisando` tampoco: el papel está mandado y la tardanza es
  -- nuestra.
  with soltadas as (
    update reserva
       set estado = 'caducada', expira = null
     where estado = 'pendiente'
       and expira is not null
       and expira < now()
    returning id
  )
  select count(*) into cuantas from soltadas;

  return cuantas;
end $$;

revoke all on function caducar_reservas() from public;
grant execute on function caducar_reservas() to authenticated;

-- ------------------------------------------------------------
-- Que lo ejecute el servidor, no el navegador.
--
-- Si dependiera de que alguien abra la aplicación, las reservas
-- de agosto caducarían en septiembre. Con pg_cron, cada diez
-- minutos.
--
-- pg_cron es una extensión y puede no estar disponible: si no
-- lo está, esto avisa y sigue. El reloj queda entonces en manos
-- del botón del panel, que hace exactamente lo mismo.
-- ------------------------------------------------------------
do $$
begin
  create extension if not exists pg_cron;

  perform cron.unschedule('caducar-reservas')
    where exists (select 1 from cron.job where jobname = 'caducar-reservas');

  perform cron.schedule('caducar-reservas', '*/10 * * * *',
                        'select caducar_reservas()');

  raise notice 'Reloj programado: cada diez minutos.';
exception when others then
  raise warning 'pg_cron no está disponible (%). El reloj se dispara a mano desde el panel.',
    sqlerrm;
end $$;

-- ============================================================
-- EL JUSTIFICANTE
-- ============================================================

-- Lo sube el CLIENTE. Para el reloj, no confirma nada.
create or replace function subir_justificante(la_reserva uuid, la_ruta text)
returns jsonb language plpgsql security definer
set search_path = public as $$
declare
  r reserva;
begin
  select * into r from reserva where id = la_reserva;
  if not found then
    raise exception 'Esa reserva no existe.';
  end if;

  -- Con auth.uid() nulo, un visitante sin identificar pasaría
  -- la comprobación de «¿es tuya?». Hay que distinguir al
  -- servidor de internet.
  if auth.uid() is null and current_user not in ('postgres','supabase_admin') then
    raise exception 'Entra con tu correo para subirlo.';
  end if;

  if r.cliente_id <> auth.uid() and not es_admin() then
    raise exception 'Esa reserva no es tuya.';
  end if;

  if r.estado not in ('pendiente','revisando') then
    raise exception 'Esa reserva ya no está esperando el justificante.';
  end if;

  update reserva
     set justificante = la_ruta,
         justificante_subido = now(),
         justificante_nota = '',
         estado = 'revisando',
         -- El reloj se para AQUÍ. Quien ha pagado y ha mandado
         -- el resguardo no puede perder el sitio mientras
         -- nosotros tardamos en mirarlo.
         expira = null
   where id = la_reserva;

  return jsonb_build_object(
    'ok', true,
    'estado', 'revisando',
    'mensaje', 'Recibido. Lo miramos y te confirmamos.');
end $$;

-- Lo mira ADMINISTRACIÓN. Esto sí confirma.
create or replace function validar_justificante(la_reserva uuid)
returns jsonb language plpgsql security definer
set search_path = public as $$
begin
  if not es_admin_o_servidor() then
    raise exception 'Esto lo confirma administración.';
  end if;

  update reserva set estado = 'confirmada', expira = null
   where id = la_reserva and estado in ('pendiente','revisando');

  if not found then
    raise exception 'Esa reserva no estaba esperando confirmación.';
  end if;

  /* Y se le dice al cliente. Aquí y no en la pantalla, porque
     administración también confirma por teléfono: el correo
     tiene que salir se confirme desde donde se confirme.

     Si falla el correo NO se deshace la confirmación: la
     reserva está pagada, y eso pesa más que un aviso. Se queda
     en la cola con su fallo apuntado. */
  begin
    perform avisar_reserva_confirmada(la_reserva);
  exception when others then
    raise warning 'La reserva se confirmó pero el correo no salió: %', sqlerrm;
  end;

  return jsonb_build_object('ok', true, 'estado', 'confirmada');
end $$;

-- Si el papel no vale. NO mata la reserva: le da plazo nuevo.
create or replace function rechazar_justificante(la_reserva uuid, el_motivo text default '')
returns jsonb language plpgsql security definer
set search_path = public as $$
declare
  horas integer;
begin
  if not es_admin_o_servidor() then
    raise exception 'Esto lo decide administración.';
  end if;

  -- El mismo plazo que al crearla: 24 horas desde ahora.
  horas := 24;

  update reserva
     set estado = 'pendiente',
         justificante = null,
         justificante_subido = null,
         justificante_nota = el_motivo,
         expira = now() + (horas || ' hours')::interval
   where id = la_reserva and estado = 'revisando';

  if not found then
    raise exception 'Esa reserva no tenía ningún justificante por revisar.';
  end if;

  return jsonb_build_object('ok', true, 'estado', 'pendiente',
                            'mensaje', 'Le hemos dado otras ' || horas || ' horas.');
end $$;

revoke all on function subir_justificante(uuid, text) from public;
revoke all on function validar_justificante(uuid) from public;
revoke all on function rechazar_justificante(uuid, text) from public;
grant execute on function subir_justificante(uuid, text)      to authenticated;
grant execute on function validar_justificante(uuid)          to authenticated;
grant execute on function rechazar_justificante(uuid, text)   to authenticated;

-- ============================================================
-- PRUEBAS. Aplicar este fichero ES ejecutarlas.
-- Se monta una reserva de mentira, se comprueba y se deshace.
-- ============================================================
do $$
declare
  el_cliente uuid;
  la_reserva uuid;
  otra       uuid;
  el_aloj    integer;
  cuantas    integer;
  e          text;
begin
  select id into el_cliente from cliente limit 1;
  select id into el_aloj from alojamiento where tipo = 'normal' order by id limit 1;

  if el_cliente is null or el_aloj is null then
    raise notice 'Sin clientes o sin alojamientos todavía: el reloj se probará cuando los haya.';
    return;
  end if;

  -- Una pendiente que caducó hace una hora
  insert into reserva (cliente_id, alojamiento_id, entrada, salida, perros,
                       estado, desglose, total, expira)
       values (el_cliente, el_aloj, '2099-01-10 11:00', '2099-01-12 11:00', 1,
               'pendiente', '{}'::jsonb, 30, now() - interval '1 hour')
    returning id into la_reserva;

  -- Y una CONFIRMADA con el `expira` puesto por descuido
  insert into reserva (cliente_id, alojamiento_id, entrada, salida, perros,
                       estado, desglose, total, expira)
       values (el_cliente, el_aloj, '2099-02-10 11:00', '2099-02-12 11:00', 1,
               'confirmada', '{}'::jsonb, 30, now() - interval '1 hour')
    returning id into otra;

  cuantas := caducar_reservas();

  assert (select estado from reserva where id = la_reserva) = 'caducada',
    'la pendiente vencida tenía que soltarse';
  assert (select estado from reserva where id = otra) = 'confirmada',
    'una CONFIRMADA no se toca aunque le quede fecha de caducidad';
  assert (select expira from reserva where id = la_reserva) is null,
    'y ya no le queda reloj';

  -- No la borra: deja constancia.
  assert exists (select 1 from reserva where id = la_reserva),
    'la reserva caducada se queda, no se borra';

  -- ---------- El justificante ----------
  update reserva set estado = 'pendiente', expira = now() + interval '24 hours'
   where id = la_reserva;

  perform subir_justificante(la_reserva, el_cliente || '/prueba.jpg');

  assert (select estado from reserva where id = la_reserva) = 'revisando',
    'subir el papel deja la reserva en revisión, no confirmada';
  assert (select expira from reserva where id = la_reserva) is null,
    'y para el reloj: quien ya mandó el resguardo no pierde el sitio esperándonos';

  -- Una en revisión NO caduca
  cuantas := caducar_reservas();
  assert (select estado from reserva where id = la_reserva) = 'revisando',
    'una reserva en revisión no puede caducar: la tardanza es nuestra';

  -- Rechazar devuelve el reloj
  perform rechazar_justificante(la_reserva, 'La foto está movida');
  assert (select estado from reserva where id = la_reserva) = 'pendiente',
    'rechazar el papel no mata la reserva';
  assert (select expira from reserva where id = la_reserva) > now() + interval '23 hours',
    'le tiene que dar plazo nuevo';
  assert (select justificante_nota from reserva where id = la_reserva) = 'La foto está movida',
    'y decirle por qué, que si no vuelve a mandar la misma foto';

  -- Validar confirma
  perform subir_justificante(la_reserva, el_cliente || '/prueba2.jpg');
  perform validar_justificante(la_reserva);
  assert (select estado from reserva where id = la_reserva) = 'confirmada',
    'administración confirma';

  /* MUY IMPORTANTE. Estas pruebas usan un cliente DE VERDAD —el
     primero que haya— porque una reserva necesita uno. Y
     `validar_justificante` encola el correo de «todo listo».

     Sin esta línea, cada vez que se reaplicara el fichero le
     llegaría a ese cliente un correo diciéndole que su perro
     tiene plaza para enero de 2099. Se quita antes de que el
     cartero pase. */
  delete from aviso where marca = 'confirmacion:' || la_reserva;

  delete from reserva where id in (la_reserva, otra);

  raise notice 'Reloj y justificante: todas las comprobaciones pasan.';
end $$;
