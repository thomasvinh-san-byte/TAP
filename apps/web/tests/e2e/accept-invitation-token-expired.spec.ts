// =============================================================================
// E2E Playwright — Invitation chauffeur, token expiré / invalide (PLAN-5, C08)
// =============================================================================
// Couvre SC #5 (variant erreur) : accès direct à /accept-invite avec un
// paramètre d'erreur transmis par le Route Handler GET (PLAN-4 §4.5).
//
// Aucune génération de token expiré réelle requise : la page Server Component
// branche sur `searchParams.error` AVANT toute vérification de session. On
// teste les deux états d'erreur produits par le Route Handler verifyOtp :
//   - ?error=expired       → token plus dans la fenêtre 24h Supabase
//   - ?error=invalid_link  → paramètres manquants ou échange échoué
//
// Assertions clés (DEC-024 : pas de signup self-service B2B fleet) :
//   - panneau erreur visible avec message factuel français
//   - aucun champ password rendu (no DOM)
//   - aucun bouton retry / renvoi self-service
//   - indication explicite de contacter le régulateur
// =============================================================================

import { test, expect } from '@playwright/test';

test.describe('Invitation chauffeur — token expiré / invalide', () => {
  test('lien expiré → panneau erreur sans form ni bouton retry', async ({
    page,
  }) => {
    await page.goto('/accept-invite?error=expired');

    // 1. Panneau erreur visible avec message "Lien d'invitation expiré"
    await expect(
      page.getByText(/lien d'invitation expiré/i),
    ).toBeVisible();

    // 2. Aucun champ password rendu (la page court-circuite AcceptInviteForm)
    await expect(page.getByLabel(/^Mot de passe$/)).toHaveCount(0);
    await expect(
      page.getByLabel(/confirmer le mot de passe/i),
    ).toHaveCount(0);

    // 3. Aucun bouton de retry self-service (DEC-024 B2B fleet)
    await expect(
      page.getByRole('button', { name: /renvoyer|réessayer|retry/i }),
    ).toHaveCount(0);

    // 4. Indication factuelle de contacter le régulateur
    await expect(
      page.getByText(/contactez votre régulateur/i),
    ).toBeVisible();
  });

  test('lien invalide → panneau erreur générique sans form', async ({
    page,
  }) => {
    await page.goto('/accept-invite?error=invalid_link');

    // Message générique distinct (cf. accept-invite/page.tsx)
    await expect(
      page.getByText(/invalide ou déjà utilisé/i),
    ).toBeVisible();

    // Aucun form rendu non plus
    await expect(page.getByLabel(/^Mot de passe$/)).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: /activer mon compte/i }),
    ).toHaveCount(0);
  });
});
