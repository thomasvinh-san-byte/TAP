-- =============================================================================
-- Durcissement connexion — limitation applicative par compte ET par origine
-- =============================================================================
-- Généralise la brique de rate limit du portail public (legal_request_attempts,
-- migration 20260508000002) à la CONNEXION. Motivation : la limitation native du
-- fournisseur d'auth est par origine réseau seulement (insuffisante — de nombreux
-- utilisateurs partagent une même sortie réseau à La Réunion, et un attaquant vise
-- un compte depuis des origines variées) et peu fiable. On ajoute une couche
-- applicative, PRINCIPALEMENT PAR COMPTE (et en complément par origine).
--
-- Anti-déni-de-service : PAS de verrouillage dur. La fenêtre glissante se vide
-- d'elle-même ; l'action ne réenregistre pas une tentative déjà bloquée (le
-- compteur draine donc même sous attaque continue). La voie de reprise
-- (mot de passe oublié) n'est jamais limitée par cette table (elle ne cible que
-- l'action de connexion).
--
-- Confidentialité : on ne stocke JAMAIS l'identifiant ni l'IP en clair — seules
-- des EMPREINTES SHA-256 (calculées côté Server Action). Table non lisible par
-- les rôles applicatifs (service_role uniquement, comme legal_request_attempts).
-- =============================================================================

create table public.login_attempts (
  id uuid primary key default extensions.uuid_generate_v4(),
  -- Empreinte SHA-256 de l'identifiant (email normalisé) — jamais en clair.
  identifier_hash text not null,
  -- Empreinte SHA-256 de l'origine réseau (IP) — jamais en clair.
  ip_hash text not null,
  attempted_at timestamptz not null default now(),
  success boolean not null default false
);

-- Index de fenêtre glissante par compte et par origine (interrogation récente).
create index login_attempts_identifier_time_idx
  on public.login_attempts (identifier_hash, attempted_at desc);
create index login_attempts_ip_time_idx
  on public.login_attempts (ip_hash, attempted_at desc);

alter table public.login_attempts enable row level security;
alter table public.login_attempts force row level security;

-- service_role uniquement (la Server Action écrit via le client admin). Aucun
-- accès aux rôles applicatifs : ni lecture ni écriture.
create policy login_attempts_service on public.login_attempts
  for all to service_role using (true) with check (true);

revoke all on public.login_attempts from authenticated, anon;

comment on table public.login_attempts is
  'Rate limit applicatif de la CONNEXION (par compte + par origine). Empreintes '
  'SHA-256 uniquement (jamais identifiant/IP en clair). service_role only. '
  'Ralentissement progressif, pas de verrouillage dur (anti-DoS).';

-- -- purge_login_attempts() : nettoyage de la fenêtre glissante ---------------
-- Les lignes anciennes n'ont plus d'utilité (fenêtre glissante courte). Purge
-- quotidienne, calquée sur purge_legal_request_attempts().
create or replace function public.purge_login_attempts()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.login_attempts
  where attempted_at < now() - interval '1 day';
end;
$$;

comment on function public.purge_login_attempts() is
  'Purge login_attempts > 1 jour (fenêtre glissante courte) — exécuté quotidien.';

-- Cohérence avec la doctrine sécurité (migration 20260525000001) : aucune
-- fonction de purge exposée aux rôles applicatifs.
revoke all on function public.purge_login_attempts() from public, anon, authenticated;

-- -- cron.schedule (gardé : DO block si l'extension est présente) -------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'login-attempts-purge',
      '15 3 * * *',
      $cron$ select public.purge_login_attempts(); $cron$
    );
  end if;
end $$;
