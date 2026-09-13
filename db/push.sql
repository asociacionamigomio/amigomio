-- ============================================================
-- AVISOS EN EL MÓVIL
--
-- El correo del recordatorio de la víspera se lee a veces; una
-- notificación en el móvil se ve siempre. Y el aviso que más
-- dinero salva —«tu reserva se suelta en unas horas»— es justo
-- el que llega tarde por correo.
--
-- Aquí sólo se guarda A DÓNDE mandar. Qué se manda y cuándo
-- sigue decidiéndose en db/avisos.sql: un aviso es un aviso,
-- salga por correo, por el móvil o por los dos.
--
-- Lo que guarda el navegador cuando el usuario da permiso:
--   endpoint  — una dirección suya, distinta para cada móvil
--   p256dh    — clave pública del navegador, para cifrar
--   auth      — un secreto compartido, también para cifrar
--
-- Esa dirección es un DATO PERSONAL: con ella se le puede
-- mandar lo que sea a ese móvil. Por eso cada uno sólo ve y
-- toca las suyas.
--
-- Aplicar DESPUÉS de schema.sql.
-- ============================================================

create table if not exists suscripcion_push (
  id         uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references cliente(id) on delete cascade,

  -- La dirección del navegador. ÚNICA: entrar otra vez desde el
  -- mismo móvil no puede duplicarla, o llegarían dos avisos
  -- iguales.
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,

  -- Para saber de qué móvil es sin preguntar. Sólo informativo.
  aparato    text not null default '',

  creada     timestamptz not null default now(),
  fallos     integer not null default 0
);

create index if not exists push_del_cliente on suscripcion_push (cliente_id);

alter table suscripcion_push enable row level security;

drop policy if exists push_ve_las_suyas on suscripcion_push;
create policy push_ve_las_suyas on suscripcion_push
  for select using (cliente_id = auth.uid() or es_admin());

drop policy if exists push_se_apunta on suscripcion_push;
create policy push_se_apunta on suscripcion_push
  for insert with check (cliente_id = auth.uid());

drop policy if exists push_se_borra on suscripcion_push;
create policy push_se_borra on suscripcion_push
  for delete using (cliente_id = auth.uid() or es_admin());

drop policy if exists push_se_actualiza on suscripcion_push;
create policy push_se_actualiza on suscripcion_push
  for update using (cliente_id = auth.uid() or es_admin());

-- Quién no quiere avisos en el móvil. Igual que con los
-- correos: si no se puede parar, es spam.
alter table cliente add column if not exists quiere_push boolean not null default true;

-- ============================================================
-- PRUEBAS. Aplicar este fichero ES ejecutarlas.
-- ============================================================
do $$
declare
  el_cliente uuid;
begin
  select id into el_cliente from cliente limit 1;
  if el_cliente is null then
    raise notice 'Sin clientes todavía: esto se probará cuando los haya.';
    return;
  end if;

  insert into suscripcion_push (cliente_id, endpoint, p256dh, auth)
       values (el_cliente, 'PRUEBA://uno', 'x', 'y');

  -- El mismo endpoint no entra dos veces.
  begin
    insert into suscripcion_push (cliente_id, endpoint, p256dh, auth)
         values (el_cliente, 'PRUEBA://uno', 'x', 'y');
    raise exception 'el mismo navegador no puede guardarse dos veces';
  exception when unique_violation then null;
  end;

  delete from suscripcion_push where endpoint like 'PRUEBA://%';

  raise notice 'Avisos en el móvil: todas las comprobaciones pasan.';
end $$;
