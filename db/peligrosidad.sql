-- ============================================================
-- QUIÉN DECIDE QUE UN PERRO NECESITA MANEJO DE PELIGROSIDAD
--
-- Definición (Santiago, 12/09/2026): un perro necesita manejo de
-- peligrosidad si es AGRESIVO CON PERSONAS. La raza da igual.
-- Un PPP puede ser un trozo de pan; un mestizo de 12 kilos puede
-- necesitarlo. Son cosas distintas:
--
--   PPP                      -> por ley, exige licencia y seguro
--   Agresivo con personas    -> lo decide AmigoMío, y va a
--                               alojamiento especial, siempre solo,
--                               a 35 euros planos
--
-- EL PROBLEMA QUE ESTO ARREGLA: hasta ahora `agresivo_con_personas`
-- era una casilla que marcaba el dueño. Así no la marca nadie.
--
-- Ahora el cliente CUENTA lo que ha pasado y AmigoMío CLASIFICA.
-- ============================================================

-- Lo que declara el cliente, con sus palabras.
alter table perro add column if not exists incidentes_con_personas text not null default '';
alter table perro add column if not exists ha_mordido boolean not null default false;

comment on column perro.ha_mordido is
  'Lo declara el propietario. NO decide la tarifa: solo avisa a administración.';
comment on column perro.agresivo_con_personas is
  'Lo marca SOLO administración. Manda a alojamiento especial y a 35 euros.';

-- ============================================================
-- La clasificación es de AmigoMío, no del cliente.
-- ============================================================
create or replace function perro_peligrosidad_la_marca_admin()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  /* El propio servidor (editor SQL, tareas programadas) es
     administración: ahí no hay sesión de nadie, current_user
     es postgres. Sin esto, ni Santiago desde el panel de
     Supabase podría clasificar un perro. */
  if es_admin() or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Nadie se declara peligroso a sí mismo al darse de alta.
    new.agresivo_con_personas := false;
    return new;
  end if;

  -- Y al editar, ese campo no se toca: se queda como estaba.
  new.agresivo_con_personas := old.agresivo_con_personas;
  return new;
end $$;

drop trigger if exists perro_peligrosidad_la_marca_admin on perro;
create trigger perro_peligrosidad_la_marca_admin
  before insert or update on perro
  for each row execute function perro_peligrosidad_la_marca_admin();

-- ============================================================
-- PRUEBAS
-- ============================================================
do $$
declare
  algun_cliente uuid;
  p uuid;
  quedo boolean;
begin
  select id into algun_cliente from cliente limit 1;
  if algun_cliente is null then
    raise notice 'Peligrosidad: sin clientes todavía, se saltan las pruebas.';
    return;
  end if;

  /* Desde el servidor SÍ se puede clasificar: es administración. */
  insert into perro (cliente_id, chip, nombre, agresivo_con_personas)
       values (algun_cliente, '111000011112222', 'PRUEBA-PELIGRO', true)
    returning id into p;
  select agresivo_con_personas into quedo from perro where id = p;
  assert quedo = true, 'administración sí puede clasificar un perro';

  /* Y haciéndose pasar por un cliente cualquiera, NO. */
  set local role authenticated;
  begin
    update perro set agresivo_con_personas = false where id = p;
  exception when others then null;
  end;
  reset role;

  select agresivo_con_personas into quedo from perro where id = p;
  assert quedo = true,
    'un cliente NO puede quitarle a su perro la marca de peligrosidad';

  delete from perro where id = p;
  raise notice 'Peligrosidad: la clasificación es de administración. Comprobado.';
end $$;
