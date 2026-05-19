-- Phase 05 Wave 1 — Jours fériés Réunion (974)
-- Seed 2026-2028 (12 jours nationaux + Fèt Kaf 20 décembre commémo abolition esclavage).

create table public.holidays_974 (
  date date primary key,
  label text not null
);

alter table public.holidays_974 enable row level security;

create policy holidays_974_read on public.holidays_974
  for select to authenticated using (true);

insert into public.holidays_974 (date, label) values
  -- 2026
  ('2026-01-01', 'Jour de l''An'),
  ('2026-04-06', 'Lundi de Paques'),
  ('2026-05-01', 'Fete du Travail'),
  ('2026-05-08', 'Victoire 1945'),
  ('2026-05-14', 'Ascension'),
  ('2026-05-25', 'Lundi de Pentecote'),
  ('2026-07-14', 'Fete nationale'),
  ('2026-08-15', 'Assomption'),
  ('2026-11-01', 'Toussaint'),
  ('2026-11-11', 'Armistice 1918'),
  ('2026-12-20', 'Abolition de l''esclavage (974)'),
  ('2026-12-25', 'Noel'),
  -- 2027
  ('2027-01-01', 'Jour de l''An'),
  ('2027-03-29', 'Lundi de Paques'),
  ('2027-05-01', 'Fete du Travail'),
  ('2027-05-06', 'Ascension'),
  ('2027-05-08', 'Victoire 1945'),
  ('2027-05-17', 'Lundi de Pentecote'),
  ('2027-07-14', 'Fete nationale'),
  ('2027-08-15', 'Assomption'),
  ('2027-11-01', 'Toussaint'),
  ('2027-11-11', 'Armistice 1918'),
  ('2027-12-20', 'Abolition de l''esclavage (974)'),
  ('2027-12-25', 'Noel'),
  -- 2028
  ('2028-01-01', 'Jour de l''An'),
  ('2028-04-17', 'Lundi de Paques'),
  ('2028-05-01', 'Fete du Travail'),
  ('2028-05-08', 'Victoire 1945'),
  ('2028-05-25', 'Ascension'),
  ('2028-06-05', 'Lundi de Pentecote'),
  ('2028-07-14', 'Fete nationale'),
  ('2028-08-15', 'Assomption'),
  ('2028-11-01', 'Toussaint'),
  ('2028-11-11', 'Armistice 1918'),
  ('2028-12-20', 'Abolition de l''esclavage (974)'),
  ('2028-12-25', 'Noel');
