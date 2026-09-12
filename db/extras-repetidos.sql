-- ============================================================
-- Los extras se habían duplicado.
--
-- Causa: en tarifas.sql el insert llevaba `on conflict do
-- nothing` SIN decir sobre qué columna, y la tabla no tenía
-- ninguna restricción de unicidad. Sin conflicto que detectar,
-- «no hagas nada» no hace nada: cada vez que se aplicaba el
-- fichero, los siete extras entraban otra vez.
--
-- Este fichero limpia lo repetido y pone la marca que faltaba,
-- para que no pueda volver a pasar.
-- ============================================================

-- 1. Fuera los repetidos, quedándose con el primero de cada
--    nombre: es el que puede tener precio ya puesto.
delete from extra e
 where e.id > (select min(e2.id) from extra e2 where e2.nombre = e.nombre);

-- 2. Y la marca que faltaba. A partir de aquí, insertar un
--    nombre repetido es imposible, no «inofensivo».
alter table extra drop constraint if exists extra_nombre_unico;
alter table extra add constraint extra_nombre_unico unique (nombre);

do $$
declare repetidos integer;
begin
  select count(*) into repetidos from (
    select nombre from extra group by nombre having count(*) > 1) x;
  assert repetidos = 0, 'todavía quedan extras repetidos';
  raise notice 'Extras: % en total, ninguno repetido.', (select count(*) from extra);
end $$;
