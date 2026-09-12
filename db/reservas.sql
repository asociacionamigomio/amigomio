-- ============================================================
-- AmigoMío — reservas y disponibilidad.
--
-- Las pantallas son de la fase 2. Esto es el esqueleto y, sobre
-- todo, LA PROTECCIÓN: la restricción que impide físicamente
-- vender dos veces las mismas noches en el mismo alojamiento.
--
-- Aplicar DESPUÉS de schema.sql y tarifas.sql.
-- ============================================================

-- Hace falta para poder mezclar un entero y un rango de fechas
-- en la misma restricción de exclusión.
create extension if not exists btree_gist;

create table if not exists reserva (
  id             uuid primary key default gen_random_uuid(),
  cliente_id     uuid not null references cliente(id) on delete cascade,
  alojamiento_id integer not null references alojamiento(id),

  entrada        timestamp not null,
  salida         timestamp not null,
  perros         integer not null default 1 check (perros between 1 and 3),
  con_curas      integer not null default 0,

  estado         text not null default 'pendiente'
                 -- `revisando`: el cliente ya mandó el justificante y
                 -- administración todavía no lo ha mirado. Ni pendiente
                 -- —el reloj ya no corre— ni confirmada —el dinero no
                 -- se ha visto en la cuenta.
                 check (estado in ('pendiente','revisando','confirmada','en_curso',
                                   'finalizada','cancelada','caducada')),

  -- El precio se CONGELA al crear la reserva. Una subida de
  -- tarifas no reescribe lo ya pactado.
  desglose       jsonb not null default '{}'::jsonb,
  total          numeric(8,2) not null default 0,

  justificante   text,
  creada_por     text not null default 'cliente'
                 check (creada_por in ('cliente','administracion','zapatilla')),
  notas          text not null default '',
  creada         timestamptz not null default now(),

  constraint salida_despues_de_entrada check (salida > entrada)
);

-- OJO: `create table if not exists` NO toca una tabla que ya
-- existe. Ni columnas, ni índices, NI RESTRICCIONES. El check de
-- `estado` de arriba sólo se aplica a una base recién creada; en
-- la que ya estaba funcionando seguía el check viejo, sin
-- `revisando`, y subir un justificante reventaba con
--
--   23514: new row for relation "reserva" violates check
--          constraint "reserva_estado_check"
--
-- Así que se rehace siempre, a mano.
alter table reserva drop constraint if exists reserva_estado_check;
alter table reserva add constraint reserva_estado_check
  check (estado in ('pendiente','revisando','confirmada','en_curso',
                    'finalizada','cancelada','caducada'));

create index if not exists reserva_por_fechas on reserva (entrada, salida);
create index if not exists reserva_del_cliente on reserva (cliente_id);

-- Qué perros van en cada reserva, con lo que cambia de un viaje
-- a otro: el peso y el celo (diseño §5.4).
create table if not exists reserva_perro (
  reserva_id uuid not null references reserva(id) on delete cascade,
  perro_id   uuid not null references perro(id),
  peso       numeric(5,2),
  en_celo    boolean not null default false,
  se_le_espera_celo boolean not null default false,
  cuidados_esta_vez text not null default '',
  primary key (reserva_id, perro_id)
);

-- ============================================================
-- LA PROTECCIÓN CONTRA DOBLES RESERVAS
--
-- Esto no es una comprobación que se pueda esquivar: es una
-- regla del motor. Dos clientes pulsando a la vez para el último
-- alojamiento de Nochevieja: uno entra y el otro recibe un no.
--
-- El rango es '[)': la salida de uno y la entrada de otro el
-- mismo día NO se solapan, porque el perro se va por la mañana.
-- ============================================================
alter table reserva drop constraint if exists sin_solapes;
alter table reserva add constraint sin_solapes
  exclude using gist (
    alojamiento_id with =,
    daterange(entrada::date, salida::date, '[)') with &&
  ) where (estado in ('pendiente','revisando','confirmada','en_curso'));

-- ============================================================
-- ¿Cuántos perros hay dentro esa noche?
-- Cuenta TODOS los alojamientos, incluidos aislamiento y
-- cachorros.
-- ============================================================
create or replace function perros_dentro(la_noche date)
returns integer language sql stable
set search_path = public as $$
  select coalesce(sum(r.perros), 0)::integer
    from reserva r
   where r.estado in ('pendiente','revisando','confirmada','en_curso')
     and la_noche >= r.entrada::date
     and la_noche <  r.salida::date;
$$;

-- ============================================================
-- ¿HAY SITIO?
--
-- Comprueba DOS cosas, y las dos tienen que dar verde:
--   1. que quede alojamiento libre del tipo que toca, todas
--      las noches de la estancia;
--   2. que no se pase el tope de perros simultáneos.
--
-- El segundo no es redundante: con hasta 3 perros por
-- alojamiento, 30 boxes darían cabida a 90 perros. Sin este
-- control el sistema vendería una infracción administrativa.
--
-- Si el tope está vacío en `ajuste`, no se aplica.
-- ============================================================
create or replace function hay_sitio(
  la_entrada timestamp,
  la_salida  timestamp,
  el_tipo    text    default 'normal',
  los_perros integer default 1
) returns jsonb language plpgsql stable
set search_path = public as $$
declare
  minimo integer;
  tope   integer;
  d      date;
  libres integer;
  dentro integer;
  sugerido integer;
begin
  select t.importe::integer into minimo from tarifa t where t.clave = 'minimo_noches';
  if (la_salida::date - la_entrada::date) < minimo then
    return jsonb_build_object('hay', false,
      'motivo', 'La reserva mínima son ' || minimo || ' noches.');
  end if;

  if el_tipo = 'especial' and los_perros > 1 then
    return jsonb_build_object('hay', false,
      'motivo', 'Un perro que necesita alojamiento propio va siempre solo.');
  end if;

  select nullif(a.valor, '')::integer into tope
    from ajuste a where a.clave = 'tope_perros_simultaneos';

  for d in select generate_series(la_entrada::date, la_salida::date - 1, '1 day')::date loop

    -- 1. ¿Queda alojamiento del tipo que toca esa noche?
    select count(*) into libres
      from alojamiento al
     where al.tipo = el_tipo and al.activo
       and al.capacidad >= los_perros
       and not exists (
             select 1 from reserva r
              where r.alojamiento_id = al.id
                and r.estado in ('pendiente','revisando','confirmada','en_curso')
                and d >= r.entrada::date and d < r.salida::date);

    if libres = 0 then
      return jsonb_build_object('hay', false,
        'motivo', 'No queda alojamiento libre para la noche del ' ||
                  to_char(d, 'DD/MM/YYYY') || '.');
    end if;

    -- 2. ¿Se respeta el tope de perros a la vez?
    if tope is not null then
      dentro := perros_dentro(d);
      if dentro + los_perros > tope then
        return jsonb_build_object('hay', false,
          'motivo', 'Esa noche ya está completo: ' || to_char(d, 'DD/MM/YYYY') || '.');
      end if;
    end if;
  end loop;

  -- El primero libre del tipo, para atarlo internamente. El
  -- cliente no lo elige ni lo ve; administración lo recoloca
  -- después con total libertad.
  select al.id into sugerido
    from alojamiento al
   where al.tipo = el_tipo and al.activo and al.capacidad >= los_perros
     and not exists (
           select 1 from reserva r
            where r.alojamiento_id = al.id
              and r.estado in ('pendiente','revisando','confirmada','en_curso')
              and daterange(r.entrada::date, r.salida::date, '[)')
                  && daterange(la_entrada::date, la_salida::date, '[)'))
   order by al.id limit 1;

  return jsonb_build_object('hay', true, 'motivo', '', 'alojamiento', sugerido);
end $$;

-- ============================================================
-- RLS
-- ============================================================
alter table reserva       enable row level security;
alter table reserva_perro enable row level security;

drop policy if exists reserva_ve_las_suyas on reserva;
create policy reserva_ve_las_suyas on reserva
  for select using (cliente_id = auth.uid() or es_admin());

drop policy if exists reserva_la_crea_el_dueno on reserva;
create policy reserva_la_crea_el_dueno on reserva
  for insert with check (cliente_id = auth.uid() or es_admin());

drop policy if exists reserva_la_cambia_el_dueno on reserva;
create policy reserva_la_cambia_el_dueno on reserva
  for update using (cliente_id = auth.uid() or es_admin());

drop policy if exists reserva_perro_ve_los_suyos on reserva_perro;
create policy reserva_perro_ve_los_suyos on reserva_perro
  for select using (exists (select 1 from reserva r
                             where r.id = reserva_id
                               and (r.cliente_id = auth.uid() or es_admin())));

drop policy if exists reserva_perro_los_pone_el_dueno on reserva_perro;
create policy reserva_perro_los_pone_el_dueno on reserva_perro
  for all using (exists (select 1 from reserva r
                          where r.id = reserva_id
                            and (r.cliente_id = auth.uid() or es_admin())))
      with check (exists (select 1 from reserva r
                           where r.id = reserva_id
                             and (r.cliente_id = auth.uid() or es_admin())));

-- ============================================================
-- PRUEBAS DE DISPONIBILIDAD.
--
-- Necesitan datos, así que se crea una reserva de mentira, se
-- comprueba el motor y se borra. Si algo falla, la instalación
-- ABORTA y este fichero no se aplica.
--
-- Si todavía no hay ningún cliente dado de alta, las pruebas que
-- necesitan uno se saltan y se avisa.
-- ============================================================
do $$
declare
  algun_cliente uuid;
  box1 integer;
  box2 integer;
  r jsonb;
  reserva_prueba uuid;
  n_normales integer;
  fallo boolean;
begin
  -- ---- Lo que se puede comprobar sin datos ----
  r := hay_sitio('2026-08-07 11:00','2026-08-08 11:00','normal',1);
  assert (r->>'hay')::boolean = false, 'una sola noche no debería caber';
  assert r->>'motivo' like '%mínima%', 'y tiene que decir por qué';

  r := hay_sitio('2026-08-07 11:00','2026-08-11 11:00','especial',2);
  assert (r->>'hay')::boolean = false, 'el especial no admite dos perros';

  r := hay_sitio('2026-08-07 11:00','2026-08-11 11:00','normal',1);
  assert (r->>'hay')::boolean = true, 'con la casa vacía tiene que haber sitio';
  assert (r->>'alojamiento') is not null, 'y tiene que proponer un alojamiento';

  select id into box1 from alojamiento where tipo = 'normal' order by id limit 1;
  assert (r->>'alojamiento')::integer = box1, 'debería proponer el primero libre';

  -- ---- Lo que necesita un cliente de verdad ----
  select id into algun_cliente from cliente limit 1;
  if algun_cliente is null then
    raise notice 'Disponibilidad: sin clientes todavía, se saltan las pruebas de solape.';
    return;
  end if;

  insert into reserva (cliente_id, alojamiento_id, entrada, salida, perros, estado)
       values (algun_cliente, box1, '2026-08-07 11:00', '2026-08-11 11:00', 3, 'confirmada')
    returning id into reserva_prueba;

  -- Ese alojamiento ya no se propone
  r := hay_sitio('2026-08-08 11:00','2026-08-10 11:00','normal',1);
  assert (r->>'alojamiento')::integer <> box1, 'el box ocupado no puede proponerse';

  -- La restricción de solape rechaza pisarlo, aunque se intente a mano
  fallo := false;
  begin
    insert into reserva (cliente_id, alojamiento_id, entrada, salida, perros, estado)
         values (algun_cliente, box1, '2026-08-09 11:00', '2026-08-12 11:00', 1, 'confirmada');
  exception when exclusion_violation then fallo := true;
  end;
  assert fallo, 'la base de datos TIENE que rechazar dos reservas solapadas en el mismo box';

  -- Encadenar sí vale: uno sale el 11 y otro entra el 11
  insert into reserva (cliente_id, alojamiento_id, entrada, salida, perros, estado)
       values (algun_cliente, box1, '2026-08-11 11:00', '2026-08-14 11:00', 1, 'confirmada');
  delete from reserva where alojamiento_id = box1 and entrada = '2026-08-11 11:00';

  -- Los perros dentro se cuentan bien
  assert perros_dentro('2026-08-08') = 3, 'esa noche hay 3 perros dentro';
  assert perros_dentro('2026-08-11') = 0, 'el día que se van ya no cuentan';

  -- El tope de perros simultáneos, si está puesto
  begin
    update ajuste set valor = '3' where clave = 'tope_perros_simultaneos';
    r := hay_sitio('2026-08-08 11:00','2026-08-10 11:00','normal',1);
    assert (r->>'hay')::boolean = false,
           'con el tope en 3 y 3 perros dentro, no debería caber ni uno más';
    assert r->>'motivo' like '%completo%', 'y tiene que decirlo en cristiano';
  end;

  -- Dejarlo como estaba
  update ajuste set valor = '90' where clave = 'tope_perros_simultaneos';
  delete from reserva where id = reserva_prueba;

  raise notice 'Disponibilidad: todas las comprobaciones pasan.';
end $$;
