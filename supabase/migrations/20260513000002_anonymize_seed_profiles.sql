-- ---------------------------------------------------------------------------
-- Anonymisation des profils démo (Phase 3 — clôture Passe 1).
--
-- Les comptes démo (dirigeant@demo.tap, regulateur@demo.tap,
-- chauffeur@demo.tap) ont été semés Phase 0.7 avec des noms réels
-- (« Patrick Hoarau », « Sandrine Payet », « Jean-Marc Técher »).
-- Cela viole .planning/regle-neutralite-et-ton.md : aucun nom propre
-- dans le code, les seeds ou les UI publiques. On remplace par des
-- libellés génériques (« Dirigeant Démo », etc.) — l'avatar UserMenu
-- affiche désormais « DD / RD / CD ».
--
-- Idempotent : safe à rejouer (where clause sur l'email @demo.tap).
-- Les seed.sql / seed.demo.sql / setup-all.sql / setup-sql.ts sont
-- mis à jour en parallèle pour que toute réinit DB reparte propre.
-- ---------------------------------------------------------------------------

update public.profiles
set
  prenom = case role
    when 'dirigeant'  then 'Dirigeant'
    when 'regulateur' then 'Régulateur'
    when 'chauffeur'  then 'Chauffeur'
    else prenom
  end,
  nom = 'Démo'
where email like '%@demo.tap';
