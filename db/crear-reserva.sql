-- ============================================================
-- CREAR UNA RESERVA
--
-- La operación única del diseño §9.1: la usan la app, el panel
-- de administración y Zapatilla. Una máquina, tres puertas.
--
-- Todo lo que hay que comprobar se comprueba AQUÍ. Si Zapatilla
-- alucina, si alguien trastea su móvil o si el panel tiene un
-- fallo, la respuesta es la misma y es un no.
--
-- Aplicar DESPUÉS de reservas.sql y peligrosidad.sql.
-- ============================================================

alter table reserva add column if not exists expira timestamptz;
comment on column reserva.expira is
  'Cuándo caduca si no sube el justificante. 24 horas desde que se crea.';

-- ------------------------------------------------------------
-- ¿Pueden ir estos dos perros al mismo alojamiento?
--
-- OJO: esta regla también existe en js/perro.js, que la usa para
-- avisar al cliente ANTES de reservar. La de aquí es la que
-- manda; la de allí es un adelanto. Si se tocan, se tocan las
-- dos. (En la fase 2, cuando la pantalla llame a esta por rpc,
-- la de JavaScript desaparece.)
-- ------------------------------------------------------------
create or replace function pueden_compartir(a uuid, b uuid)
returns text language plpgsql stable
set search_path = public as $$
declare
  pa perro; pb perro;
  motivo text;
begin
  select * into pa from perro where id = a;
  select * into pb from perro where id = b;

  if pa.agresivo_con_personas then
    return pa.nombre || ' necesita alojamiento propio y no puede compartir.';
  end if;
  if pb.agresivo_con_personas then
    return pb.nombre || ' necesita alojamiento propio y no puede compartir.';
  end if;

  motivo := coalesce(no_acepta(pa, pb), no_acepta(pb, pa));
  return motivo;   -- null si pueden
end $$;

create or replace function no_acepta(uno perro, otro perro)
returns text language plpgsql immutable
set search_path = public as $$
begin
  if uno.sociable = 'ninguno' then
    return uno.nombre || ' está mejor solo.';
  end if;
  if uno.sociable = 'machos' and otro.sexo is distinct from 'macho' then
    return uno.nombre || ' solo se lleva bien con machos.';
  end if;
  if uno.sociable = 'hembras' and otro.sexo is distinct from 'hembra' then
    return uno.nombre || ' solo se lleva bien con hembras.';
  end if;
  return null;
end $$;

-- ------------------------------------------------------------
-- LA OPERACIÓN
-- ------------------------------------------------------------
create or replace function crear_reserva(
  el_cliente uuid,
  los_perros uuid[],
  la_entrada timestamp,
  la_salida  timestamp,
  los_extras integer[] default '{}',
  quien      text      default 'cliente'
) returns jsonb language plpgsql security definer
set search_path = public as $$
declare
  /* `security definer` significa que esta función se salta RLS,
     así que la puerta la vigila ella misma.

     current_user distingue quién llama de verdad:
       postgres / supabase_admin -> el propio servidor (editor SQL,
                                    tareas programadas). De fiar.
       authenticated / anon      -> alguien desde internet.

     Sin esto, un visitante sin identificar tendría auth.uid() nulo
     y las comprobaciones de "¿es tuyo?" se quedarían en nada. */
  del_servidor boolean := current_user in ('postgres', 'supabase_admin');
  soy_admin  boolean := es_admin() or del_servidor;
  abiertas   text;
  n          integer := coalesce(array_length(los_perros, 1), 0);
  tipo       text := 'normal';
  agresivos  integer;
  ajenos     integer;
  i integer; j integer;
  choque     text;
  sitio      jsonb;
  cuentas    jsonb;
  curas      integer;
  paga_luego boolean;
  nueva      uuid;
  p uuid;
begin
  -- Quién puede pedir esto en nombre de quién
  if not soy_admin then
    if auth.uid() is null then
      raise exception 'Hay que entrar con tu cuenta para reservar.';
    end if;
    if el_cliente <> auth.uid() then
      raise exception 'Solo puedes reservar a tu nombre.';
    end if;
  end if;

  -- El interruptor del diseño §13: mientras esté apagado, solo
  -- administración reserva. Wix sigue mandando.
  if not soy_admin then
    select valor into abiertas from ajuste where clave = 'reservas_abiertas';
    if coalesce(abiertas, 'no') <> 'si' then
      raise exception 'Todavía no hemos abierto las reservas por aquí. Llámanos y te la hacemos.';
    end if;
  end if;

  if n < 1 or n > 3 then
    raise exception 'En un alojamiento caben de 1 a 3 perros.';
  end if;

  -- Los perros tienen que ser suyos
  select count(*) into ajenos from unnest(los_perros) pid
    where not exists (select 1 from perro where id = pid and cliente_id = el_cliente);
  if ajenos > 0 then
    raise exception 'Alguno de esos perros no está en tu ficha.';
  end if;

  -- Agresividad con personas: alojamiento especial y siempre solo
  select count(*) into agresivos from perro
   where id = any(los_perros) and agresivo_con_personas;
  if agresivos > 0 then
    if n > 1 then
      raise exception 'Un perro que necesita alojamiento propio va siempre solo.';
    end if;
    tipo := 'especial';
  end if;

  -- Compatibilidad entre ellos
  if n > 1 then
    for i in 1..n loop
      for j in (i + 1)..n loop
        choque := pueden_compartir(los_perros[i], los_perros[j]);
        if choque is not null then
          raise exception '%', choque;
        end if;
      end loop;
    end loop;
  end if;

  -- ¿Cabe?
  sitio := hay_sitio(la_entrada, la_salida, tipo, n);
  if not (sitio->>'hay')::boolean then
    raise exception '%', sitio->>'motivo';
  end if;

  -- ¿Cuánto? Se congela aquí dentro: una subida de tarifas no
  -- reescribirá esta reserva.
  select count(*) into curas from perro
   where id = any(los_perros) and cuidados ilike '%inyectab%';
  -- Con el cliente: su descuento tiene que quedar congelado en
  -- el desglose, no calcularse otra vez al cobrar.
  cuentas := presupuesto(la_entrada, la_salida, tipo, n, curas, los_extras, el_cliente);

  -- Los autorizados a pagar en persona se saltan el justificante
  select paga_en_persona into paga_luego from cliente where id = el_cliente;

  insert into reserva (cliente_id, alojamiento_id, entrada, salida, perros, con_curas,
                       estado, desglose, total, creada_por, expira)
       values (el_cliente, (sitio->>'alojamiento')::integer, la_entrada, la_salida, n, curas,
               case when coalesce(paga_luego, false) then 'confirmada' else 'pendiente' end,
               cuentas, (cuentas->>'total')::numeric, quien,
               case when coalesce(paga_luego, false) then null else now() + interval '24 hours' end)
    returning id into nueva;

  foreach p in array los_perros loop
    insert into reserva_perro (reserva_id, perro_id) values (nueva, p);
  end loop;

  return jsonb_build_object(
    'id', nueva,
    'estado', case when coalesce(paga_luego, false) then 'confirmada' else 'pendiente' end,
    'desglose', cuentas,
    'expira', case when coalesce(paga_luego, false) then null else now() + interval '24 hours' end);
end $$;

-- ============================================================
-- PRUEBAS DE CREAR RESERVA.
-- Crean perros de mentira, prueban cada portazo, y borran.
-- ============================================================
do $$
declare
  c uuid;
  luna uuid; toby uuid; bravo uuid; nala uuid;
  r jsonb;
  salto boolean;
  antes integer;
begin
  select id into c from cliente limit 1;
  if c is null then
    raise notice 'Crear reserva: sin clientes todavía, se saltan las pruebas.';
    return;
  end if;

  select count(*) into antes from reserva;

  insert into perro (cliente_id, chip, nombre, sexo, sociable)
       values (c,'900000000000001','PRU-Luna','hembra','todos') returning id into luna;
  insert into perro (cliente_id, chip, nombre, sexo, sociable)
       values (c,'900000000000002','PRU-Toby','macho','todos') returning id into toby;
  insert into perro (cliente_id, chip, nombre, sexo, sociable)
       values (c,'900000000000003','PRU-Nala','hembra','hembras') returning id into nala;
  insert into perro (cliente_id, chip, nombre, sexo, sociable, agresivo_con_personas)
       values (c,'900000000000004','PRU-Bravo','macho','todos', true) returning id into bravo;

  -- Una reserva normal de dos perros compatibles
  r := crear_reserva(c, array[luna, toby], '2027-03-08 11:00', '2027-03-12 11:00');
  assert r->>'estado' in ('pendiente','confirmada'), 'debería crearse';
  assert (r->'desglose'->>'total')::numeric > 0, 'y con precio';

  -- Incompatibles: Nala solo con hembras, Toby es macho
  salto := false;
  begin
    r := crear_reserva(c, array[nala, toby], '2027-04-05 11:00', '2027-04-08 11:00');
  exception when others then
    salto := true;
    assert sqlerrm like '%solo se lleva bien con hembras%', 'y dice por qué: ' || sqlerrm;
  end;
  assert salto, 'no puede juntar a una que solo acepta hembras con un macho';

  -- El agresivo con personas no comparte
  salto := false;
  begin
    r := crear_reserva(c, array[bravo, luna], '2027-04-05 11:00', '2027-04-08 11:00');
  exception when others then salto := true;
  end;
  assert salto, 'un perro con manejo de peligrosidad va siempre solo';

  -- Pero solo sí, y va a alojamiento especial
  r := crear_reserva(c, array[bravo], '2027-04-05 11:00', '2027-04-08 11:00');
  assert (select a.tipo from reserva rr join alojamiento a on a.id = rr.alojamiento_id
           where rr.id = (r->>'id')::uuid) = 'especial',
         'tiene que ir a un alojamiento especial';
  assert (r->'desglose'->>'total')::numeric = 35 * 3,
         'tres noches en especial son 105, dio ' || (r->'desglose'->>'total');

  -- Cuatro perros no caben
  salto := false;
  begin
    r := crear_reserva(c, array[luna, toby, nala, bravo], '2027-05-05 11:00', '2027-05-08 11:00');
  exception when others then salto := true;
  end;
  assert salto, 'cuatro perros no caben en un alojamiento';

  -- Un perro que no es suyo
  salto := false;
  begin
    r := crear_reserva(c, array[gen_random_uuid()], '2027-05-05 11:00', '2027-05-08 11:00');
  exception when others then salto := true;
  end;
  assert salto, 'no se puede reservar con un perro ajeno';

  -- Limpieza
  delete from reserva where cliente_id = c and entrada >= '2027-01-01';
  delete from perro where chip like '90000000000000%';

  assert (select count(*) from reserva) = antes, 'las pruebas tienen que dejarlo todo como estaba';
  raise notice 'Crear reserva: todas las comprobaciones pasan.';
end $$;
