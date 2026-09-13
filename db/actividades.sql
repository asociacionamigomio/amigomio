-- ============================================================
-- EDUCACIÓN CANINA Y DEPORTE
--
-- El dueño dice que le interesa educar a su perro, o hacer
-- deporte con él, y eso llega a administración.
--
-- NO ES UNA RESERVA. No hay plazas, ni precio, ni reloj de 24
-- horas, ni disponibilidad que comprobar. Es una conversación
-- que empieza: alguien lo pide, alguien lo lee y contesta. Todo
-- lo demás se habla por teléfono, que es como se habla de esto.
--
-- Los dos caminos piden cosas distintas:
--
--   DEPORTE    — quiere venir a VER un entrenamiento del grupo
--                de trabajo. Nadie se apunta a IGP sin haber
--                visto uno: es una decisión que se toma de pie
--                en el campo, no leyendo un folleto.
--   EDUCACIÓN  — quiere que le cuenten: grupos, horarios, qué
--                se hace y cuánto vale.
--
-- Aplicar DESPUÉS de schema.sql.
-- ============================================================

create table if not exists interes (
  id         uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references cliente(id) on delete cascade,

  -- De qué perro habla. No es obligatorio: puede preguntar antes
  -- de tener ninguno dado de alta. Pero si lo dice, ahorra la
  -- primera pregunta de la llamada.
  perro_id   uuid references perro(id) on delete set null,

  tipo       text not null check (tipo in ('deporte','educacion')),
  mensaje    text not null default '',

  estado     text not null default 'nueva'
             check (estado in ('nueva','hablada','apuntado','descartada')),
  nota       text not null default '',     -- lo que apunte administración

  creada     timestamptz not null default now(),
  atendida   timestamptz
);

-- Darle dos veces al botón no puede dejar dos solicitudes
-- iguales esperando: administración llamaría dos veces por lo
-- mismo. Una viva por cliente y tipo; cuando se cierra, puede
-- volver a pedirlo.
create unique index if not exists interes_uno_vivo
  on interes (cliente_id, tipo)
  where estado in ('nueva','hablada');

create index if not exists interes_por_atender on interes (creada) where estado = 'nueva';

alter table interes enable row level security;

drop policy if exists interes_ve_lo_suyo on interes;
create policy interes_ve_lo_suyo on interes
  for select using (cliente_id = auth.uid() or es_admin());

drop policy if exists interes_lo_pide_el_dueno on interes;
create policy interes_lo_pide_el_dueno on interes
  for insert with check (cliente_id = auth.uid());

-- El cliente puede retirarlo; administración, atenderlo.
drop policy if exists interes_lo_retira_el_dueno on interes;
create policy interes_lo_retira_el_dueno on interes
  for delete using (cliente_id = auth.uid() or es_admin());

drop policy if exists interes_lo_atiende_admin on interes;
create policy interes_lo_atiende_admin on interes
  for update using (es_admin());

-- ------------------------------------------------------------
-- Pedirlo. Devuelve lo que ha pasado en cristiano, porque el
-- caso de «ya lo habías pedido» no es un error: es una
-- respuesta, y al cliente hay que decírselo sin asustarle.
-- ------------------------------------------------------------
create or replace function mostrar_interes(
  el_tipo    text,
  el_perro   uuid default null,
  el_mensaje text default ''
) returns jsonb language plpgsql security definer
set search_path = public as $$
declare
  ya boolean;
begin
  if auth.uid() is null then
    raise exception 'Entra con tu correo para pedirlo.';
  end if;

  if el_tipo not in ('deporte','educacion') then
    raise exception 'Eso no es una de las dos cosas.';
  end if;

  select exists (select 1 from interes
                  where cliente_id = auth.uid() and tipo = el_tipo
                    and estado in ('nueva','hablada')) into ya;

  if ya then
    return jsonb_build_object('ok', true, 'repetido', true,
      'mensaje', 'Ya nos lo habías dicho y lo tenemos apuntado. Te escribimos pronto.');
  end if;

  insert into interes (cliente_id, perro_id, tipo, mensaje)
       values (auth.uid(), el_perro, el_tipo, coalesce(el_mensaje, ''));

  -- `case when`, no el `?:` de JavaScript: en SQL eso no existe.
  return jsonb_build_object('ok', true, 'repetido', false,
    'mensaje', case when el_tipo = 'deporte'
      then 'Apuntado. Te decimos cuándo hay entrenamiento para que te pases a verlo.'
      else 'Apuntado. Te contamos cómo van los grupos y qué horarios hay.'
    end);
end $$;

revoke all on function mostrar_interes(text, uuid, text) from public;
grant execute on function mostrar_interes(text, uuid, text) to authenticated;

-- ============================================================
-- PRUEBAS. Aplicar este fichero ES ejecutarlas.
-- ============================================================
do $$
declare
  el_cliente uuid;
  cuantos    integer;
begin
  select id into el_cliente from cliente limit 1;
  if el_cliente is null then
    raise notice 'Sin clientes todavía: esto se probará cuando los haya.';
    return;
  end if;

  -- Dos veces lo mismo deja UNA sola viva.
  insert into interes (cliente_id, tipo, mensaje)
       values (el_cliente, 'deporte', 'PRUEBA');
  begin
    insert into interes (cliente_id, tipo, mensaje)
         values (el_cliente, 'deporte', 'PRUEBA otra vez');
    raise exception 'no debería dejar dos vivas del mismo tipo';
  exception when unique_violation then null;
  end;

  -- Y cerrada la primera, se puede volver a pedir.
  update interes set estado = 'apuntado' where cliente_id = el_cliente and mensaje = 'PRUEBA';
  insert into interes (cliente_id, tipo, mensaje)
       values (el_cliente, 'deporte', 'PRUEBA segunda vuelta');

  select count(*) into cuantos from interes where mensaje like 'PRUEBA%';
  assert cuantos = 2, 'tenían que quedar dos, una cerrada y otra viva; hay ' || cuantos;

  delete from interes where mensaje like 'PRUEBA%';

  raise notice 'Educación y deporte: todas las comprobaciones pasan.';
end $$;
