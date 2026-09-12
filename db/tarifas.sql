-- ============================================================
-- AmigoMío — el motor: alojamientos, festivos, tarifas y extras.
--
-- NINGÚN precio se escribe en el código de la aplicación. Todos
-- viven aquí, en filas que Santiago edita desde su panel: el día
-- que suba la noche a 17 € no puede depender de que alguien le
-- publique una versión nueva de la web.
--
-- Aplicar DESPUÉS de schema.sql: usa la función es_admin().
-- ============================================================

-- ------------------------------------------------------------
-- Alojamientos. Los cuatro tipos salen del diseño §5.5.
-- `aislamiento` y `cachorros` NO son reservables por el cliente
-- —los asigna administración— pero sí cuentan para el tope de
-- perros simultáneos.
-- ------------------------------------------------------------
create table if not exists alojamiento (
  id        serial primary key,
  nombre    text not null unique,
  tipo      text not null check (tipo in ('normal','especial','aislamiento','cachorros')),
  capacidad integer not null default 3 check (capacidad between 1 and 3),
  activo    boolean not null default true,   -- en obras, avería… sin perder su historial
  notas     text not null default ''
);

-- ------------------------------------------------------------
-- Festivos de Puerto Real. HAY QUE CARGARLOS CADA AÑO.
-- Si faltan, el motor cobrará 15 € noches que deberían ser 18 €.
-- ------------------------------------------------------------
create table if not exists festivo (
  fecha  date primary key,
  nombre text not null default '',
  ambito text not null default 'local'
         check (ambito in ('nacional','andalucia','local'))
);

-- ------------------------------------------------------------
-- Tarifas. Una fila por concepto, con su clave.
-- ------------------------------------------------------------
create table if not exists tarifa (
  id      serial primary key,
  clave   text not null unique,
  importe numeric(6,2) not null,
  nota    text not null default ''
);

insert into tarifa (clave, importe, nota) values
  ('base_entre_semana',    15, 'Lunes, martes, miércoles y jueves'),
  ('base_finde',           18, 'Viernes, sábado y domingo'),
  ('base_festivo',         18, 'Festivos en Puerto Real y sus vísperas'),
  ('base_navidad',         25, '24, 25 y 31 de diciembre, y 1 de enero'),
  ('especial_dia',         35, 'Alojamiento especial: tarifa plana, sin recargos'),
  ('segundo_perro',        10, 'Por noche, si van dos en el mismo alojamiento'),
  ('tercer_perro',         20, 'Por noche, si van tres'),
  ('curas_dia',             8, 'Por perro y noche: inyectables o curas. La oral no lleva cargo'),
  ('fuera_horario_semana', 50, 'Entrega o recogida fuera de horario, entre semana'),
  ('fuera_horario_finde',  75, 'Entrega o recogida fuera de horario, sábado o domingo'),
  ('fuera_horario_noche', 120, 'Entre las 21:00 y las 7:30, sea el día que sea'),
  ('minimo_noches',         2, 'Reserva mínima')
on conflict (clave) do nothing;

-- ------------------------------------------------------------
-- Extras. Catálogo editable.
--
-- `lo_cobra` importa de verdad: los servicios de la veterinaria
-- los factura ella según SUS tarifas, y NO pueden entrar en el
-- importe que el cliente transfiere a AmigoMío. Si entrasen,
-- AmigoMío estaría cobrando por cuenta de un tercero.
-- ------------------------------------------------------------
create table if not exists extra (
  id        serial primary key,
  nombre    text not null,
  importe   numeric(6,2) not null default 0,
  por_noche boolean not null default true,
  activo    boolean not null default true,
  en_verano boolean not null default true,
  lo_cobra  text not null default 'amigomio'
            check (lo_cobra in ('amigomio','veterinaria')),
  nota      text not null default ''
);

insert into extra (nombre, importe, por_noche, en_verano, lo_cobra, nota) values
  ('Gimnasio canino (cintas)',        0, true,  true,  'amigomio',    'Precio por definir'),
  ('Alimentación a cargo del hotel',  0, true,  true,  'amigomio',    'Precio por definir'),
  ('Cuidados por ATV',                0, true,  true,  'amigomio',    'Precio por definir'),
  ('Adiestramiento personalizado',    0, true,  false, 'amigomio',    'No disponible en verano'),
  ('Atención veterinaria',            0, false, true,  'veterinaria', 'Lo factura la clínica'),
  ('Vacunación durante la estancia',  0, false, true,  'veterinaria', 'Lo factura la clínica'),
  ('Desparasitación durante la estancia', 0, false, true, 'veterinaria', 'Lo factura la clínica')
on conflict do nothing;

-- ------------------------------------------------------------
-- Ajustes sueltos.
-- ------------------------------------------------------------
create table if not exists ajuste (
  clave text primary key,
  valor text not null,
  nota  text not null default ''
);

insert into ajuste (clave, valor, nota) values
  ('tope_perros_simultaneos', '',
   'Máximo de perros dentro a la vez, contando todos los alojamientos. VACÍO = no se aplica'),
  ('reservas_abiertas', 'no',
   'Mientras sea "no", solo administración puede crear reservas. Wix sigue mandando'),
  ('iban', '', 'Cuenta donde se transfiere. NO se escribe en el repositorio'),
  ('dias_cancelacion_gratis', '7',
   'Con esta antelación o más, devolución completa. Menos, no se puede cancelar')
on conflict (clave) do nothing;

-- ============================================================
-- Row Level Security.
--
-- Todo el mundo LEE tarifas, festivos, extras y alojamientos:
-- hace falta para enseñarle al cliente lo que va a pagar.
-- ESCRIBIR, solo administración.
--
-- `ajuste` es distinto: lleva el IBAN, así que ni se lee.
-- ============================================================
alter table alojamiento enable row level security;
alter table festivo     enable row level security;
alter table tarifa      enable row level security;
alter table extra       enable row level security;
alter table ajuste      enable row level security;

-- Se escriben una a una a propósito. Generarlas con un bucle y
-- format() ahorra líneas, pero deja el fichero que decide quién ve
-- qué convertido en algo que hay que ejecutar para saber qué hace.

drop policy if exists alojamiento_lo_lee_cualquiera on alojamiento;
create policy alojamiento_lo_lee_cualquiera on alojamiento for select using (true);
drop policy if exists alojamiento_lo_cambia_admin on alojamiento;
create policy alojamiento_lo_cambia_admin on alojamiento
  for all using (es_admin()) with check (es_admin());

drop policy if exists festivo_lo_lee_cualquiera on festivo;
create policy festivo_lo_lee_cualquiera on festivo for select using (true);
drop policy if exists festivo_lo_cambia_admin on festivo;
create policy festivo_lo_cambia_admin on festivo
  for all using (es_admin()) with check (es_admin());

drop policy if exists tarifa_lo_lee_cualquiera on tarifa;
create policy tarifa_lo_lee_cualquiera on tarifa for select using (true);
drop policy if exists tarifa_lo_cambia_admin on tarifa;
create policy tarifa_lo_cambia_admin on tarifa
  for all using (es_admin()) with check (es_admin());

drop policy if exists extra_lo_lee_cualquiera on extra;
create policy extra_lo_lee_cualquiera on extra for select using (true);
drop policy if exists extra_lo_cambia_admin on extra;
create policy extra_lo_cambia_admin on extra
  for all using (es_admin()) with check (es_admin());

-- El IBAN vive aquí: solo administración lo ve.
drop policy if exists ajuste_solo_admin on ajuste;
create policy ajuste_solo_admin on ajuste
  for all using (es_admin()) with check (es_admin());

-- Lo que el cliente sí necesita saber de los ajustes, sin ver el IBAN.
create or replace function ajuste_publico(la_clave text)
returns text language sql stable security definer
set search_path = public as $$
  select valor from ajuste
   where clave = la_clave
     and clave in ('reservas_abiertas','dias_cancelacion_gratis','tope_perros_simultaneos');
$$;
