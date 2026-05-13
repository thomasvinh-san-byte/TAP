// =============================================================================
// E2E Playwright — Invitation chauffeur, happy path (Phase 04, PLAN-5, C08)
// =============================================================================
// Couvre SC #1 → #6 collectivement par exécution réelle du golden path :
//   1. Dirigeant connecté crée une fiche chauffeur test
//   2. Click bouton "Inviter" sur la ligne → mini-Dialog
//   3. Saisie email + submit → toast "Invitation envoyée"
//   4. Récupération du magic link depuis Inbucket
//   5. Ouverture du lien → Route Handler /accept-invite/verify → redirect
//      /accept-invite (form rendu avec email pré-rempli read-only)
//   6. Saisie password + confirm + CGU → "Activer mon compte"
//   7. Redirect /conduite (route chauffeur authentifiée)
//
// Sélecteurs DOM stables livrés PLAN-4 :
//   - role="button" + name="Nouveau chauffeur"     (drivers-list header)
//   - label "Nom affiché"                          (driver-form.client)
//   - label "Taxi"                                 (driver-form fieldset)
//   - role="button" + name="Créer le chauffeur"    (driver-form submit)
//   - role="button" + name="Inviter"               (invitation action button)
//   - role="dialog" + title "Inviter <nom>"        (Radix Dialog)
//   - label "Adresse e-mail du chauffeur"          (invite mini-form)
//   - role="button" + name="Envoyer l'invitation"  (invite submit)
//   - label "Adresse e-mail" (accept-invite form)  (readonly attribute)
//   - label "Mot de passe" / "Confirmer le mot de passe"
//   - label avec /conditions générales/i           (CGU checkbox)
//   - role="button" + name="Activer mon compte"
//
// NFR-001 (aucun nom propre) : "Chauffeur test" + chauffeur-test@example.com.
// Comptes démo `@demo.tap` autorisés par exception explicite seed démo.
// =============================================================================

import { test, expect } from '@playwright/test';
import {
  resetInbucketMailbox,
  fetchLatestInviteUrl,
} from './helpers/inbucket';

const TEST_DRIVER_NAME = 'Chauffeur test';
const TEST_EMAIL = 'chauffeur-test@example.com';
const TEST_MAILBOX = 'chauffeur-test';

const DIRIGEANT_EMAIL = 'dirigeant@demo.tap';
const DIRIGEANT_PASSWORD = 'demo1234!';

const CHAUFFEUR_PASSWORD = 'motdepasse-test-123';

test.describe('Invitation chauffeur — happy path', () => {
  test.beforeEach(async ({ request }) => {
    // Q4.2 — purge mailbox Inbucket avant chaque run pour isoler les specs.
    await resetInbucketMailbox(request, TEST_MAILBOX);
  });

  test('dirigeant invite → chauffeur active compte → redirect /conduite', async ({
    page,
    request,
    context,
  }) => {
    // 1. Login dirigeant démo
    await page.goto('/login');
    await page.getByLabel(/adresse e-mail/i).fill(DIRIGEANT_EMAIL);
    await page.getByLabel(/mot de passe/i).fill(DIRIGEANT_PASSWORD);
    await page.getByRole('button', { name: /se connecter/i }).click();
    await page.waitForURL(
      (url) => !url.pathname.includes('/login'),
      { timeout: 10_000 },
    );

    // 2. Aller créer une fiche chauffeur test
    await page.goto('/admin/chauffeurs');
    await page
      .getByRole('button', { name: /nouveau chauffeur/i })
      .first()
      .click();

    // Sheet "Nouveau chauffeur" — driver-form (DEC pré-PLAN-4 : useFormState natif)
    await page.getByLabel(/nom affiché/i).fill(TEST_DRIVER_NAME);
    // Cocher au moins un type_permis pour passer Zod (driverSchema)
    await page.getByLabel(/^Taxi$/).check();
    await page.getByRole('button', { name: /créer le chauffeur/i }).click();

    // La ligne du chauffeur test apparaît dans la liste.
    await expect(page.getByText(TEST_DRIVER_NAME).first()).toBeVisible({
      timeout: 5_000,
    });

    // 3. Click bouton Inviter sur la ligne du chauffeur test
    // Note : le bouton "Inviter" est en dehors du <button> parent qui
    // englobe la ligne (cf. drivers-list.client.tsx). On filtre la ligne
    // <li> qui contient le nom du chauffeur, puis on prend le bouton.
    const driverRow = page
      .locator('li')
      .filter({ hasText: TEST_DRIVER_NAME })
      .first();
    await driverRow.getByRole('button', { name: /^Inviter$/ }).click();

    // 4. Mini-Dialog Inviter : saisie email + submit
    const inviteDialog = page.getByRole('dialog');
    await expect(inviteDialog).toBeVisible({ timeout: 2_000 });
    await inviteDialog
      .getByLabel(/adresse e-mail du chauffeur/i)
      .fill(TEST_EMAIL);
    await inviteDialog
      .getByRole('button', { name: /envoyer l'invitation/i })
      .click();

    // Toast Sonner "Invitation envoyée."
    await expect(page.getByText(/invitation envoyée/i)).toBeVisible({
      timeout: 5_000,
    });

    // 5. Récupérer l'URL d'invitation depuis Inbucket
    const inviteUrl = await fetchLatestInviteUrl(request, TEST_MAILBOX);
    expect(inviteUrl).toMatch(/accept-invite/);

    // 6. Se déconnecter du dirigeant : purger les cookies de session pour
    // simuler un onglet privé côté chauffeur (le Route Handler verifyOtp
    // doit créer la session du nouveau user, pas réutiliser celle du dirigeant).
    await context.clearCookies();

    // 7. Ouvrir le lien magic
    await page.goto(inviteUrl);
    // Le Route Handler /accept-invite/verify redirige vers /accept-invite
    // (sans paramètres si succès, ou ?error=... si échec).
    await page.waitForURL(/\/accept-invite(?:\?|$)/, { timeout: 10_000 });

    // 8. Vérifier email read-only pré-rempli
    const emailField = page.getByLabel(/adresse e-mail/i).first();
    await expect(emailField).toHaveValue(TEST_EMAIL);
    // L'attribut HTML "readonly" est présent (Input shadcn passe readOnly=true).
    await expect(emailField).toHaveJSProperty('readOnly', true);

    // 9. Saisir password + confirm + CGU
    await page
      .getByLabel(/^Mot de passe$/)
      .fill(CHAUFFEUR_PASSWORD);
    await page
      .getByLabel(/confirmer le mot de passe/i)
      .fill(CHAUFFEUR_PASSWORD);
    await page.getByLabel(/conditions générales/i).check();

    // 10. Submit Activer mon compte
    await page
      .getByRole('button', { name: /activer mon compte/i })
      .click();

    // 11. Assert redirect /conduite
    await page.waitForURL(/\/conduite(?:\?|$)/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/conduite/);
  });
});
