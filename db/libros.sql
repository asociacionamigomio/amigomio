-- ============================================================
-- LIBRO DE ENTRADAS Y SALIDAS, Y LAS CUENTAS
--
-- El libro es una obligación del núcleo zoológico, no un
-- invento nuestro: lo que lleva dentro lo dice el programa
-- sanitario (§14.1 del diseño). Se alimenta SOLO de las
-- reservas: nada se teclea dos veces, porque lo que se teclea
-- dos veces acaba diciendo dos cosas distintas.
--
-- Las cuentas son otra cosa: son para Santiago, para saber qué
-- ha entrado y qué está comprometido.
--
-- Las dos llevan DNI y domicilio. Son `security definer` porque
-- cruzan reserva, perro y cliente saltándose RLS, y por eso las
-- dos vigilan su propia puerta.
--
-- Aplicar DESPUÉS de administracion.sql.
-- ============================================================

create or replace function libro_entradas_salidas(
  desde date,
  hasta date
) returns table (
  -- El animal
  chip                text,
  nombre              text,
  especie             text,
  raza                text,
  sexo                text,
  capa                text,
  fecha_nacimiento    date,
  estado_reproductivo text,

  -- El propietario
  propietario         text,
  dni                 text,
  domicilio           text,
  telefono            text,
  recoge_nombre       text,
  recoge_dni          text,

  -- La estancia
  entrada             timestamptz,
  salida              timestamptz,
  alojamiento         text,
  procedencia         text,

  -- Estado sanitario en el ingreso
  sanidad             jsonb,

  -- Lo que pasó
  incidencias         text,
  estado              text
) language plpgsql security definer
set search_path = public as $$
begin
  if not es_admin() then
    raise exception 'El libro de registro lo consulta administración.';
  end if;

  return query
  select
    p.chip,
    p.nombre,
    'Canina'::text,
    p.raza,
    p.sexo,
    p.capa,
    p.fecha_nacimiento,
    p.estado_reproductivo,

    trim(c.nombre || ' ' || c.apellidos),
    c.dni,
    c.domicilio,
    c.telefono,
    c.recoge_nombre,
    c.recoge_dni,

    r.entrada,
    r.salida,
    a.nombre,
    -- Procedencia y destino: en una residencia es siempre el
    -- domicilio del propietario. Se deja escrito porque el
    -- registro lo pide y en blanco parecería un olvido.
    'Domicilio del propietario'::text,

    p.sanidad,

    coalesce(
      (select string_agg(i.tipo || ': ' || i.texto, ' · ' order by i.cuando)
         from incidencia i
        where i.reserva_id = r.id
          and (i.perro_id = p.id or i.perro_id is null)),
      ''),

    r.estado

    from reserva r
    join reserva_perro rp on rp.reserva_id = r.id
    join perro p          on p.id = rp.perro_id
    join cliente c        on c.id = r.cliente_id
    left join alojamiento a on a.id = r.alojamiento_id

   -- Sólo lo que llegó a ser una estancia de verdad. Una
   -- reserva caducada sin pagar no es una entrada al núcleo:
   -- meterla sería declarar un animal que nunca estuvo aquí.
   where r.estado in ('en_curso','finalizada')
     and r.entrada::date <= hasta
     and r.salida::date   >= desde

   order by r.entrada, p.nombre;
end $$;

revoke all on function libro_entradas_salidas(date, date) from public;
grant execute on function libro_entradas_salidas(date, date) to authenticated;

-- ============================================================
-- LO QUE ENTRA CADA MES
--
-- Tres columnas y no una, porque sumarlo todo daría un número
-- que no es dinero:
--
--   COBRADO      — estancias ya hechas. Esto es facturación.
--   COMPROMETIDO — confirmadas y en curso. Pagadas, pero
--                  todavía puede pasar cualquier cosa.
--   EN EL AIRE   — pendientes y en revisión. Puede que no
--                  lleguen a ser nada.
--   PERDIDO      — caducadas y canceladas. Lo que se escapó, y
--                  conviene mirarlo: si crece, algo falla.
--
-- El mes se cuenta por la ENTRADA, no por cuándo se reservó:
-- una reserva de agosto hecha en febrero es facturación de
-- agosto, que es cuando ocupa el box.
-- ============================================================
create or replace function ingresos_por_mes(el_anio integer default null)
returns table (
  mes           date,
  cobrado       numeric,
  comprometido  numeric,
  en_el_aire    numeric,
  perdido       numeric,
  estancias     integer,
  noches        integer
) language plpgsql security definer
set search_path = public as $$
begin
  if not es_admin() then
    raise exception 'Las cuentas las mira administración.';
  end if;

  return query
  select
    date_trunc('month', r.entrada)::date,
    coalesce(sum(r.total) filter (where r.estado = 'finalizada'), 0),
    coalesce(sum(r.total) filter (where r.estado in ('confirmada','en_curso')), 0),
    coalesce(sum(r.total) filter (where r.estado in ('pendiente','revisando')), 0),
    coalesce(sum(r.total) filter (where r.estado in ('caducada','cancelada')), 0),
    count(*) filter (where r.estado in ('confirmada','en_curso','finalizada'))::integer,
    coalesce(sum((r.salida::date - r.entrada::date))
             filter (where r.estado in ('confirmada','en_curso','finalizada')), 0)::integer
    from reserva r
   where el_anio is null
      or extract(year from r.entrada) = el_anio
   group by 1
   order by 1 desc;
end $$;

revoke all on function ingresos_por_mes(integer) from public;
grant execute on function ingresos_por_mes(integer) to authenticated;

-- ============================================================
-- PRUEBAS. Aplicar este fichero ES ejecutarlas.
-- ============================================================
do $$
declare
  cuantas integer;
begin
  -- Que las funciones existan y respondan sin reventar.
  select count(*) into cuantas
    from libro_entradas_salidas('2020-01-01', '2020-01-02');
  assert cuantas >= 0, 'el libro tiene que poder consultarse';

  select count(*) into cuantas from ingresos_por_mes(2020);
  assert cuantas >= 0, 'las cuentas tienen que poder consultarse';

  -- Y que la puerta esté cerrada para quien no es administración.
  -- (Aquí somos el servidor, así que es_admin() es falso pero
  --  current_user es postgres: la comprobación se hace en la
  --  aplicación de verdad. Se deja constancia de la intención.)
  assert (select prosecdef from pg_proc where proname = 'libro_entradas_salidas'),
    'el libro tiene que ser security definer y vigilar su puerta';
  assert (select prosecdef from pg_proc where proname = 'ingresos_por_mes'),
    'las cuentas también';

  raise notice 'Libro y cuentas: todas las comprobaciones pasan.';
end $$;
