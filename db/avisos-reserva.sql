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
    if encolar_o_reescribir(a.id, el_motivo, la_marca || ':' || a.id, el_asunto, el_cuerpo) then
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
-- Encolar, o REESCRIBIR si todavía no ha salido.
--
-- Es la pieza que permite que el disparador cuelgue de
-- `reserva_perro` en vez de ser APLAZADO. Ver el comentario largo
-- de abajo.
--
-- Mientras el aviso siga en `pendiente` se puede reescribir: no
-- se ha mandado nada todavía, así que no hay nada que duplicar.
-- En cuanto pasa a `enviando` o `enviado` no se toca, porque
-- entonces sí habría salido ya por correo.
-- ------------------------------------------------------------
create or replace function encolar_o_reescribir(
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
  on conflict (marca) do update
     set asunto = excluded.asunto,
         cuerpo = excluded.cuerpo
   where aviso.estado = 'pendiente';

  return true;
end $$;

revoke all on function encolar_o_reescribir(uuid, text, text, text, text) from public;

-- ------------------------------------------------------------
-- 1. Entra una reserva.
--
-- CUELGA DE `reserva_perro`, NO DE `reserva`. Y no es capricho.
--
-- El problema: los perros de una reserva se meten DESPUÉS que la
-- reserva, así que un disparador sobre `reserva` mandaría el
-- correo sin decir de qué perro habla — que es justo el dato por
-- el que el cliente lo abre.
--
-- El primer intento fue un disparador APLAZADO, que salta al
-- cerrar la operación. Reventó el 13/09/2026 y de la peor manera:
--
--   55006: cannot ALTER TABLE "reserva" because it has pending
--          trigger events
--
-- Las pruebas de `reservas.sql`, `bloqueos.sql` y
-- `crear-reserva.sql` insertan reservas de mentira, y cada una
-- dejaba un disparador pendiente que BLOQUEA la tabla para todo
-- lo que venga después. El SQL entero dejó de poder aplicarse.
--
-- Colgándolo de `reserva_perro` no hay nada aplazado: salta con
-- cada perro que se añade, y cada vez REESCRIBE el correo con la
-- lista de perros que haya hasta ese momento. Al meter el último,
-- el texto ya está completo — y el reparto no pasa hasta cinco
-- minutos después. Lo que ya se ha mandado no se toca.
-- ------------------------------------------------------------
create or replace function aviso_de_reserva_nueva()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  r            reserva%rowtype;
  perros_texto text;
  sitio        text;
  cliente_texto text;
begin
  select * into r from reserva where id = new.reserva_id;
  if r.id is null then return null; end if;

  -- Sólo al nacer. Añadir un perro a una reserva ya confirmada no
  -- es una reserva nueva y no tiene que mandar nada.
  if r.estado not in ('pendiente', 'confirmada') then return null; end if;

  select string_agg(p.nombre, ', ' order by p.nombre)
    into perros_texto
    from reserva_perro rp join perro p on p.id = rp.perro_id
   where rp.reserva_id = r.id;

  select nombre into sitio from alojamiento where id = r.alojamiento_id;

  select trim(c.nombre || ' ' || c.apellidos) into cliente_texto
    from cliente c where c.id = r.cliente_id;

  -- ---------- Al cliente ----------
  if r.estado = 'pendiente' then
    perform encolar_o_reescribir(
      r.cliente_id, 'reserva', 'reserva-nueva:' || r.id,
      'Hemos recibido tu reserva en AmigoMío',
      'Hola:' || chr(10) || chr(10) ||
      'Ya tenemos tu reserva apuntada para ' || coalesce(perros_texto, 'tu perro') || ':' ||
      chr(10) || chr(10) ||
      'Entrada: ' || to_char(r.entrada, 'DD/MM/YYYY') || ' a las ' ||
                     to_char(r.entrada, 'HH24:MI') || chr(10) ||
      'Salida: '  || to_char(r.salida,  'DD/MM/YYYY') || ' a las ' ||
                     to_char(r.salida,  'HH24:MI') || chr(10) ||
      'Total: '   || to_char(r.total, 'FM999999990.00') || ' €' ||
      chr(10) || chr(10) ||
      'NOS FALTA EL JUSTIFICANTE. Guardamos el sitio hasta el ' ||
      to_char(r.expira, 'DD/MM/YYYY') || ' a las ' || to_char(r.expira, 'HH24:MI') ||
      '; si para entonces no nos ha llegado, se suelta solo y lo puede coger otro.' ||
      chr(10) || chr(10) ||
      'Súbenos el resguardo de la transferencia desde «Mis reservas» en la ' ||
      'aplicación y listo.' || pie_de_contacto());
  else
    perform encolar_o_reescribir(
      r.cliente_id, 'reserva', 'reserva-nueva:' || r.id,
      'Tu reserva en AmigoMío está confirmada',
      'Hola:' || chr(10) || chr(10) ||
      'Tu reserva para ' || coalesce(perros_texto, 'tu perro') || ' está confirmada:' ||
      chr(10) || chr(10) ||
      'Entrada: ' || to_char(r.entrada, 'DD/MM/YYYY') || ' a las ' ||
                     to_char(r.entrada, 'HH24:MI') || chr(10) ||
      'Salida: '  || to_char(r.salida,  'DD/MM/YYYY') || ' a las ' ||
                     to_char(r.salida,  'HH24:MI') || chr(10) ||
      'Total: '   || to_char(r.total, 'FM999999990.00') || ' €' ||
      chr(10) || chr(10) ||
      'Se paga al llegar. No tienes que hacer nada más.' || pie_de_contacto());
  end if;

  -- ---------- Y a administración ----------
  perform avisar_a_administracion(
    'reserva', 'reserva-nueva-admin:' || r.id,
    'Reserva nueva: ' || coalesce(perros_texto, '?') || ', ' ||
      to_char(r.entrada, 'DD/MM'),
    coalesce(cliente_texto, 'Un cliente') || ' ha reservado para ' ||
    coalesce(perros_texto, '?') || '.' || chr(10) || chr(10) ||
    'Del ' || to_char(r.entrada, 'DD/MM/YYYY HH24:MI') ||
    ' al ' || to_char(r.salida,  'DD/MM/YYYY HH24:MI') || chr(10) ||
    'Alojamiento: ' || coalesce(sitio, '?') || chr(10) ||
    'Total: ' || to_char(r.total, 'FM999999990.00') || ' €' || chr(10) ||
    'Estado: ' || r.estado ||
    case when r.estado = 'pendiente'
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
  raise warning 'No se pudo encolar el aviso de la reserva %: %', r.id, sqlerrm;
  return null;
end $$;

drop trigger if exists reserva_avisa_al_entrar on reserva;
drop trigger if exists reserva_perro_avisa_al_entrar on reserva_perro;
create trigger reserva_perro_avisa_al_entrar
  after insert on reserva_perro
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

-- ------------------------------------------------------------
-- 3. Que una cancelación se VEA en el panel.
--
-- Santiago, 13/09/2026: «he hecho una cancelación y no me avisa,
-- creo que esa notificación debe salir en el menú de
-- validaciones».
--
-- El correo no le llegó por decisión nuestra: la cancelación la
-- hizo él, que es administración, y no se avisa a alguien de lo
-- que acaba de hacer. Pero ver que un box ha quedado libre es
-- otra cosa, y eso sí tiene que estar en el panel.
--
-- Por defecto `true` —«ya vista»— para que las cancelaciones que
-- ya existían no aparezcan todas de golpe como si fueran de hoy.
-- Sólo las nuevas se marcan sin ver.
-- ------------------------------------------------------------
alter table reserva
  add column if not exists cancelacion_vista boolean not null default true;

create or replace function marcar_cancelacion_sin_ver()
returns trigger language plpgsql
set search_path = public as $$
begin
  -- Si cancela administración, ya lo ha visto: estaba mirándolo.
  -- Que te aparezca como pendiente lo que acabas de hacer tú es
  -- la forma más rápida de que se deje de mirar la lista.
  new.cancelacion_vista := es_admin();
  return new;
exception when others then
  -- La misma regla que los otros dos: llevar la cuenta de lo
  -- pendiente NO puede impedir cancelar una reserva. Si esto
  -- falla, la cancelación sigue adelante y a lo sumo no sale en
  -- la lista.
  raise warning 'No se pudo marcar la cancelacion de %: %', new.id, sqlerrm;
  return new;
end $$;

drop trigger if exists reserva_cancelacion_sin_ver on reserva;
create trigger reserva_cancelacion_sin_ver
  before update of estado on reserva
  for each row
  when (old.estado is distinct from new.estado and new.estado = 'cancelada')
  execute function marcar_cancelacion_sin_ver();

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
  -- NO puede ser aplazado: un disparador aplazado sobre `reserva`
  -- deja eventos pendientes que bloquean la tabla y hacen que el
  -- SQL entero no se pueda aplicar (55006). Va sobre
  -- `reserva_perro` y salta en el momento.
  select count(*) into n
    from pg_trigger
   where tgname = 'reserva_perro_avisa_al_entrar' and not tgdeferrable;
  assert n = 1, 'falta el disparador de reserva nueva, o es aplazado';

  select count(*) into n from pg_trigger where tgdeferrable
     and tgrelid = 'reserva'::regclass and not tgisinternal;
  assert n = 0, 'ningun disparador nuestro sobre reserva puede ser aplazado';

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

  select count(*) into n from pg_trigger where tgname = 'reserva_cancelacion_sin_ver';
  assert n = 1, 'falta el disparador que marca la cancelacion sin ver';

  select count(*) into n from information_schema.columns
   where table_schema='public' and table_name='reserva'
     and column_name='cancelacion_vista';
  assert n = 1, 'falta la columna cancelacion_vista';

  raise notice 'Avisos de reserva: disparadores puestos y a prueba de fallos.';
end $$;
