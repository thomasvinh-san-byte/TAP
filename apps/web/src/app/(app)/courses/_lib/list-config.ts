/**
 * Source de vérité UNIQUE de la borne de page de la liste des courses.
 *
 * Partagée par le client (`FETCH_CAP`), le schéma de validation de l'action
 * (`limit.max`) et les requêtes de base (borne du `limit`). Évite les valeurs
 * divergentes (100 en requête, 200 au schéma, 500 au client) qui vidaient la
 * liste en silence : le client demandait 500, le schéma plafonnait à 200 → la
 * validation échouait et l'action renvoyait `[]`.
 *
 * Fichier volontairement sans aucune dépendance (ni `server-only`, ni import
 * serveur) : importable aussi bien côté client que côté serveur.
 */
export const RIDES_LIST_FETCH_CAP = 500;
