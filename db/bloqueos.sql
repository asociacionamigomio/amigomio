-- ============================================================
-- BLOQUEAR FECHAS
--
-- Fechas en las que un alojamiento —o todos— no se puede
-- reservar: obras, desinfección, vacaciones, una avería.
--
-- Y una razón más, que es la que lo hizo urgente: PERMITE
-- CONVIVIR CON WIX SIN VENDER DOS VECES LA MISMA NOCHE. Los
-- boxes que se dejan a Wix se bloquean aquí y la aplicación no
-- los toca.
--
-- Tres reglas:
--
-- 1. UN BLOQUEO SIN ALOJAMIENTO SON TODOS. Es lo que se quiere
--    decir con «cerramos del 24 al 26»: nadie lo dice box por
--    box.
-- 2. NO SE BLOQUEA LO QUE YA ESTÁ RESERVADO. Vendérselo a
--    alguien y luego quitárselo es una llamada muy desagradable.
-- 3. LO IMPIDE LA BASE, NO LA PANTALLA. Un bloqueo que sólo
--    comprueba el navegador no bloquea nada: Zapatilla y el
--    panel de administración entran por otra puerta.
--
-- Aplicar DESPUÉS de reservas.sql.
-- ============================================================

-- La TABLA `bloqueo` se crea en db/reservas.sql, junto a las
-- demás: `hay_sitio` la consulta, y una función no puede hablar
-- de una tabla que se va a crear en un fichero posterior — sus
-- propias pruebas abortarían. Aquí vive lo que se hace CON ella.

-- ------------------------------------------------------------
-- ¿Está bloqueada esta noche para este alojamiento?
--
-- El rango es '[)' igual que en las reservas: el `hasta` del
-- bloqueo es el último día CERRADO, así que la comprobación es
-- `la_noche between desde and hasta`. Un perro que se va el 24
-- no choca con un bloqueo que empieza el 24, porque esa noche ya
-- no duerme aquí.
-- ------------------------------------------------------------
create or replace function esta_bloqueado(el_alojamiento integer, la_noche date)
returns boolean language sql stable
set search_path = public as $$
  select exists (
    select 1 from bloqueo b
     where (b.alojamiento_id is null or b.alojamiento_id = el_alojamiento)
       and la_noche >= b.desde
       and la_noche <= b.hasta
  );
$$;

-- ------------------------------------------------------------
-- Ponerlos.
--
-- `los_alojamientos` vacío o nulo = todos. Devuelve lo que ha
-- hecho, y si algo choca con una reserva lo dice con nombre y
-- fecha: «no se puede» a secas obliga a ir mirando uno por uno.
-- ------------------------------------------------------------
create or replace function bloquear_fechas(
  los_alojamientos integer[],
  el_desde         date,
  el_hasta         date,
  el_motivo        text default ''
) returns jsonb language plpgsql security definer
set search_path = public as $$
declare
  choque   record;
  puestos  integer := 0;
  al       integer;
begin
  if not es_admin_o_servidor() then
    raise exception 'Las fechas las bloquea administración.';
  end if;

  if el_hasta < el_desde then
    raise exception 'La fecha de fin va después de la de inicio.';
  end if;

  -- ¿Pisa alguna reserva viva? Se mira ANTES de tocar nada: o
  -- entra todo o no entra nada.
  select r.id, r.entrada, a.nombre into choque
    from reserva r
    left join alojamiento a on a.id = r.alojamiento_id
   where r.estado in ('pendiente','revisando','confirmada','en_curso')
     and (los_alojamientos is null
          or array_length(los_alojamientos, 1) is null
          or r.alojamiento_id = any(los_alojamientos))
     -- Las noches del bloqueo son [desde, hasta]; las de la
     -- reserva, [entrada, salida). Se cruzan si...
     and r.entrada::date <= el_hasta
     and r.salida::date   > el_desde
   limit 1;

  if found then
    raise exception 'Esas fechas ya están reservadas en %  (entra el %). Habla con el cliente antes.',
      coalesce(choque.nombre, 'un alojamiento'),
      to_char(choque.entrada, 'DD/MM/YYYY');
  end if;

  if los_alojamientos is null or array_length(los_alojamientos, 1) is null then
    -- Todos: una sola fila con el alojamiento vacío. Así, si
    -- mañana se añade un box nuevo, también queda cerrado.
    insert into bloqueo (alojamiento_id, desde, hasta, motivo)
         values (null, el_desde, el_hasta, el_motivo);
    puestos := 1;
  else
    foreach al in array los_alojamientos loop
      insert into bloqueo (alojamiento_id, desde, hasta, motivo)
           values (al, el_desde, el_hasta, el_motivo);
      puestos := puestos + 1;
    end loop;
  end if;

  return jsonb_build_object('ok', true, 'puestos', puestos);
end $$;

revoke all on function bloquear_fechas(integer[], date, date, text) from public;
grant execute on function bloquear_fechas(integer[], date, date, text) to authenticated;

-- ------------------------------------------------------------
-- La puerta de verdad: que la base rechace una reserva que pise
-- un bloqueo, venga de donde venga.
--
-- `hay_sitio` ya descarta los alojamientos bloqueados, pero eso
-- es para no ofrecerlos. Esto es lo que los cierra: Zapatilla,
-- el panel y la pantalla de reservar pasan todos por aquí.
-- ------------------------------------------------------------
create or replace function reserva_no_pisa_bloqueo()
returns trigger language plpgsql
set search_path = public as $$
declare
  d date;
begin
  if new.estado not in ('pendiente','revisando','confirmada','en_curso') then
    return new;              -- una cancelada no molesta a nadie
  end if;

  for d in select generate_series(new.entrada::date, new.salida::date - 1, '1 day')::date loop
    if esta_bloqueado(new.alojamiento_id, d) then
      raise exception 'La noche del % no está disponible.', to_char(d, 'DD/MM/YYYY');
    end if;
  end loop;

  return new;
end $$;

drop trigger if exists reserva_no_pisa_bloqueo on reserva;
create trigger reserva_no_pisa_bloqueo
  before insert or update of entrada, salida, alojamiento_id, estado on reserva
  for each row execute function reserva_no_pisa_bloqueo();

-- ============================================================
-- PRUEBAS. Aplicar este fichero ES ejecutarlas.
-- ============================================================
do $$
declare
  el_cliente uuid;
  el_aloj    integer;
  otro_aloj  integer;
  la_reserva uuid;
  r          jsonb;
  salto      boolean;
begin
  select id into el_cliente from cliente limit 1;
  select id into el_aloj   from alojamiento where tipo = 'normal' order by id limit 1;
  select id into otro_aloj from alojamiento where tipo = 'normal' order by id offset 1 limit 1;

  if el_cliente is null or el_aloj is null then
    raise notice 'Sin clientes o alojamientos: los bloqueos se probarán cuando los haya.';
    return;
  end if;

  -- Un bloqueo en UN alojamiento, en fechas lejanas.
  r := bloquear_fechas(array[el_aloj], '2099-06-01', '2099-06-10', 'PRUEBA');
  assert (r->>'puestos')::integer = 1, 'tenía que poner uno';

  assert esta_bloqueado(el_aloj, '2099-06-05'), 'el 5 de junio está cerrado';
  assert not esta_bloqueado(el_aloj, '2099-05-31'), 'el día antes, no';
  assert not esta_bloqueado(el_aloj, '2099-06-11'), 'el día después, tampoco';
  assert not esta_bloqueado(otro_aloj, '2099-06-05'), 'y el otro box sigue libre';

  -- La base no deja reservar encima.
  salto := false;
  begin
    insert into reserva (cliente_id, alojamiento_id, entrada, salida, perros,
                         estado, desglose, total)
         values (el_cliente, el_aloj, '2099-06-04 11:00', '2099-06-06 11:00', 1,
                 'confirmada', '{}'::jsonb, 30);
  exception when others then
    salto := true;
  end;
  assert salto, 'la base TIENE que rechazar una reserva encima de un bloqueo';

  delete from bloqueo where motivo = 'PRUEBA';

  -- Un bloqueo de TODOS, sin alojamiento.
  r := bloquear_fechas(null, '2099-07-01', '2099-07-03', 'PRUEBA TODOS');
  assert esta_bloqueado(el_aloj, '2099-07-02'),   'todos incluye a este';
  assert esta_bloqueado(otro_aloj, '2099-07-02'), 'y a este otro';
  delete from bloqueo where motivo = 'PRUEBA TODOS';

  -- Y no se bloquea lo que ya está reservado.
  insert into reserva (cliente_id, alojamiento_id, entrada, salida, perros,
                       estado, desglose, total)
       values (el_cliente, el_aloj, '2099-08-10 11:00', '2099-08-12 11:00', 1,
               'confirmada', '{}'::jsonb, 30)
    returning id into la_reserva;

  salto := false;
  begin
    r := bloquear_fechas(array[el_aloj], '2099-08-09', '2099-08-15', 'PRUEBA CHOQUE');
  exception when others then
    salto := true;
  end;
  assert salto, 'no se puede bloquear encima de una reserva viva';

  delete from reserva where id = la_reserva;
  delete from bloqueo where motivo like 'PRUEBA%';

  raise notice 'Bloqueos: todas las comprobaciones pasan.';
end $$;
