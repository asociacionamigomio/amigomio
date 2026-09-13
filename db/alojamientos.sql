-- ============================================================
-- LOS ALOJAMIENTOS DE VERDAD.
--
-- Hasta el 13/09/2026 la base tenía «Box 01»…«Box 30» y dos
-- «Especial», que eran nombres de relleno para poder probar el
-- motor. Nadie puede trabajar con eso: en la hoja del día hay que
-- poder decir «Piedra 4», no «Box 21», porque «Box 21» no está
-- escrito en ninguna puerta del núcleo.
--
-- El reparto real, dicho por Santiago:
--
--   Interiores   1-8      8
--   Chapa        1-8      8
--   Piedra       1-10    10
--   Parques      1-5      5
--   Gallinero             1
--   Casita                1
--   Toy          1-10    10
--                       ---
--                        43
--
-- TODOS A TARIFA NORMAL. Se preguntó expresamente si el gallinero
-- o la casita eran los «especiales» (35 €/noche planos, un solo
-- perro) y la respuesta fue que no hay ninguno: los 43 van por la
-- escalera de precios de siempre.
--
-- ------------------------------------------------------------
-- SE RENOMBRA, NO SE BORRA Y SE VUELVE A CREAR.
--
-- Las reservas que ya existen apuntan al alojamiento por su
-- identificador. Borrar y recrear les cambiaría el sitio por
-- debajo —o se las llevaría por delante—, así que a los 32 que ya
-- hay se les cambia el nombre y punto, y los 11 que faltan se
-- añaden. Los identificadores no se tocan.
--
-- El reparto de qué «Box» pasa a ser qué es ARBITRARIO, y puede
-- serlo: los nombres viejos no significaban nada. Lo que no es
-- arbitrario es que cada uno siga siendo el mismo alojamiento
-- para las reservas que ya lo tienen cogido.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Los que ya estaban, con su nombre de verdad.
-- ------------------------------------------------------------
do $$
declare
  viejo text;
  nuevo text;
  pares text[][] := array[
    ['Box 01','Interior 1'],  ['Box 02','Interior 2'],
    ['Box 03','Interior 3'],  ['Box 04','Interior 4'],
    ['Box 05','Interior 5'],  ['Box 06','Interior 6'],
    ['Box 07','Interior 7'],  ['Box 08','Interior 8'],

    ['Box 09','Chapa 1'],     ['Box 10','Chapa 2'],
    ['Box 11','Chapa 3'],     ['Box 12','Chapa 4'],
    ['Box 13','Chapa 5'],     ['Box 14','Chapa 6'],
    ['Box 15','Chapa 7'],     ['Box 16','Chapa 8'],

    ['Box 17','Piedra 1'],    ['Box 18','Piedra 2'],
    ['Box 19','Piedra 3'],    ['Box 20','Piedra 4'],
    ['Box 21','Piedra 5'],    ['Box 22','Piedra 6'],
    ['Box 23','Piedra 7'],    ['Box 24','Piedra 8'],
    ['Box 25','Piedra 9'],    ['Box 26','Piedra 10'],

    ['Box 27','Parque 1'],    ['Box 28','Parque 2'],
    ['Box 29','Parque 3'],    ['Box 30','Parque 4'],

    ['Especial 1','Gallinero'],
    ['Especial 2','Casita']
  ];
  i integer;
begin
  for i in 1 .. array_length(pares, 1) loop
    viejo := pares[i][1];
    nuevo := pares[i][2];

    -- Sólo si el viejo existe y el nuevo no: así se puede
    -- aplicar mil veces sin hacer nada la segunda.
    if exists (select 1 from alojamiento where nombre = viejo)
       and not exists (select 1 from alojamiento where nombre = nuevo) then
      update alojamiento set nombre = nuevo where nombre = viejo;
    end if;
  end loop;
end $$;

-- El gallinero y la casita dejan de ser «especial»: ya no hay
-- ninguno a tarifa plana.
update alojamiento set tipo = 'normal'
 where nombre in ('Gallinero', 'Casita') and tipo <> 'normal';

-- ------------------------------------------------------------
-- 2. Los que faltaban.
-- ------------------------------------------------------------
insert into alojamiento (nombre, tipo, capacidad)
values ('Parque 5', 'normal', 3),
       ('Toy 1',  'normal', 3), ('Toy 2',  'normal', 3),
       ('Toy 3',  'normal', 3), ('Toy 4',  'normal', 3),
       ('Toy 5',  'normal', 3), ('Toy 6',  'normal', 3),
       ('Toy 7',  'normal', 3), ('Toy 8',  'normal', 3),
       ('Toy 9',  'normal', 3), ('Toy 10', 'normal', 3)
on conflict (nombre) do nothing;

-- ============================================================
-- PRUEBAS. Aplicar este fichero ES ejecutarlas.
--
-- Se comprueba la ESTRUCTURA, no el estado de los datos: esto
-- corre contra la base de verdad. Y ojo con una cosa — un
-- alojamiento se puede dar de baja (`activo = false`) por una
-- avería o una obra, así que las cuentas se hacen sobre TODOS,
-- no sólo sobre los activos.
-- ============================================================
do $$
declare
  n integer;
  falta text;
begin
  -- Que no se haya quedado ninguno con nombre de relleno.
  select count(*) into n from alojamiento where nombre like 'Box %'
                                             or nombre like 'Especial %';
  assert n = 0, 'Han quedado alojamientos con nombre de relleno: ' || n;

  -- Que estén los 43, cada uno con el suyo.
  for falta in
    select x from unnest(array[
      'Interior 1','Interior 2','Interior 3','Interior 4',
      'Interior 5','Interior 6','Interior 7','Interior 8',
      'Chapa 1','Chapa 2','Chapa 3','Chapa 4','Chapa 5','Chapa 6','Chapa 7','Chapa 8',
      'Piedra 1','Piedra 2','Piedra 3','Piedra 4','Piedra 5',
      'Piedra 6','Piedra 7','Piedra 8','Piedra 9','Piedra 10',
      'Parque 1','Parque 2','Parque 3','Parque 4','Parque 5',
      'Gallinero','Casita',
      'Toy 1','Toy 2','Toy 3','Toy 4','Toy 5',
      'Toy 6','Toy 7','Toy 8','Toy 9','Toy 10']) as x
     where not exists (select 1 from alojamiento a where a.nombre = x)
  loop
    assert false, 'Falta el alojamiento: ' || falta;
  end loop;

  select count(*) into n from alojamiento;
  assert n >= 43, 'Tendria que haber al menos 43 alojamientos, hay ' || n;

  -- Ninguno a tarifa plana: se decidio el 13/09/2026.
  select count(*) into n from alojamiento where tipo = 'especial';
  assert n = 0, 'No deberia quedar ningun alojamiento especial, hay ' || n;

  raise notice 'Alojamientos: los 43 con su nombre de verdad.';
end $$;
