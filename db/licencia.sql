-- ============================================================
-- Licencia deportiva.
--
-- No impide entrar en la residencia: es un papel del perro que
-- caduca y del que hay que avisar, como la licencia de PPP y su
-- seguro, que ya se guardaban y de los que no se avisaba nunca.
-- ============================================================
alter table perro add column if not exists licencia_deportiva text not null default '';
alter table perro add column if not exists licencia_deportiva_hasta date;

comment on column perro.licencia_deportiva is
  'Número de licencia deportiva (RSCE, federación). No condiciona la estancia.';
comment on column perro.licencia_deportiva_hasta is
  'Caducidad. Se avisa un mes antes.';
