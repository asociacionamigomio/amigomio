-- ============================================================
-- Lo que necesitan las pantallas de administración:
-- el cuadrante de la semana, la hoja del día y la ficha de la
-- estancia.
--
-- Aplicar DESPUÉS de crear-reserva.sql.
-- ============================================================

-- ------------------------------------------------------------
-- El diario de la estancia.
--
-- Esto es el germen del parte diario que exige el programa
-- sanitario: observación mínima dos veces al día anotando
-- ingesta, agua, heces, actitud y movilidad. De momento es texto
-- libre con su tipo; el libro formal llega en la fase 4.
-- ------------------------------------------------------------
create table if not exists incidencia (
  id         uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references reserva(id) on delete cascade,
  perro_id   uuid references perro(id),
  tipo       text not null default 'nota'
             check (tipo in ('nota','entrada','salida','salud','comida','paseo','rotura')),
  texto      text not null,
  la_puso    uuid references cliente(id),
  cuando     timestamptz not null default now()
);

create index if not exists incidencias_de_la_reserva on incidencia (reserva_id, cuando desc);

alter table incidencia enable row level security;

-- El dueño LEE lo que se anota de su perro: es su derecho y le
-- ahorra llamar para preguntar qué tal está.
drop policy if exists incidencia_la_lee_el_dueno on incidencia;
create policy incidencia_la_lee_el_dueno on incidencia
  for select using (
    es_admin() or exists (select 1 from reserva r
                           where r.id = reserva_id and r.cliente_id = auth.uid()));

-- Pero solo administración anota.
drop policy if exists incidencia_la_pone_admin on incidencia;
create policy incidencia_la_pone_admin on incidencia
  for all using (es_admin()) with check (es_admin());

-- ============================================================
-- EL CUADRANTE: qué hay en cada alojamiento, día a día.
-- Una fila por reserva viva que toque el rango pedido.
-- ============================================================
drop function if exists cuadro(date, date);
create or replace function cuadrante(desde date, hasta date)
returns jsonb language sql stable
set search_path = public as $$
  select jsonb_build_object(
    'alojamientos', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', a.id, 'nombre', a.nombre, 'tipo', a.tipo,
               'activo', a.activo)
               /* En el orden en que se usan, no por alfabeto: los
                  normales primero, los especiales después, y al
                  final los que no se reservan. */
               order by case a.tipo when 'normal' then 1 when 'especial' then 2
                                    when 'aislamiento' then 3 else 4 end, a.id), '[]'::jsonb)
        from alojamiento a),
    'reservas', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', r.id, 'alojamiento', r.alojamiento_id,
               'entrada', r.entrada, 'salida', r.salida,
               'estado', r.estado, 'perros', r.perros,
               'quienes', (select coalesce(string_agg(p.nombre, ' y ' order by p.nombre), '')
                             from reserva_perro rp join perro p on p.id = rp.perro_id
                            where rp.reserva_id = r.id),
               'atencion', exists (select 1 from reserva_perro rp
                                     join perro p on p.id = rp.perro_id
                                    where rp.reserva_id = r.id
                                      and p.agresivo_con_personas))), '[]'::jsonb)
        from reserva r
       where r.estado in ('pendiente','confirmada','en_curso')
         and r.entrada::date < hasta and r.salida::date > desde),
    'ocupacion', (
      /* generate_series sobre fechas devuelve marcas de tiempo,
         no fechas: hay que castear las dos veces. */
      select coalesce(jsonb_object_agg(d::date::text, perros_dentro(d::date)), '{}'::jsonb)
        from generate_series(desde::timestamp, (hasta - 1)::timestamp, '1 day') d)
  );
$$;

-- ============================================================
-- LA HOJA DEL DÍA: quién está dentro, quién entra y quién sale.
-- ============================================================
create or replace function hoja_del_dia(el_dia date)
returns jsonb language sql stable
set search_path = public as $$
  select jsonb_build_object(
    'dia', el_dia,
    'dentro', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'reserva', r.id,
               'alojamiento', a.nombre,
               'tipo', a.tipo,

               /* Los identificadores, para poder HACER cosas desde
                  la hoja y no sólo mirarla: mover de box y abrir la
                  ficha del perro. Con el nombre no se mueve nada. */
               'alojamiento_id', a.id,
               'perro_id', p.id,

               /* Cuántos días le quedan para irse.
               
                  Se cuenta contra EL DÍA DE LA HOJA, no contra hoy:
                  la hoja se puede sacar del sábado que viene, y ahí
                  «le quedan 3 días» tiene que ser 3 desde el sábado.
               
                  Santiago, 13/09/2026: es lo que decide si hoy toca
                  preparar una salida, avisar al dueño o pedir más
                  comida. */
               'dias', (r.salida::date - el_dia),
               'se_va', r.salida,

               'perro', p.nombre,
               'come', p.pautas_alimentacion,
               'cuidados', p.cuidados,
               'peligrosidad', p.agresivo_con_personas,

               /* Lo que hay que hacerle A ESTE PERRO EN ESTA
                  ESTANCIA, que es distinto de lo que pone su
                  ficha. Estaba todo guardado y no se veía. */
               'curas', r.con_curas > 0,
               'en_celo', rp.en_celo,
               'se_le_espera_celo', rp.se_le_espera_celo,
               'peso', rp.peso,
               'esta_vez', rp.cuidados_esta_vez,
               'marcas', (select coalesce(jsonb_agg(m), '[]'::jsonb) from (
                   select 'comilón' as m where p.comilon
                   union all select 'bebe muchísima agua' where p.polidipsia
                   union all select 'destroza cosas'      where p.destroyer
                   union all select 'tímido'              where p.timido
                   union all select 'no sale con machos'  where p.sociable = 'hembras'
                   union all select 'no sale con hembras' where p.sociable = 'machos'
                   union all select 'mejor solo'          where p.sociable = 'ninguno'
                 ) marcas)
             ) order by a.tipo desc, a.id), '[]'::jsonb)
        from reserva r
        join alojamiento a   on a.id = r.alojamiento_id
        join reserva_perro rp on rp.reserva_id = r.id
        join perro p         on p.id = rp.perro_id
       where r.estado in ('confirmada','en_curso')
         and el_dia >= r.entrada::date and el_dia < r.salida::date),
    'entran', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'hora', to_char(r.entrada, 'HH24:MI'),
               'quienes', (select string_agg(p.nombre, ' y ' order by p.nombre)
                             from reserva_perro rp join perro p on p.id = rp.perro_id
                            where rp.reserva_id = r.id),
               'alojamiento', a.nombre) order by r.entrada), '[]'::jsonb)
        from reserva r join alojamiento a on a.id = r.alojamiento_id
       where r.estado in ('confirmada','en_curso') and r.entrada::date = el_dia),
    'salen', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'hora', to_char(r.salida, 'HH24:MI'),
               'quienes', (select string_agg(p.nombre, ' y ' order by p.nombre)
                             from reserva_perro rp join perro p on p.id = rp.perro_id
                            where rp.reserva_id = r.id),
               'alojamiento', a.nombre) order by r.salida), '[]'::jsonb)
        from reserva r join alojamiento a on a.id = r.alojamiento_id
       where r.estado in ('confirmada','en_curso') and r.salida::date = el_dia)
  );
$$;

-- ============================================================
-- PRUEBAS
-- ============================================================
do $$
declare c jsonb; h jsonb;
begin
  c := cuadrante('2026-08-10', '2026-08-17');
  assert jsonb_array_length(c->'alojamientos') = 32,
         'el cuadrante tiene que traer los 32 alojamientos, trajo ' ||
         jsonb_array_length(c->'alojamientos');
  assert (c->'ocupacion') ? '2026-08-10', 'y la ocupación día a día';

  h := hoja_del_dia(current_date);
  assert h ? 'dentro' and h ? 'entran' and h ? 'salen',
         'la hoja del día trae quién está, quién entra y quién sale';

  raise notice 'Administración: el cuadrante y la hoja del día responden.';
end $$;
