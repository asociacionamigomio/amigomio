-- ============================================================
-- LOS PAPELES DEL PERRO
--
-- Fotos de la cartilla veterinaria y de los papeles que hagan
-- falta. Subirlos es VOLUNTARIO: no bloquea nada, no impide
-- reservar y no se pide dos veces. Quien los sube se ahorra que
-- le pregunten, y nosotros tenemos el papel cuando la inspección
-- lo pida.
--
-- La imagen NO vive aquí: vive en el cubo `cartillas` de
-- Storage, que es privado (db/storage.sql). Aquí sólo está el
-- apunte de qué hoja es y dónde está el fichero.
--
-- Aplicar DESPUÉS de schema.sql y storage.sql.
-- ============================================================

create table if not exists documento_perro (
  id         uuid primary key default gen_random_uuid(),
  perro_id   uuid not null references perro(id) on delete cascade,

  -- Los identificadores son los de js/documentos.js. Se deja
  -- como texto con check y no como enum: añadir una hoja nueva
  -- no puede obligar a un `alter type` en producción.
  tipo       text not null check (tipo in (
               'cartilla_datos',
               'cartilla_vacunas',
               'cartilla_rabia',
               'cartilla_desparasitaciones',
               'seguro',
               'licencia_ppp',
               'licencia_deportiva',
               'otro')),

  -- La ruta dentro del cubo. Empieza SIEMPRE por el id del
  -- usuario: es lo que mira la política de Storage.
  ruta       text not null unique,

  nota       text not null default '',   -- "la de la izquierda está borrosa"
  subido     timestamptz not null default now()
);

create index if not exists documento_perro_por_perro
  on documento_perro (perro_id, tipo);

alter table documento_perro enable row level security;

-- Cada uno los de sus perros. Administración, los de todos:
-- si no, no se podría atender un teléfono ni pasar una
-- inspección.
drop policy if exists "ve los papeles de sus perros" on documento_perro;
create policy "ve los papeles de sus perros" on documento_perro
  for select to authenticated
  using (
    es_admin()
    or exists (
      select 1 from perro p
       where p.id = documento_perro.perro_id
         and p.cliente_id = auth.uid()
    )
  );

-- Nadie cuelga un papel del perro de otro. Administración sí:
-- atiende altas por teléfono.
drop policy if exists "cuelga papeles de sus perros" on documento_perro;
create policy "cuelga papeles de sus perros" on documento_perro
  for insert to authenticated
  with check (
    es_admin()
    or exists (
      select 1 from perro p
       where p.id = documento_perro.perro_id
         and p.cliente_id = auth.uid()
    )
  );

-- Se puede quitar lo que uno subió: una foto movida no sirve de
-- nada y da vergüenza dejarla.
drop policy if exists "quita los papeles de sus perros" on documento_perro;
create policy "quita los papeles de sus perros" on documento_perro
  for delete to authenticated
  using (
    es_admin()
    or exists (
      select 1 from perro p
       where p.id = documento_perro.perro_id
         and p.cliente_id = auth.uid()
    )
  );

-- La nota sí se corrige; el tipo y la ruta, no: cambiarlos a
-- mano dejaría el apunte apuntando a otra cosa.
drop policy if exists "corrige la nota" on documento_perro;
create policy "corrige la nota" on documento_perro
  for update to authenticated
  using (
    es_admin()
    or exists (
      select 1 from perro p
       where p.id = documento_perro.perro_id
         and p.cliente_id = auth.uid()
    )
  );

create or replace function documento_no_se_muda()
returns trigger language plpgsql as $$
begin
  new.perro_id := old.perro_id;
  new.tipo     := old.tipo;
  new.ruta     := old.ruta;
  return new;
end $$;

drop trigger if exists documento_no_se_muda on documento_perro;
create trigger documento_no_se_muda
  before update on documento_perro
  for each row execute function documento_no_se_muda();

-- ============================================================
-- Las pruebas. Aplicar este fichero ES ejecutarlas.
-- ============================================================
do $$
declare
  tipos text[] := array['cartilla_datos','cartilla_vacunas','cartilla_rabia',
                        'cartilla_desparasitaciones','seguro','licencia_ppp',
                        'licencia_deportiva','otro'];
  t text;
  cuantas integer;
begin
  -- El check acepta las ocho hojas y ninguna más.
  foreach t in array tipos loop
    begin
      insert into documento_perro (perro_id, tipo, ruta)
      values (gen_random_uuid(), t, 'prueba/' || t);
      raise exception 'no debería llegar: el perro no existe';
    exception
      when foreign_key_violation then null;   -- bien: el tipo pasó, el perro no
      when check_violation then
        raise exception 'el tipo % debería valer y no vale', t;
    end;
  end loop;

  -- Una hoja inventada no entra.
  begin
    insert into documento_perro (perro_id, tipo, ruta)
    values (gen_random_uuid(), 'pagina_del_dni', 'prueba/x');
    raise exception 'un tipo inventado no puede entrar';
  exception
    when check_violation then null;
  end;

  -- Y RLS está puesta, que es lo que de verdad cierra la puerta.
  select count(*) into cuantas
    from pg_policies
   where tablename = 'documento_perro';
  assert cuantas >= 4, 'faltan políticas en documento_perro';

  assert (select relrowsecurity from pg_class where relname = 'documento_perro'),
    'documento_perro sin row level security';
end $$;
