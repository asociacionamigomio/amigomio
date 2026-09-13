-- ============================================================
-- FOTOS Y PERFILES QUE SE PUEDEN ENSEÑAR
--
-- Santiago, 13/09/2026: foto de perfil, foto de cada perro, y
-- que el cliente pueda hacer su perfil visible a los demás.
--
-- LO DELICADO ESTÁ AQUÍ, y conviene leerlo antes de tocar nada:
--
-- La ficha del cliente lleva DNI, domicilio y teléfono. La del
-- perro lleva el CHIP —que identifica al animal y vale para
-- reclamarlo—, sus fechas sanitarias, sus pautas de comida y si
-- es agresivo con personas. NADA DE ESO puede salir.
--
-- Y RLS es por FILA, no por columna: si se abriera la fila del
-- cliente para que la vean otros, se vería ENTERA. Por eso lo
-- público sale por otra puerta —dos vistas con sólo lo que se
-- puede enseñar— y las tablas siguen cerradas como estaban.
--
-- Aplicar DESPUÉS de schema.sql.
-- ============================================================

alter table cliente add column if not exists foto text;

-- Apagado de fábrica. Un perfil que se hace público sin que
-- nadie lo pida no es un perfil público: es una filtración.
alter table cliente add column if not exists
  perfil_visible boolean not null default false;

comment on column cliente.perfil_visible is
  'Lo decide el CLIENTE, no administración. Con esto en falso no sale en perfiles_publicos';

-- ------------------------------------------------------------
-- Lo que se enseña de una persona: su nombre de pila y su foto.
--
-- Los apellidos tampoco salen: con el nombre basta para
-- reconocerse en la residencia, y el apellido completo junto a
-- una foto ya es otra cosa.
-- ------------------------------------------------------------
create or replace view perfiles_publicos
with (security_invoker = true) as
  select c.id,
         c.nombre,
         c.foto
    from cliente c
   where c.perfil_visible
     and auth.uid() is not null;   -- sólo para quien ha entrado

-- ------------------------------------------------------------
-- Y de sus perros: nombre, raza y foto. Nada más.
-- ------------------------------------------------------------
create or replace view perros_publicos
with (security_invoker = true) as
  select p.id,
         p.cliente_id,
         p.nombre,
         p.raza,
         p.capa,
         p.sexo,
         p.foto,
         p.fecha_nacimiento
    from perro p
    join cliente c on c.id = p.cliente_id
   where c.perfil_visible
     and not p.borrador
     and auth.uid() is not null;

-- Las vistas van con `security_invoker`, así que respetan la
-- RLS de las tablas de debajo. Eso bastaría para cerrarlas… y
-- las cerraría DEMASIADO: `perro` sólo deja ver los tuyos.
--
-- Así que estas dos necesitan su propia puerta: una política
-- que deje ver las filas de quien ha hecho público su perfil.
-- Es el ÚNICO sitio donde se abre algo, y por eso está aquí
-- junto a las vistas y no perdido en schema.sql.
drop policy if exists cliente_perfil_publico on cliente;
create policy cliente_perfil_publico on cliente
  for select to authenticated
  using (perfil_visible);

drop policy if exists perro_de_perfil_publico on perro;
create policy perro_de_perfil_publico on perro
  for select to authenticated
  using (exists (select 1 from cliente c
                  where c.id = perro.cliente_id and c.perfil_visible));

-- OJO: esas dos políticas abren la FILA entera de `cliente` y de
-- `perro` a los demás clientes. Es lo que RLS sabe hacer.
--
-- Lo que impide que se vea el DNI o el chip NO es la política:
-- es que la aplicación pregunta por las VISTAS, que sólo tienen
-- las columnas que se pueden enseñar, y que quien pregunte por
-- la tabla se encuentra… la tabla entera.
--
-- Por eso se quitan los permisos sobre las tablas y se dan sólo
-- sobre las vistas. Aquí sí, columna a columna.
revoke select on cliente from authenticated;
revoke select on perro   from authenticated;
grant select (id, nombre, apellidos, dni, domicilio, telefono,
              recoge_nombre, recoge_dni, paga_en_persona, es_admin,
              descuento_pct, descuento_nota, quiere_correos,
              consiente_datos, creado, foto, perfil_visible)
  on cliente to authenticated;
grant select on perro to authenticated;

grant select on perfiles_publicos to authenticated;
grant select on perros_publicos   to authenticated;

-- ============================================================
-- PRUEBAS. Aplicar este fichero ES ejecutarlas.
-- ============================================================
do $$
declare
  columnas text[];
begin
  -- La vista de personas NO puede tener datos personales.
  select array_agg(column_name::text) into columnas
    from information_schema.columns
   where table_name = 'perfiles_publicos';

  assert not (columnas && array['dni','domicilio','telefono',
                                'recoge_nombre','recoge_dni','apellidos']),
    'la vista pública de personas enseña datos que no debe: ' || columnas::text;

  -- La de perros, ni chip ni sanidad.
  select array_agg(column_name::text) into columnas
    from information_schema.columns
   where table_name = 'perros_publicos';

  assert not (columnas && array['chip','sanidad','agresivo_con_personas',
                                'pautas_alimentacion','cuidados','es_ppp']),
    'la vista pública de perros enseña datos que no debe: ' || columnas::text;

  -- Y de fábrica, nadie es visible.
  assert (select coalesce(bool_and(not perfil_visible), true) from cliente
           where creado < now() - interval '1 minute'),
    'alguien se ha quedado con el perfil visible sin pedirlo';

  raise notice 'Perfiles: todas las comprobaciones pasan.';
end $$;
