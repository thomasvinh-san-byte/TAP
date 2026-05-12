-- 20260513000003 — Re-seed patients fictifs (défense en profondeur NFR-001)
--
-- Données fictives — pattern numéro 9XXX + tél 99-90-XX,
-- aucune correspondance volontaire avec personnes réelles.
--
-- Migration idempotente : UPDATE ciblé sur clé naturelle (nom, prenom).
-- Re-runnable sans casser les FK rides.patient_id existantes.
-- Les noms réunionnais sont conservés (exception NFR-001 explicite pour
-- les données de démo, décision Q3 questionnaire phase 03.1).
--
-- Ref : D-SEED-1..4, checker W4 (regex strict exactement 10), checker W5
-- (`supabase/setup-all.sql` obligatoire, vérifié 2433 L).

UPDATE patients
SET telephone = '02 62 99 90 01',
    telephone_normalized = '0262999001',
    adresse_ligne1 = '9001 chemin du Vacoa',
    code_postal = '97400',
    ville = 'Saint-Denis'
WHERE nom = 'Bègue' AND prenom = 'Christiane';

UPDATE patients
SET telephone = '02 62 99 90 02',
    telephone_normalized = '0262999002',
    adresse_ligne1 = '9002 rue des Lataniers',
    code_postal = '97410',
    ville = 'Saint-Pierre'
WHERE nom = 'Boyer' AND prenom = 'Suzanne';

UPDATE patients
SET telephone = '06 92 99 90 03',
    telephone_normalized = '0692999003',
    adresse_ligne1 = '9003 allée des Songes',
    code_postal = '97410',
    ville = 'Saint-Pierre'
WHERE nom = 'Dijoux' AND prenom = 'André';

UPDATE patients
SET telephone = '06 92 99 90 04',
    telephone_normalized = '0692999004',
    adresse_ligne1 = '9004 chemin du Piton',
    code_postal = '97490',
    ville = 'Sainte-Clotilde'
WHERE nom = 'Grondin' AND prenom = 'Jean-Bernard';

UPDATE patients
SET telephone = '06 92 99 90 05',
    telephone_normalized = '0692999005',
    adresse_ligne1 = '9005 rue des Bambous',
    code_postal = '97400',
    ville = 'Saint-Denis'
WHERE nom = 'Hoarau' AND prenom = 'Patrick';

UPDATE patients
SET telephone = '06 92 99 90 06',
    telephone_normalized = '0692999006',
    adresse_ligne1 = '9006 chemin de la Ravine',
    code_postal = '97410',
    ville = 'Saint-Pierre'
WHERE nom = 'Lebon' AND prenom = 'Bernard';

UPDATE patients
SET telephone = '02 62 99 90 07',
    telephone_normalized = '0262999007',
    adresse_ligne1 = '9007 rue des Cyclones',
    code_postal = '97432',
    ville = 'Ravine des Cabris'
WHERE nom = 'Maillot' AND prenom = 'Marlène';

UPDATE patients
SET telephone = '02 62 99 90 08',
    telephone_normalized = '0262999008',
    adresse_ligne1 = '9008 allée du Volcan',
    code_postal = '97400',
    ville = 'Saint-Denis'
WHERE nom = 'Payet' AND prenom = 'Marie-Ange';

UPDATE patients
SET telephone = '02 62 99 90 09',
    telephone_normalized = '0262999009',
    adresse_ligne1 = '9009 chemin du Lagon',
    code_postal = '97430',
    ville = 'Le Tampon'
WHERE nom = 'Robert' AND prenom = 'Anne-Sophie';

UPDATE patients
SET telephone = '06 92 99 90 10',
    telephone_normalized = '0692999010',
    adresse_ligne1 = '9010 rue des Galets',
    code_postal = '97418',
    ville = 'La Plaine des Cafres'
WHERE nom = 'Vergoz' AND prenom = 'Yves';
