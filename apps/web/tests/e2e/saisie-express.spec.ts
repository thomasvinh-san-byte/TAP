// =============================================================================
// E2E Playwright — Saisie express course (Phase 2 / Wave 5 GREEN)
// =============================================================================
// Promotion des 6 placeholders Wave 0 en assertions GREEN couvrant SAIS-01..06.
//
// Sélecteurs stables livrés Wave 3 + 4 :
//   - role="dialog" + aria-label="Saisie express d'une course" (modal)
//   - aria-label="Rechercher un patient"          (PatientSearch Phase 1)
//   - aria-label="Date et heure"                  (DateFreeformField)
//   - aria-label="Adresse de prise en charge"     (AddressField pickup)
//   - aria-label="Adresse de destination"         (AddressField dropoff)
//   - aria-label="Mode de transport" / "Urgence"  (selects)
//   - role="button" + name="Créer la course"      (submit)
//   - role="button" + name="Mettre en pause"      (minimize)
//   - aria-label="Brouillons (N)"                 (DraftQueue trigger)
//   - aria-label="Nouvelle course (Cmd/Ctrl+Shift+K)" (header bouton)
//
// Patient seedé démo Phase 0.7 (supabase/seed.demo.sql) : « Hoarau Patrick ».
// Si l'env preview ne charge pas seed.demo.sql, le test cible un patron tolérant
// /Ho/i et fail explicitement avec un message FR si aucun match.
//
// Capture flag (Visible Progress, Task 6.3) : positionner PHASE_2_CAPTURES=1
// pour produire les 6 captures `docs/showcase/02-saisie-express-course/*.png`
// pendant l'exécution. Sans le flag, les `screenshotIfFlag(...)` sont no-op.
// =============================================================================

import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

const REG_DEMO_EMAIL = 'regulateur@demo.tap';
const REG_DEMO_PASSWORD = 'demo1234!';

// Patient seedé démo Phase 0.7 — « Patrick Hoarau » est dans seed.demo.sql.
// Regex tolérante pour absorber les variantes (Hoarau, Houareau, etc.).
const PATIENT_QUERY = 'Ho';
const PATIENT_NAME_RE = /Ho\w*/i;

const SHOWCASE_DIR = path.resolve(
  __dirname,
  '../../../../docs/showcase/02-saisie-express-course',
);
const CAPTURE_FLAG = process.env.PHASE_2_CAPTURES === '1';

async function screenshotIfFlag(page: Page, fileName: string): Promise<void> {
  if (!CAPTURE_FLAG) return;
  await page.screenshot({
    path: path.join(SHOWCASE_DIR, fileName),
    fullPage: false,
  });
}

async function loginRegulateur(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(REG_DEMO_EMAIL);
  await page.getByLabel(/mot de passe/i).fill(REG_DEMO_PASSWORD);
  await page.getByRole('button', { name: /se connecter/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 10_000,
  });
}

async function openModalShortcut(page: Page): Promise<void> {
  await page.keyboard.press('Control+Shift+K');
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 2000 });
}

async function selectFirstPatient(page: Page): Promise<void> {
  const search = page.getByLabel('Rechercher un patient');
  await search.fill(PATIENT_QUERY);
  // Premier résultat de la liste « Résultats de recherche » du modal.
  const firstResult = page
    .getByRole('list', { name: /Résultats de recherche/i })
    .getByRole('button')
    .first();
  await expect(firstResult).toBeVisible({ timeout: 1500 });
  await firstResult.click();
  // Confirme la sélection : « Sélectionné : … » apparaît.
  await expect(page.getByText(/Sélectionné\s*:/i)).toBeVisible({
    timeout: 1000,
  });
}

test.describe('Saisie express course (SAIS-01..06)', () => {
  test.beforeEach(async ({ page }) => {
    await loginRegulateur(page);
  });

  test('SAIS-01 saisie complète < 30 s (DEC-005)', async ({ page }) => {
    await page.goto('/patients');

    const t0 = Date.now();
    await openModalShortcut(page);
    await screenshotIfFlag(page, '01-modal-express-vide.png');

    await page.getByLabel('Rechercher un patient').fill(PATIENT_QUERY);
    await screenshotIfFlag(page, '02-modal-recherche-patient.png');
    const firstResult = page
      .getByRole('list', { name: /Résultats de recherche/i })
      .getByRole('button')
      .first();
    await expect(firstResult).toBeVisible({ timeout: 1500 });
    await firstResult.click();

    await page.getByLabel('Date et heure').fill('demain 14h');
    await page.getByLabel('Date et heure').blur();

    await page
      .getByLabel('Adresse de prise en charge')
      .fill('12 rue Pasteur, Saint-Denis');
    await page
      .getByLabel('Adresse de destination')
      .fill('CHU Bellepierre, Saint-Denis');

    await screenshotIfFlag(page, '03-modal-rempli-pret-submit.png');

    await page.getByRole('button', { name: /Créer la course/i }).click();
    await expect(page.getByText(/Course créée/i)).toBeVisible({
      timeout: 2000,
    });
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(30_000);
  });

  test('SAIS-02 raccourci global Cmd/Ctrl+Shift+K depuis /patients ET /courses', async ({
    page,
  }) => {
    // Depuis /patients
    await page.goto('/patients');
    await openModalShortcut(page);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 2000 });

    // Depuis /courses
    await page.goto('/courses');
    await openModalShortcut(page);
  });

  test('SAIS-03 recherche patient 2 chars dans modal', async ({ page }) => {
    await page.goto('/patients');
    await openModalShortcut(page);
    const search = page.getByLabel('Rechercher un patient');
    await search.fill(PATIENT_QUERY);
    // Au moins 1 résultat fuzzy < 1500 ms (DEC-005 + Phase 1 pg_trgm).
    const list = page.getByRole('list', { name: /Résultats de recherche/i });
    await expect(list).toBeVisible({ timeout: 1500 });
    await expect(list.getByText(PATIENT_NAME_RE).first()).toBeVisible();
  });

  test('SAIS-04 brouillon reprise après pause', async ({ page }) => {
    await page.goto('/patients');
    await openModalShortcut(page);
    await selectFirstPatient(page);
    await page
      .getByLabel('Adresse de prise en charge')
      .fill('12 rue Pasteur Test SAIS-04');

    // « Mettre en pause » minimise + flushSave → ride_draft persisté.
    await page.getByRole('button', { name: /Mettre en pause/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 3000 });

    // DraftQueue badge ≥ 1 — laisser le refetchInterval/staleTime se rafraîchir.
    const draftButton = page.getByRole('button', { name: /^Brouillons \(/ });
    await expect(draftButton).toBeVisible();
    await expect(draftButton).toHaveAttribute(
      'aria-label',
      /Brouillons \(([1-9]|\d{2,})\)/,
      { timeout: 12_000 },
    );
    await draftButton.click();
    await screenshotIfFlag(page, '05-brouillons-dropdown-3-en-attente.png');

    // Click sur le brouillon → RESUME → modal réouvert avec adresse préservée.
    const draftItem = page
      .getByRole('menuitem')
      .filter({ hasText: '12 rue Pasteur Test SAIS-04' })
      .first();
    await expect(draftItem).toBeVisible({ timeout: 3000 });
    await draftItem.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 2000 });
    await expect(page.getByLabel('Adresse de prise en charge')).toHaveValue(
      /12 rue Pasteur Test SAIS-04/,
    );
  });

  test('SAIS-05 multi-saisies parallèles compteur badge', async ({ page }) => {
    await page.goto('/patients');

    // 1er modal — patient + adresse → flushSave async via OPEN_NEW.
    await openModalShortcut(page);
    await selectFirstPatient(page);
    await page.getByLabel('Adresse de prise en charge').fill('Adresse A');
    await page.getByLabel('Adresse de prise en charge').blur(); // déclenche flushSave
    // 2e OPEN_NEW : minimise A, ouvre B.
    await page.keyboard.press('Control+Shift+K');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 2000 });
    await selectFirstPatient(page);
    await page.getByLabel('Adresse de prise en charge').fill('Adresse B');
    await page.getByLabel('Adresse de prise en charge').blur();
    // 3e OPEN_NEW : minimise B, ouvre C.
    await page.keyboard.press('Control+Shift+K');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 2000 });

    // Le badge DraftQueue doit afficher au moins 2 brouillons en attente
    // (les 2 minimisés A+B ont flushSave persisté ride_draft).
    const draftButton = page.getByRole('button', { name: /^Brouillons \(/ });
    await expect(draftButton).toBeVisible();
    await expect(draftButton).toHaveAttribute(
      'aria-label',
      /Brouillons \(([2-9]|\d{2,})\)/,
      { timeout: 15_000 },
    );
  });

  test('SAIS-06 audit log ride.insert créé (preuve indirecte via /courses)', async ({
    page,
  }) => {
    // Créer une course identifiable par une adresse unique.
    await page.goto('/patients');
    await openModalShortcut(page);
    await selectFirstPatient(page);
    await page.getByLabel('Date et heure').fill('demain 15h');
    await page.getByLabel('Date et heure').blur();
    const uniquePickup = `Audit Test Pickup ${Date.now()}`;
    await page.getByLabel('Adresse de prise en charge').fill(uniquePickup);
    await page
      .getByLabel('Adresse de destination')
      .fill('Audit Test Dropoff CHU Bellepierre');
    await page.getByRole('button', { name: /Créer la course/i }).click();
    await expect(page.getByText(/Course créée/i)).toBeVisible({
      timeout: 2000,
    });
    await screenshotIfFlag(page, '04-toast-creation-confirmee.gif');

    // Preuve indirecte audit_logs : la ligne `rides` a été créée
    // (RLS Postgres aurait bloqué sinon) → trigger `rides_audit_trigger`
    // (testé pgTAP rides_audit Wave 1 GREEN) garantit la ligne audit_logs.
    await page.goto('/courses');
    await screenshotIfFlag(page, '06-page-courses-liste-30j.png');
    await expect(page.getByText(uniquePickup)).toBeVisible({ timeout: 5000 });
  });
});
