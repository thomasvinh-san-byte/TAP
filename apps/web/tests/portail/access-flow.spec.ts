/**
 * E2E Playwright — Portail patient flow accès (DPA-04, D-09, D-10).
 *
 * Scénario complet :
 *   1. Régulatrice (Alpha) se connecte → /admin/legal/requests → crée une
 *      patient_data_request type=acces pour un patient existant.
 *   2. Email simulé contient un lien /legal/request/{token} (le test
 *      l'extrait via une fixture API ou via le helper de test mail).
 *   3. Le test suit le lien (sans cookies app — context anonyme) →
 *      formulaire vérification identité (NIR + nom + DDN) → soumission →
 *      page export → bouton « Télécharger JSON ».
 *   4. Le JSON téléchargé contient `format_version: '1.0'` et le champ
 *      `nir` est null (pas de NIR clair sans appel Edge Function dédiée).
 *
 * État RED Wave 0 : pages portail patient + Server Actions n'existent pas
 * encore (Wave 2 + Wave 3).
 */
import { test, expect } from '@playwright/test';

test.describe('portail patient /legal/request/[token] — flow accès', () => {
  test('régulatrice crée demande, patient suit lien, télécharge JSON sans NIR clair', async ({
    page,
    context,
  }) => {
    // 1. Régulatrice crée la demande
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('alpha-reg@test.tap');
    await page.getByLabel(/mot de passe/i).fill('test1234!');
    await page.getByRole('button', { name: /se connecter|connexion/i }).click();

    await page.goto('/admin/legal/requests');
    await page.getByRole('button', { name: /nouvelle demande|nouveau/i }).click();
    await page.getByLabel(/patient/i).fill('Hoarau');
    await page.getByRole('option', { name: /hoarau/i }).first().click();
    await page.getByLabel(/type de demande/i).selectOption('acces');
    await page
      .getByLabel(/email du demandeur/i)
      .fill('marie.hoarau@test.tap');
    await page.getByRole('button', { name: /créer|envoyer/i }).click();

    // Récupération du token via API helper (fourni par le seed E2E)
    const tokenResponse = await page.request.get(
      '/api/test/last-data-request-token',
    );
    expect(tokenResponse.ok()).toBe(true);
    const { token } = (await tokenResponse.json()) as { token: string };
    expect(token).toBeTruthy();

    // 2. Le patient ouvre le lien dans un contexte anonyme (pas de session)
    const anonPage = await context.newPage();
    await anonPage.context().clearCookies();
    await anonPage.goto(`/legal/request/${token}`);

    // 3. Vérification identité
    await anonPage.getByLabel(/nir/i).fill('1801234567823');
    await anonPage.getByLabel(/nom/i).fill('Hoarau');
    await anonPage
      .getByLabel(/date de naissance/i)
      .fill('1980-01-23');
    await anonPage
      .getByRole('button', { name: /v[ée]rifier|valider/i })
      .click();

    // 4. Page export visible avec bouton « Télécharger JSON »
    await expect(
      anonPage.getByRole('button', { name: /t[ée]l[ée]charger json/i }),
    ).toBeVisible();

    // Téléchargement et vérification du JSON
    const [download] = await Promise.all([
      anonPage.waitForEvent('download'),
      anonPage
        .getByRole('button', { name: /t[ée]l[ée]charger json/i })
        .click(),
    ]);
    const path = await download.path();
    expect(path).toBeTruthy();

    // Lecture du contenu via fetch interne du navigateur
    const exportJson = await anonPage.evaluate(async (p) => {
      const r = await fetch(`file://${p}`);
      return r.json();
    }, path);

    expect(exportJson).toMatchObject({
      format_version: '1.0',
    });
    // Champ nir doit être null tant que l'utilisateur ne déclenche pas
    // explicitement le déchiffrement (Edge Function avec audit log)
    expect(exportJson.patient?.nir ?? null).toBeNull();
  });
});
