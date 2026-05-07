# Deferred items — Phase 01

Pre-existing or out-of-scope issues discovered during plan execution.
Not blocking current plans, to be addressed later.

## 01-2 (2026-05-07)

### siretSchema Luhn checksum failure
- **File:** packages/shared/src/validators/__tests__/common.test.ts
- **Issue:** `siretSchema.parse('40483304800010')` (Carrefour SIRET) throws
  "SIRET invalide (échec contrôle Luhn)". Le SIRET test n'est pas valide
  Luhn. Issue ouverte hors scope plan 01-2 (validators communs, pré-existant).
- **Cause probable:** mauvais SIRET de test ou implémentation Luhn buggée.
- **Action recommandée:** trier en Phase ultérieure, valider l'algo Luhn
  contre 5+ SIRETs réels publics avant de toucher au schema.
