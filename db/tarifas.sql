-- ============================================================
-- AmigoMío — el motor: alojamientos, festivos, tarifas y extras.
--
-- NINGÚN precio se escribe en el código de la aplicación. Todos
-- viven aquí, en filas que Santiago edita desde su panel: el día
-- que suba la noche a 17 € no puede depender de que alguien le
-- publique una versión nueva de la web.
--
-- Aplicar DESPUÉS de schema.sql: usa la función es_admin().
-- ============================================================

-- ------------------------------------------------------------
-- Alojamientos. Los cuatro tipos salen del diseño §5.5.
-- `aislamiento` y `cachorros` NO son reservables por el cliente
-- —los asigna administración— pero sí cuentan para el tope de
-- perros simultáneos.
-- ------------------------------------------------------------
create table if not exists alojamiento (
  id        serial primary key,
  nombre    text not null unique,
  tipo      text not null check (tipo in ('normal','especial','aislamiento','cachorros')),
  capacidad integer not null default 3 check (capacidad between 1 and 3),
  activo    boolean not null default true,   -- en obras, avería… sin perder su historial
  notas     text not null default ''
);

-- ------------------------------------------------------------
-- Festivos de Puerto Real. HAY QUE CARGARLOS CADA AÑO.
-- Si faltan, el motor cobrará 15 € noches que deberían ser 18 €.
-- ------------------------------------------------------------
create table if not exists festivo (
  fecha  date primary key,
  nombre text not null default '',
  ambito text not null default 'local'
         check (ambito in ('nacional','andalucia','local'))
);

-- ------------------------------------------------------------
-- Tarifas. Una fila por concepto, con su clave.
-- ------------------------------------------------------------
create table if not exists tarifa (
  id      serial primary key,
  clave   text not null unique,
  importe numeric(6,2) not null,
  nota    text not null default ''
);

-- Antes eran dos tarifas sueltas (segundo_perro, tercer_perro).
-- Se unificaron el 12/09/2026 en una sola repetida.
delete from tarifa where clave in ('segundo_perro','tercer_perro');

insert into tarifa (clave, importe, nota) values
  ('base_entre_semana',    15, 'Lunes, martes, miércoles y jueves'),
  ('base_finde',           18, 'Viernes, sábado y domingo'),
  ('base_festivo',         18, 'Festivos en Puerto Real y sus vísperas'),
  ('base_navidad',         25, '24, 25 y 31 de diciembre, y 1 de enero'),
  ('especial_dia',         35, 'Alojamiento especial: tarifa plana, sin recargos'),
  ('perro_adicional',      10, 'Por noche y por cada perro de más en el mismo alojamiento'),
  ('curas_dia',             8, 'Por perro y noche: inyectables o curas. La oral no lleva cargo'),
  ('fuera_horario_semana', 50, 'Entrega o recogida fuera de horario, entre semana'),
  ('fuera_horario_finde',  75, 'Entrega o recogida fuera de horario, sábado o domingo'),
  ('fuera_horario_noche', 120, 'Entre las 21:00 y las 7:30, sea el día que sea'),
  ('minimo_noches',         2, 'Reserva mínima')
on conflict (clave) do nothing;

-- ------------------------------------------------------------
-- Extras. Catálogo editable.
--
-- `lo_cobra` importa de verdad: los servicios de la veterinaria
-- los factura ella según SUS tarifas, y NO pueden entrar en el
-- importe que el cliente transfiere a AmigoMío. Si entrasen,
-- AmigoMío estaría cobrando por cuenta de un tercero.
-- ------------------------------------------------------------
create table if not exists extra (
  id        serial primary key,
  nombre    text not null,
  importe   numeric(6,2) not null default 0,
  por_noche boolean not null default true,
  activo    boolean not null default true,
  en_verano boolean not null default true,
  lo_cobra  text not null default 'amigomio'
            check (lo_cobra in ('amigomio','veterinaria')),
  nota      text not null default ''
);

insert into extra (nombre, importe, por_noche, en_verano, lo_cobra, nota) values
  ('Gimnasio canino (cintas)',        0, true,  true,  'amigomio',    'Precio por definir'),
  ('Alimentación a cargo del hotel',  0, true,  true,  'amigomio',    'Precio por definir'),
  ('Cuidados por ATV',                0, true,  true,  'amigomio',    'Precio por definir'),
  ('Adiestramiento personalizado',    0, true,  false, 'amigomio',    'No disponible en verano'),
  ('Atención veterinaria',            0, false, true,  'veterinaria', 'Lo factura la clínica'),
  ('Vacunación durante la estancia',  0, false, true,  'veterinaria', 'Lo factura la clínica'),
  ('Desparasitación durante la estancia', 0, false, true, 'veterinaria', 'Lo factura la clínica')
/* Sobre `nombre`, y no a secas: `on conflict do nothing` sin
   columna no detecta nada, y cada aplicación del fichero volvía
   a insertar los siete. La marca de unicidad va en
   db/extras-repetidos.sql. */
on conflict (nombre) do nothing;

-- ------------------------------------------------------------
-- Ajustes sueltos.
-- ------------------------------------------------------------
create table if not exists ajuste (
  clave text primary key,
  valor text not null,
  nota  text not null default ''
);

insert into ajuste (clave, valor, nota) values
  ('tope_perros_simultaneos', '',
   'Máximo de perros dentro a la vez, contando todos los alojamientos. VACÍO = no se aplica'),
  ('reservas_abiertas', 'no',
   'Mientras sea "no", solo administración puede crear reservas. Wix sigue mandando'),
  ('iban', '', 'Cuenta donde se transfiere. NO se escribe en el repositorio'),
  ('dias_cancelacion_gratis', '7',
   'Con esta antelación o más, devolución completa. Menos, no se puede cancelar')
on conflict (clave) do nothing;

-- ============================================================
-- Row Level Security.
--
-- Todo el mundo LEE tarifas, festivos, extras y alojamientos:
-- hace falta para enseñarle al cliente lo que va a pagar.
-- ESCRIBIR, solo administración.
--
-- `ajuste` es distinto: lleva el IBAN, así que ni se lee.
-- ============================================================
alter table alojamiento enable row level security;
alter table festivo     enable row level security;
alter table tarifa      enable row level security;
alter table extra       enable row level security;
alter table ajuste      enable row level security;

-- Se escriben una a una a propósito. Generarlas con un bucle y
-- format() ahorra líneas, pero deja el fichero que decide quién ve
-- qué convertido en algo que hay que ejecutar para saber qué hace.

drop policy if exists alojamiento_lo_lee_cualquiera on alojamiento;
create policy alojamiento_lo_lee_cualquiera on alojamiento for select using (true);
drop policy if exists alojamiento_lo_cambia_admin on alojamiento;
create policy alojamiento_lo_cambia_admin on alojamiento
  for all using (es_admin()) with check (es_admin());

drop policy if exists festivo_lo_lee_cualquiera on festivo;
create policy festivo_lo_lee_cualquiera on festivo for select using (true);
drop policy if exists festivo_lo_cambia_admin on festivo;
create policy festivo_lo_cambia_admin on festivo
  for all using (es_admin()) with check (es_admin());

drop policy if exists tarifa_lo_lee_cualquiera on tarifa;
create policy tarifa_lo_lee_cualquiera on tarifa for select using (true);
drop policy if exists tarifa_lo_cambia_admin on tarifa;
create policy tarifa_lo_cambia_admin on tarifa
  for all using (es_admin()) with check (es_admin());

drop policy if exists extra_lo_lee_cualquiera on extra;
create policy extra_lo_lee_cualquiera on extra for select using (true);
drop policy if exists extra_lo_cambia_admin on extra;
create policy extra_lo_cambia_admin on extra
  for all using (es_admin()) with check (es_admin());

-- El IBAN vive aquí: solo administración lo ve.
drop policy if exists ajuste_solo_admin on ajuste;
create policy ajuste_solo_admin on ajuste
  for all using (es_admin()) with check (es_admin());

-- Lo que el cliente sí necesita saber de los ajustes, sin ver el IBAN.
create or replace function ajuste_publico(la_clave text)
returns text language sql stable security definer
set search_path = public as $$
  select valor from ajuste
   where clave = la_clave
     and clave in ('reservas_abiertas','dias_cancelacion_gratis','tope_perros_simultaneos');
$$;

-- ============================================================
-- EL PRECIO DE UNA NOCHE
--
-- La escalera del diseño §6.1. Gana la PRIMERA regla que encaje:
--
--   1. ¿24, 25 o 31 de diciembre, o 1 de enero?  -> base_navidad
--   2. ¿festivo en Puerto Real, o su víspera?    -> base_festivo
--   3. ¿viernes, sábado o domingo?               -> base_finde
--   4. cualquier otra                            -> base_entre_semana
--
-- El alojamiento especial no entra en la escalera: es una tarifa
-- plana, sin recargo de fin de semana ni de festivo.
--
-- "Víspera" es la noche anterior al día festivo.
-- ============================================================
create or replace function precio_noche(la_fecha date, el_tipo text default 'normal')
returns numeric language plpgsql stable
set search_path = public as $$
declare
  importe numeric;
begin
  if el_tipo = 'especial' then
    select t.importe into importe from tarifa t where t.clave = 'especial_dia';
    return importe;
  end if;

  -- 1. Las cuatro noches de Navidad
  if (extract(month from la_fecha), extract(day from la_fecha))
     in ((12,24),(12,25),(12,31),(1,1)) then
    select t.importe into importe from tarifa t where t.clave = 'base_navidad';
    return importe;
  end if;

  -- 2. Festivo, o víspera de festivo
  if exists (select 1 from festivo f
              where f.fecha = la_fecha or f.fecha = la_fecha + 1) then
    select t.importe into importe from tarifa t where t.clave = 'base_festivo';
    return importe;
  end if;

  -- 3. Viernes (5), sábado (6) o domingo (0)
  if extract(dow from la_fecha) in (0, 5, 6) then
    select t.importe into importe from tarifa t where t.clave = 'base_finde';
    return importe;
  end if;

  -- 4. El resto
  select t.importe into importe from tarifa t where t.clave = 'base_entre_semana';
  return importe;
end $$;

-- ============================================================
-- PRUEBAS DEL PRECIO DE LA NOCHE.
--
-- Esto no es adorno: si un cálculo sale mal, la instalación
-- ABORTA y este fichero no se aplica. Pegarlo en Supabase es
-- ejecutar las pruebas contra Postgres de verdad.
-- ============================================================
do $$
declare
  habia_festivo boolean;
begin
  -- Días corrientes de agosto de 2026
  assert precio_noche('2026-08-10','normal') = 15, 'un lunes deberían ser 15';
  assert precio_noche('2026-08-11','normal') = 15, 'un martes deberían ser 15';
  assert precio_noche('2026-08-13','normal') = 15, 'un jueves deberían ser 15';

  -- Viernes, sábado y domingo
  assert precio_noche('2026-08-07','normal') = 18, 'un viernes deberían ser 18';
  assert precio_noche('2026-08-08','normal') = 18, 'un sábado deberían ser 18';
  assert precio_noche('2026-08-09','normal') = 18, 'un domingo deberían ser 18';

  -- Las cuatro de Navidad, aunque caigan entre semana
  assert precio_noche('2026-12-24','normal') = 25, 'Nochebuena son 25';
  assert precio_noche('2026-12-25','normal') = 25, 'Navidad son 25';
  assert precio_noche('2026-12-31','normal') = 25, 'Nochevieja son 25';
  assert precio_noche('2027-01-01','normal') = 25, 'Año Nuevo son 25';

  -- El alojamiento especial es plano: ni finde ni Navidad lo mueven
  assert precio_noche('2026-08-11','especial') = 35, 'el especial son 35 un martes';
  assert precio_noche('2026-08-08','especial') = 35, 'el especial son 35 un sábado';
  assert precio_noche('2026-12-25','especial') = 35, 'el especial no sube en Navidad';

  -- Festivos y vísperas, con una fila de prueba que se borra al salir.
  -- Se usa un miércoles cualquiera para que no lo tape la regla del finde.
  select exists(select 1 from festivo where fecha = '2026-10-14') into habia_festivo;
  insert into festivo (fecha, nombre, ambito)
       values ('2026-10-14','PRUEBA','local') on conflict (fecha) do nothing;

  assert precio_noche('2026-10-14','normal') = 18, 'un festivo son 18';
  assert precio_noche('2026-10-13','normal') = 18, 'la víspera de un festivo son 18';
  assert precio_noche('2026-10-12','normal') = 15, 'dos días antes ya no es víspera';

  if not habia_festivo then delete from festivo where fecha = '2026-10-14'; end if;

  raise notice 'Precios: las 19 comprobaciones pasan.';
end $$;

-- ============================================================
-- RECARGO POR ENTREGA O RECOGIDA FUERA DE HORARIO
--
-- Horario de AmigoMío:
--   Lunes a viernes y domingos: 10:00-12:30 y 16:30-19:00
--   Sábados:                    10:00-12:30
--
-- Fuera de eso, previa consulta, y se cobra POR CADA MOVIMIENTO:
-- una entrada y una salida fuera de horario son dos recargos.
--
--   Entre las 21:00 y las 7:30 -> 120, SEA EL DÍA QUE SEA
--   Sábado o domingo           ->  75
--   Resto                      ->  50
--
-- Gana siempre la regla más específica: un sábado a las 22:00
-- son 120, no 75.
-- ============================================================
create or replace function recargo_horario(momento timestamp)
returns numeric language plpgsql stable
set search_path = public as $$
declare
  h    time    := momento::time;
  dia  integer := extract(dow from momento);   -- 0 domingo, 6 sábado
  dentro boolean;
  importe numeric;
begin
  if momento is null then return 0; end if;

  if dia = 6 then                              -- sábado: solo mañanas
    dentro := h >= '10:00' and h <= '12:30';
  else                                         -- resto, domingo incluido
    dentro := (h >= '10:00' and h <= '12:30')
           or (h >= '16:30' and h <= '19:00');
  end if;

  if dentro then return 0; end if;

  if h >= '21:00' or h < '07:30' then
    select t.importe into importe from tarifa t where t.clave = 'fuera_horario_noche';
  elsif dia in (0, 6) then
    select t.importe into importe from tarifa t where t.clave = 'fuera_horario_finde';
  else
    select t.importe into importe from tarifa t where t.clave = 'fuera_horario_semana';
  end if;

  return importe;
end $$;

-- ============================================================
-- EL PRESUPUESTO COMPLETO
--
-- Devuelve el desglose línea a línea: es lo que ve el cliente
-- antes de confirmar y lo que se congela dentro de la reserva.
--
-- Lo que cobra la veterinaria va APARTE, nunca en el total: si
-- entrara, AmigoMío estaría cobrando por cuenta de un tercero.
-- ============================================================
create or replace function presupuesto(
  la_entrada    timestamp,
  la_salida     timestamp,
  el_tipo       text    default 'normal',
  los_perros    integer default 1,
  con_curas     integer default 0,
  los_extras    integer[] default '{}'
) returns jsonb language plpgsql stable
set search_path = public as $$
declare
  noches   integer;
  minimo   integer;
  base     numeric := 0;
  d        date;
  lineas   jsonb := '[]'::jsonb;
  aparte   jsonb := '[]'::jsonb;
  total    numeric := 0;
  importe  numeric;
  ex       record;
  r        numeric;
begin
  noches := (la_salida::date - la_entrada::date);

  select t.importe::integer into minimo from tarifa t where t.clave = 'minimo_noches';
  if noches < minimo then
    raise exception 'La reserva mínima son % noches.', minimo;
  end if;

  if los_perros < 1 or los_perros > 3 then
    raise exception 'En un alojamiento caben de 1 a 3 perros.';
  end if;

  if el_tipo = 'especial' and los_perros > 1 then
    raise exception 'Un perro agresivo con personas va siempre solo.';
  end if;

  if con_curas > los_perros then
    raise exception 'No puede haber más perros con curas que perros.';
  end if;

  -- Base: noche a noche, desde la entrada hasta la víspera de la salida
  for d in select generate_series(la_entrada::date, la_salida::date - 1, '1 day')::date loop
    base := base + precio_noche(d, el_tipo);
  end loop;
  lineas := lineas || jsonb_build_object(
    'concepto', noches || ' noche' || case when noches = 1 then '' else 's' end,
    'importe', base);
  total := total + base;

  -- Perros de más: 10 € por noche POR CADA UNO a partir del primero.
  -- Dos perros suman 10, tres suman 20. No son dos tarifas
  -- distintas: es la misma repetida, y así cambiarla es cambiar
  -- un solo número.
  if los_perros >= 2 then
    select t.importe into importe from tarifa t where t.clave = 'perro_adicional';
    lineas := lineas || jsonb_build_object(
      'concepto', case when los_perros = 2 then 'Segundo perro'
                       else 'Segundo y tercer perro' end,
      'importe', importe * (los_perros - 1) * noches);
    total := total + importe * (los_perros - 1) * noches;
  end if;

  -- Curas o inyectables. La medicación oral no lleva cargo.
  if con_curas > 0 then
    select t.importe into importe from tarifa t where t.clave = 'curas_dia';
    lineas := lineas || jsonb_build_object(
      'concepto', 'Curas o inyectables' ||
                  case when con_curas > 1 then ' (' || con_curas || ' perros)' else '' end,
      'importe', importe * con_curas * noches);
    total := total + importe * con_curas * noches;
  end if;

  -- Extras. Los de la veterinaria van aparte, fuera del total.
  for ex in select * from extra where id = any(los_extras) and activo loop
    importe := case when ex.por_noche then ex.importe * noches else ex.importe end;
    if ex.lo_cobra = 'veterinaria' then
      aparte := aparte || jsonb_build_object(
        'concepto', ex.nombre, 'importe', importe,
        'nota', 'Lo factura la clínica, no AmigoMío');
    else
      lineas := lineas || jsonb_build_object('concepto', ex.nombre, 'importe', importe);
      total := total + importe;
    end if;
  end loop;

  -- Fuera de horario: se cobra por cada movimiento
  r := recargo_horario(la_entrada);
  if r > 0 then
    lineas := lineas || jsonb_build_object('concepto', 'Entrega fuera de horario', 'importe', r);
    total := total + r;
  end if;

  r := recargo_horario(la_salida);
  if r > 0 then
    lineas := lineas || jsonb_build_object('concepto', 'Recogida fuera de horario', 'importe', r);
    total := total + r;
  end if;

  return jsonb_build_object(
    'noches', noches,
    'lineas', lineas,
    'total', total,
    'aparte', aparte);
end $$;

-- ============================================================
-- PRUEBAS DEL PRESUPUESTO.
-- Si algo no cuadra, la instalación ABORTA.
-- ============================================================
do $$
declare p jsonb; fallo text;
begin
  -- Horarios: dentro de horario no se cobra recargo
  assert recargo_horario('2026-08-11 11:00') = 0,  'un martes a las 11:00 está dentro';
  assert recargo_horario('2026-08-11 17:30') = 0,  'un martes a las 17:30 está dentro';
  assert recargo_horario('2026-08-08 11:00') = 0,  'un sábado a las 11:00 está dentro';

  -- Sábado por la tarde: fuera de horario, y es finde
  assert recargo_horario('2026-08-08 17:30') = 75, 'el sábado por la tarde no se abre: 75';
  -- Domingo por la tarde SÍ está dentro
  assert recargo_horario('2026-08-09 17:30') = 0,  'los domingos por la tarde sí se abre';
  -- Entre semana fuera de horario
  assert recargo_horario('2026-08-11 20:00') = 50, 'un martes a las 20:00 son 50';
  -- La franja nocturna gana al día de la semana
  assert recargo_horario('2026-08-08 22:00') = 120,'un sábado a las 22:00 son 120, no 75';
  assert recargo_horario('2026-08-11 06:00') = 120,'un martes a las 6:00 son 120';

  -- EL EJEMPLO DEL DISEÑO §6.7
  -- Viernes 7 a martes 11 de agosto, 2 perros en el mismo alojamiento,
  -- uno con curas, recogida el martes a las 20:00. Total esperado: 191 €
  p := presupuesto('2026-08-07 11:00', '2026-08-11 20:00', 'normal', 2, 1);
  assert (p->>'noches')::int = 4, 'del 7 al 11 son 4 noches';
  assert (p->>'total')::numeric = 191,
         'el ejemplo del diseño tiene que dar 191, dio ' || (p->>'total');

  -- Una sola noche no se admite
  begin
    p := presupuesto('2026-08-07 11:00', '2026-08-08 11:00', 'normal', 1, 0);
    assert false, 'una sola noche tendría que dar error';
  exception
    when assert_failure then raise;
    when others then null;   -- bien: lo rechazó
  end;

  -- Un perro en alojamiento especial no puede ir acompañado
  begin
    p := presupuesto('2026-08-07 11:00', '2026-08-11 11:00', 'especial', 2, 0);
    assert false, 'el especial no admite dos perros';
  exception
    when assert_failure then raise;
    when others then null;
  end;

  -- Estancia sencilla: sábado a lunes, un perro, dentro de horario
  -- 18 (sáb) + 18 (dom) = 36
  p := presupuesto('2026-08-08 11:00', '2026-08-10 11:00', 'normal', 1, 0);
  assert (p->>'total')::numeric = 36, 'sábado y domingo son 36, dio ' || (p->>'total');

  -- Perros de más: 10 por cada uno a partir del primero, por noche
  p := presupuesto('2026-08-10 11:00', '2026-08-12 11:00', 'normal', 1, 0);
  assert (p->>'total')::numeric = 30, 'dos noches con un perro son 30, dio ' || (p->>'total');

  p := presupuesto('2026-08-10 11:00', '2026-08-12 11:00', 'normal', 2, 0);
  assert (p->>'total')::numeric = 30 + 10 * 2,
         'con dos perros son 50, dio ' || (p->>'total');

  p := presupuesto('2026-08-10 11:00', '2026-08-12 11:00', 'normal', 3, 0);
  assert (p->>'total')::numeric = 30 + 10 * 2 * 2,
         'con tres perros son 70: 10 por cada perro de más, dio ' || (p->>'total');

  -- Especial: 35 planos por noche, sin recargos
  p := presupuesto('2026-08-07 11:00', '2026-08-09 11:00', 'especial', 1, 0);
  assert (p->>'total')::numeric = 70, 'dos noches en especial son 70, dio ' || (p->>'total');

  -- Lo que cobra la veterinaria NO entra en el total
  p := presupuesto('2026-08-10 11:00', '2026-08-12 11:00', 'normal', 1, 0,
                   array(select id from extra where lo_cobra = 'veterinaria' limit 1));
  assert (p->>'total')::numeric = 30,
         'lo de la clínica no puede sumar al total, dio ' || (p->>'total');
  assert jsonb_array_length(p->'aparte') = 1, 'pero sí tiene que aparecer aparte';

  raise notice 'Presupuesto: todas las comprobaciones pasan.';
end $$;
