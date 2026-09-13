-- ============================================================
-- LOS AVISOS DE UNA RESERVA: cuando entra y cuando se cae.
--
-- Santiago, 13/09/2026: «los mensajes de confirmación de reserva
-- no están llegando». Y no llegaban porque NO EXISTÍAN. La cola
-- de avisos tenía exactamente una fila en toda su vida, y el
-- reloj que la reparte estaba perfectamente vivo (328 vueltas,
-- todas correctas): sencillamente nadie encolaba nada al
-- reservar.
--
-- Un cliente que reserva y no recibe nada cree que no ha
-- funcionado. Llama, o se va a otro sitio. Es el correo más
-- barato de mandar y el más caro de no mandar.
--
-- Y: «las reservas canceladas por el cliente deben enviar un
-- aviso a la administración». Una plaza que se libera y nadie se
-- entera es una plaza vendida dos veces o vacía en agosto.
--
-- ------------------------------------------------------------
-- POR QUÉ UN DISPARADOR Y NO UN AÑADIDO A `crear_reserva()`:
--
-- Porque las reservas entran por tres puertas —el cliente, el
-- panel de administración y Zapatilla— y el día que se abra una
-- cuarta, el aviso ya estará puesto. Lo que se cuelga de la
-- tabla no se olvida; lo que se cuelga de una función, sí.
-- ============================================================

-- ------------------------------------------------------------
-- Avisar a administración.
--
-- A todos los que lo sean: si sólo se avisara a uno, el día que
-- ese esté de vacaciones no se entera nadie. La marca lleva
-- dentro a quién va, porque es única para toda la tabla.
-- ------------------------------------------------------------
create or replace function avisar_a_administracion(
  el_motivo text,
  la_marca  text,
  el_asunto text,
  el_cuerpo text
) returns integer language plpgsql security definer
set search_path = public as $$
declare
  a       record;
  puestos integer := 0;
begin
  for a in select id from cliente where es_admin loop
    if encolar_aviso(a.id, el_motivo, la_marca || ':' || a.id, el_asunto, el_cuerpo) then
      puestos := puestos + 1;
    end if;
  end loop;
  return puestos;
end $$;

revoke all on function avisar_a_administracion(text, text, text, text) from public;

-- ------------------------------------------------------------
-- Cómo se nos habla. Con el enlace, no sólo el número.
--
-- Santiago, 13/09/2026: «debe haber un enlace para hablar por
-- WhatsApp». Los correos decían «escríbenos al 673 229 399» y
-- ahí el cliente tiene que copiar el número a mano. Un enlace se
-- toca y ya está hablando.
-- ------------------------------------------------------------
create or replace function pie_de_contacto()
returns text language sql immutable as $$
  select chr(10) || chr(10) ||
         'Para cualquier cosa, háblanos por WhatsApp: https://wa.me/34673229399' ||
         chr(10) || 'Un saludo,' || chr(10) || 'AmigoMío';
$$;

-- ------------------------------------------------------------
-- 1. Entra una reserva.
--
-- DISPARADOR APLAZADO (`deferrable initially deferred`): salta
-- al CERRAR la operación, no al insertar la fila. Hace falta
-- porque los perros de la reserva se meten DESPUÉS que la
-- reserva, y sin esperar al cierre el correo saldría sin decir
-- de qué perros habla — que es justo el dato por el que el
-- cliente abre el correo.
-- ------------------------------------------------------------
create or replace function aviso_de_reserva_nueva()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  perros_texto text;
  sitio        text;
  cliente_texto text;
begin
  select string_agg(p.nombre, ', ' order by p.nombre)
    into perros_texto
    from reserva_perro rp join perro p on p.id = rp.perro_id
   where rp.reserva_id = new.id;

  select nombre into sitio from alojamiento where id = new.alojamiento_id;

  select trim(c.nombre || ' ' || c.apellidos) into cliente_texto
    from cliente c where c.id = new.cliente_id;

  -- ---------- Al cliente ----------
  if new.estado = 'pendiente' then
    perform encolar_aviso(
      new.cliente_id, 'reserva', 'reserva-nueva:' || new.id,
      'Hemos recibido tu reserva en AmigoMío',
      'Hola:' || chr(10) || chr(10) ||
      'Ya tenemos tu reserva apuntada para ' || coalesce(perros_texto, 'tu perro') || ':' ||
      chr(10) || chr(10) ||
      'Entrada: ' || to_char(new.entrada, 'DD/MM/YYYY') || ' a las ' ||
                     to_char(new.entrada, 'HH24:MI') || chr(10) ||
      'Salida: '  || to_char(new.salida,  'DD/MM/YYYY') || ' a las ' ||
                     to_char(new.salida,  'HH24:MI') || chr(10) ||
      'Total: '   || to_char(new.total, 'FM999999990.00') || ' €' ||
      chr(10) || chr(10) ||
      'NOS FALTA EL JUSTIFICANTE. Guardamos el sitio hasta el ' ||
      to_char(new.expira, 'DD/MM/YYYY') || ' a las ' || to_char(new.expira, 'HH24:MI') ||
      '; si para entonces no nos ha llegado, se suelta solo y lo puede coger otro.' ||
      chr(10) || chr(10) ||
      'Súbenos el resguardo de la transferencia desde «Mis reservas» en la ' ||
      'aplicación y listo.' || pie_de_contacto());
  else
    perform encolar_aviso(
      new.cliente_id, 'reserva', 'reserva-nueva:' || new.id,
      'Tu reserva en AmigoMío está confirmada',
      'Hola:' || chr(10) || chr(10) ||
      'Tu reserva para ' || coalesce(perros_texto, 'tu perro') || ' está confirmada:' ||
      chr(10) || chr(10) ||
      'Entrada: ' || to_char(new.entrada, 'DD/MM/YYYY') || ' a las ' ||
                     to_char(new.entrada, 'HH24:MI') || chr(10) ||
      'Salida: '  || to_char(new.salida,  'DD/MM/YYYY') || ' a las ' ||
                     to_char(new.salida,  'HH24:MI') || chr(10) ||
      'Total: '   || to_char(new.total, 'FM999999990.00') || ' €' ||
      chr(10) || chr(10) ||
      'Se paga al llegar. No tienes que hacer nada más.' || pie_de_contacto());
  end if;

  -- ---------- Y a administración ----------
  perform avisar_a_administracion(
    'reserva', 'reserva-nueva-admin:' || new.id,
    'Reserva nueva: ' || coalesce(perros_texto, '?') || ', ' ||
      to_char(new.entrada, 'DD/MM'),
    coalesce(cliente_texto, 'Un cliente') || ' ha reservado para ' ||
    coalesce(perros_texto, '?') || '.' || chr(10) || chr(10) ||
    'Del ' || to_char(new.entrada, 'DD/MM/YYYY HH24:MI') ||
    ' al ' || to_char(new.salida,  'DD/MM/YYYY HH24:MI') || chr(10) ||
    'Alojamiento: ' || coalesce(sitio, '?') || chr(10) ||
    'Total: ' || to_char(new.total, 'FM999999990.00') || ' €' || chr(10) ||
    'Estado: ' || new.estado ||
    case when new.estado = 'pendiente'
         then ' (esperando el justificante)' else '' end ||
    chr(10) || chr(10) ||
    'La tienes en Administración → Por validar.');

  return null;
exception when others then
  -- UN AVISO QUE FALLA NO PUEDE TUMBAR UNA RESERVA.
  --
  -- Sin esto, un fallo mandando un correo desharía la reserva
  -- entera y el cliente vería un error sin entender nada. Se
  -- queda anotado en el registro del servidor y la reserva sigue
  -- su camino: el dinero primero, el correo después.
  raise warning 'No se pudo encolar el aviso de la reserva %: %', new.id, sqlerrm;
  return null;
end $$;

drop trigger if exists reserva_avisa_al_entrar on reserva;
create constraint trigger reserva_avisa_al_entrar
  after insert on reserva
  deferrable initially deferred
  for each row execute function aviso_de_reserva_nueva();

-- ------------------------------------------------------------
-- 2. Se cancela una reserva.
--
-- Sólo se avisa si NO la ha cancelado administración: avisarse a
-- uno mismo de lo que acaba de hacer es la forma más rápida de
-- que se dejen de leer los avisos.
-- ------------------------------------------------------------
create or replace function aviso_de_reserva_cancelada()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  perros_texto  text;
  cliente_texto text;
  telefono      text;
begin
  if es_admin() then return null; end if;

  select string_agg(p.nombre, ', ' order by p.nombre)
    into perros_texto
    from reserva_perro rp join perro p on p.id = rp.perro_id
   where rp.reserva_id = new.id;

  select trim(c.nombre || ' ' || c.apellidos), c.telefono
    into cliente_texto, telefono
    from cliente c where c.id = new.cliente_id;

  perform avisar_a_administracion(
    'cancelacion', 'reserva-cancelada:' || new.id,
    'Cancelación: ' || coalesce(perros_texto, '?') || ', ' ||
      to_char(new.entrada, 'DD/MM'),
    coalesce(cliente_texto, 'Un cliente') || ' ha cancelado su reserva para ' ||
    coalesce(perros_texto, '?') || '.' || chr(10) || chr(10) ||
    'Era del ' || to_char(new.entrada, 'DD/MM/YYYY HH24:MI') ||
    ' al ' || to_char(new.salida, 'DD/MM/YYYY HH24:MI') || chr(10) ||
    'Total: ' || to_char(new.total, 'FM999999990.00') || ' €' || chr(10) || chr(10) ||
    'EL ALOJAMIENTO HA QUEDADO LIBRE esas noches.' || chr(10) || chr(10) ||
    case when coalesce(telefono, '') <> ''
         then 'Hablar con ' || coalesce(cliente_texto, 'el cliente') || ': ' ||
              'https://wa.me/34' || regexp_replace(telefono, '\D', '', 'g') ||
              ' (' || telefono || ')'
         else 'No tenemos su teléfono en la ficha.' end);

  return null;
exception when others then
  raise warning 'No se pudo encolar el aviso de cancelación de %: %', new.id, sqlerrm;
  return null;
end $$;

drop trigger if exists reserva_avisa_al_cancelar on reserva;
create trigger reserva_avisa_al_cancelar
  after update of estado on reserva
  for each row
  when (old.estado is distinct from new.estado and new.estado = 'cancelada')
  execute function aviso_de_reserva_cancelada();

-- ============================================================
-- PRUEBAS. Aplicar este fichero ES ejecutarlas.
--
-- Se comprueba la ESTRUCTURA, no los datos: esto corre contra la
-- base de verdad, con clientes de verdad. Una prueba que dé por
-- hecho el estado de los datos revienta la instalación entera el
-- día que alguien use la aplicación — ha pasado dos veces.
-- ============================================================
do $$
declare
  n integer;
begin
  -- El de entrar tiene que ser APLAZADO, o el correo saldría sin
  -- los perros dentro.
  select count(*) into n
    from pg_trigger
   where tgname = 'reserva_avisa_al_entrar' and tgdeferrable;
  assert n = 1, 'el aviso de reserva nueva tiene que ser un disparador aplazado';

  select count(*) into n from pg_trigger where tgname = 'reserva_avisa_al_cancelar';
  assert n = 1, 'falta el disparador de cancelacion';

  -- Los dos tienen que tragarse su propio error: un aviso que
  -- falla no puede deshacer una reserva.
  select count(*) into n
    from pg_proc
   where proname in ('aviso_de_reserva_nueva', 'aviso_de_reserva_cancelada')
     and prosrc like '%exception when others%';
  assert n = 2, 'un aviso que falle tumbaria la reserva entera';

  -- Y el enlace de WhatsApp, que es lo que pidio Santiago: no
  -- vale poner el numero suelto, hay que poder tocarlo.
  assert pie_de_contacto() like '%https://wa.me/34673229399%',
    'el pie tiene que llevar el ENLACE, no solo el numero';

  raise notice 'Avisos de reserva: disparadores puestos y a prueba de fallos.';
end $$;
