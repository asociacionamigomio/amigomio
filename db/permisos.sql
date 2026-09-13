-- ============================================================
-- LOS PERMISOS DE LAS TABLAS. EL ÚLTIMO FICHERO, SIEMPRE.
--
-- Va el último a propósito, y esto no es un detalle de estilo.
--
-- El 13/09/2026 estos permisos vivían en `perfiles.sql`, que se
-- aplica el tercero, y estaban escritos COLUMNA POR COLUMNA en
-- una lista a mano. Luego `push.sql` añadió `quiere_push` a
-- `cliente`. Una columna creada después de darse los permisos se
-- queda sin ninguno — y basta una para que Postgres rechace
-- `select *` entero con 42501.
--
-- Resultado: ningún cliente podía traer su ficha, y como eso es
-- de lo primero que hace el arranque, la aplicación no abría. El
-- error no se parecía en nada a la causa. Dos días.
--
-- De ahí las dos reglas de este fichero:
--   1. Se aplica el ÚLTIMO, cuando ya existen todas las columnas.
--   2. NUNCA una lista de columnas a mano: se le pregunta a la
--      tabla cuáles tiene.
-- ============================================================

-- Las políticas de `perfiles.sql` abren la FILA entera de
-- `cliente` y de `perro` a los demás clientes: es lo que RLS
-- sabe hacer. Lo que impide que se vea el DNI o el chip es que
-- la aplicación pregunta por las VISTAS, que sólo tienen las
-- columnas que se pueden enseñar.
revoke select on cliente from authenticated;
revoke select on perro   from authenticated;

-- NUNCA una lista de columnas escrita a mano.
--
-- Aquí había una, y el 13/09/2026 costó dos días. `db/push.sql`
-- añadió `quiere_push` a `cliente`; la columna nueva no estaba en
-- la lista, así que Postgres empezó a rechazar `select *` con
-- 42501 y NINGÚN cliente pudo traer su ficha. Como eso es de lo
-- primero que hace el arranque, la aplicación se moría al abrir y
-- el error no se parecía en nada a la causa.
--
-- Una lista a mano sobre una tabla que crece es una trampa con
-- fecha: aguanta hasta que alguien añade una columna. Así que se
-- le pregunta a la tabla cuáles tiene.
do $$
declare columnas text;
begin
  select string_agg(format('%I', column_name), ', ')
    into columnas
    from information_schema.columns
   where table_schema = 'public' and table_name = 'cliente';

  execute format('grant select (%s) on cliente to authenticated', columnas);
end $$;

grant select on perro to authenticated;

grant select on perfiles_publicos to authenticated;
grant select on perros_publicos   to authenticated;


-- ------------------------------------------------------------
-- Y que no quede NI UNA columna de `cliente` sin permiso.
--
-- Esta es la prueba que habría evitado los dos días: aplicar el
-- fichero ES ejecutarla, así que el día que alguien añada una
-- columna y no llegue aquí, la instalación aborta en vez de
-- dejar la aplicación muerta y callada.
-- ------------------------------------------------------------
do $$
declare huerfanas text;
begin
  select string_agg(c.column_name, ', ')
    into huerfanas
    from information_schema.columns c
   where c.table_schema = 'public' and c.table_name = 'cliente'
     and not exists (
       select 1 from information_schema.column_privileges p
        where p.table_schema = 'public' and p.table_name = 'cliente'
          and p.column_name = c.column_name
          and p.grantee = 'authenticated' and p.privilege_type = 'SELECT');

  assert huerfanas is null,
    'Columnas de cliente sin permiso de lectura: ' || huerfanas ||
    '. Con una sola que falte, select(*) devuelve 42501 y ningun cliente ' ||
    'puede traer su ficha: la aplicacion no abre.';
end $$;
