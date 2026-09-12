-- ============================================================
-- Cubos de Storage.
--   fotos-perros  — la foto de la ficha
--   cartillas     — foto de la cartilla o del pasaporte europeo
--
-- Ninguno es público: las cartillas llevan datos del animal y
-- del propietario.
--
-- Aplicar DESPUÉS de schema.sql: usa la función es_admin().
-- ============================================================
insert into storage.buckets (id, name, public)
values ('fotos-perros', 'fotos-perros', false),
       ('cartillas',    'cartillas',    false)
on conflict (id) do nothing;

-- Cada uno en su carpeta, que se llama como su id de usuario.
drop policy if exists "sube lo suyo" on storage.objects;
create policy "sube lo suyo" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('fotos-perros','cartillas')
              and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "ve lo suyo" on storage.objects;
create policy "ve lo suyo" on storage.objects
  for select to authenticated
  using (bucket_id in ('fotos-perros','cartillas')
         and ((storage.foldername(name))[1] = auth.uid()::text or es_admin()));

drop policy if exists "borra lo suyo" on storage.objects;
create policy "borra lo suyo" on storage.objects
  for delete to authenticated
  using (bucket_id in ('fotos-perros','cartillas')
         and (storage.foldername(name))[1] = auth.uid()::text);
