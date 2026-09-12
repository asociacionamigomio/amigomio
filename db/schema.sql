-- ============================================================
-- AmigoMío — esquema de la fase 0: clientes y perros.
--
-- Las reglas viven aquí, no en el navegador. La clave pública
-- de Supabase va dentro de la página y cualquiera puede leerla;
-- lo único que protege los datos es lo que hay en este fichero.
-- ============================================================

-- ------------------------------------------------------------
-- Cliente. Se crea solo la primera vez que alguien entra.
-- ------------------------------------------------------------
create table if not exists cliente (
  id              uuid primary key references auth.users(id) on delete cascade,
  nombre          text not null default '',
  apellidos       text not null default '',
  dni             text not null default '',
  domicilio       text not null default '',
  telefono        text not null default '',

  -- Quién más puede recoger al perro. Lo exige el libro de registro.
  recoge_nombre   text not null default '',
  recoge_dni      text not null default '',

  -- Sólo administración pone esto.
  paga_en_persona boolean not null default false,
  es_admin        boolean not null default false,

  consiente_datos boolean not null default false,
  creado          timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Perro.
-- ------------------------------------------------------------
create table if not exists perro (
  id                uuid primary key default gen_random_uuid(),
  cliente_id        uuid not null references cliente(id) on delete cascade,

  -- Chip y nombre: sólo cambian con el visto bueno de administración.
  chip              text not null unique,
  nombre            text not null,

  fecha_nacimiento  date,
  sexo              text check (sexo in ('macho','hembra')),
  castrado          boolean not null default false,
  raza              text not null default '',
  capa              text not null default '',
  estado_reproductivo text not null default '',
  foto              text,

  pautas_alimentacion text not null default '',
  cuidados            text not null default '',

  -- Cuestionario de carácter.
  agresivo_con_personas boolean not null default false,
  sociable          text not null default 'todos'
                    check (sociable in ('todos','machos','hembras','ninguno')),
  timido            boolean not null default false,
  comilon           boolean not null default false,
  polidipsia        boolean not null default false,
  destroyer         boolean not null default false,
  actividad         text not null default 'normal'
                    check (actividad in ('activo','normal','sedentario')),

  -- Perro potencialmente peligroso: licencia y seguro, por ley.
  es_ppp            boolean not null default false,
  ppp_licencia_hasta date,
  ppp_seguro_hasta   date,

  -- Fechas sanitarias. Un objeto por requisito:
  --   {"rabia": {"fecha":"2026-03-01","validoHasta":null,"primovacunacion":false}}
  -- Los identificadores son los de js/sanidad.js.
  sanidad           jsonb not null default '{}'::jsonb,

  borrador          boolean not null default false,  -- alta guardada a medias
  creado            timestamptz not null default now()
);

create index if not exists perro_del_cliente on perro (cliente_id);

-- ------------------------------------------------------------
-- Solicitudes de cambio de chip o nombre.
-- ------------------------------------------------------------
create table if not exists solicitud_cambio (
  id           uuid primary key default gen_random_uuid(),
  perro_id     uuid not null references perro(id) on delete cascade,
  cliente_id   uuid not null references cliente(id) on delete cascade,
  campo        text not null check (campo in ('chip','nombre')),
  valor_actual text not null,
  valor_nuevo  text not null,
  motivo       text not null default '',
  estado       text not null default 'pendiente'
               check (estado in ('pendiente','aprobada','rechazada')),
  resuelta_por uuid references cliente(id),
  resuelta_el  timestamptz,
  creada       timestamptz not null default now()
);

create index if not exists solicitudes_pendientes
  on solicitud_cambio (estado) where estado = 'pendiente';

-- ============================================================
-- ¿Quién es administración? Se usa en triggers y políticas.
-- security definer para que pueda leer cliente sin chocar con RLS.
-- ============================================================
create or replace function es_admin()
returns boolean language sql stable security definer
set search_path = public as $$
  select coalesce((select es_admin from cliente where id = auth.uid()), false);
$$;

-- ============================================================
-- La regla que no se negocia: el propietario NO cambia el chip
-- ni el nombre. Puede cambiar todo lo demás cuando quiera.
--
-- Esto va en trigger y no en un campo deshabilitado en pantalla,
-- porque un campo deshabilitado se salta desde el móvil en diez
-- segundos.
-- ============================================================
create or replace function perro_chip_y_nombre_inmutables()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if es_admin() then
    return new;  -- administración sí puede, tras aprobar la solicitud
  end if;

  if new.chip is distinct from old.chip then
    raise exception 'El número de chip solo se cambia con el visto bueno de AmigoMío.';
  end if;

  if new.nombre is distinct from old.nombre then
    raise exception 'El nombre solo se cambia con el visto bueno de AmigoMío.';
  end if;

  return new;
end $$;

drop trigger if exists perro_chip_y_nombre_inmutables on perro;
create trigger perro_chip_y_nombre_inmutables
  before update on perro
  for each row execute function perro_chip_y_nombre_inmutables();

-- ============================================================
-- Nadie se asciende a sí mismo.
-- ============================================================
create or replace function cliente_no_se_asciende()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if not es_admin() then
    new.es_admin        := old.es_admin;
    new.paga_en_persona := old.paga_en_persona;
  end if;
  return new;
end $$;

drop trigger if exists cliente_no_se_asciende on cliente;
create trigger cliente_no_se_asciende
  before update on cliente
  for each row execute function cliente_no_se_asciende();

-- ============================================================
-- Row Level Security.
-- ============================================================
alter table cliente          enable row level security;
alter table perro            enable row level security;
alter table solicitud_cambio enable row level security;

-- Cliente: cada uno ve y edita lo suyo. Administración, todo.
drop policy if exists cliente_ve_lo_suyo on cliente;
create policy cliente_ve_lo_suyo on cliente
  for select using (id = auth.uid() or es_admin());

drop policy if exists cliente_se_crea on cliente;
create policy cliente_se_crea on cliente
  for insert with check (id = auth.uid());

drop policy if exists cliente_edita_lo_suyo on cliente;
create policy cliente_edita_lo_suyo on cliente
  for update using (id = auth.uid() or es_admin());

-- Perro: el suyo, y el de cualquiera si eres administración.
drop policy if exists perro_ve_los_suyos on perro;
create policy perro_ve_los_suyos on perro
  for select using (cliente_id = auth.uid() or es_admin());

drop policy if exists perro_da_de_alta on perro;
create policy perro_da_de_alta on perro
  for insert with check (cliente_id = auth.uid() or es_admin());

drop policy if exists perro_edita_los_suyos on perro;
create policy perro_edita_los_suyos on perro
  for update using (cliente_id = auth.uid() or es_admin());

drop policy if exists perro_borra_los_suyos on perro;
create policy perro_borra_los_suyos on perro
  for delete using (cliente_id = auth.uid() or es_admin());

-- Solicitudes: las suyas; resolver, sólo administración.
drop policy if exists solicitud_ve_las_suyas on solicitud_cambio;
create policy solicitud_ve_las_suyas on solicitud_cambio
  for select using (cliente_id = auth.uid() or es_admin());

drop policy if exists solicitud_la_pide_el_dueno on solicitud_cambio;
create policy solicitud_la_pide_el_dueno on solicitud_cambio
  for insert with check (cliente_id = auth.uid());

drop policy if exists solicitud_la_resuelve_admin on solicitud_cambio;
create policy solicitud_la_resuelve_admin on solicitud_cambio
  for update using (es_admin());
