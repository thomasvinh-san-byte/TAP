// =============================================================================
// E2E Playwright — Flow patient complet (Phase 1, Wave 0 RED scaffold)
// =============================================================================
// État RED en Wave 0 : apps/web/app/* inexistant. Wave 3 (UI patient) fera
// passer ce test au vert.
//
// Couverture (PAT-01, PAT-03, PAT-04, PAT-05, PAT-07) :
//   1. Création fiche patient via /patients/new
//   2. Recherche fuzzy : 1 char ne déclenche rien, 2 chars trouve "Hoarau"
//   3. Drawer 400 px largeur fixe (D-12)
//   4. NIR masqué format 1•••••••••76 23 par défaut (D-05)
//   5. Édition canal préféré → SMS + consentement
//   6. Audit_logs reçoit patient.update sans nir_encrypted (D-20)
// =============================================================================

import { test, expect } from '@playwright/test';
import { loginAsRegulateur } from './helpers/auth';

test('régulatrice : créer → rechercher fuzzy 2 chars → drawer → édition → audit', async ({
  page,
}) => {
  await loginAsRegulateur(page);

  // ---------------------------------------------------------------------------
  // 1. Création
  // ---------------------------------------------------------------------------
  await page.goto('/patients/new');
  await page.getByLabel('Nom').fill('Hoarau');
  await page.getByLabel('Prénom').fill('Patrick');
  await page.getByLabel('Date de naissance').fill('1980-01-23');
  await page.getByLabel('NIR').fill('1801234567823');
  await page.getByLabel('Adresse').fill('12 rue Pasteur');
  await page.getByLabel('Code postal').fill('97400');
  await page.getByLabel('Ville').fill('Saint-Denis');
  await page.getByRole('button', { name: /créer/i }).click();
  await expect(page).toHaveURL(/\/patients\/[0-9a-f-]{36}$/);

  // ---------------------------------------------------------------------------
  // 2. Recherche fuzzy : seuil 2 caractères (DEC-015)
  // ---------------------------------------------------------------------------
  await page.goto('/patients');
  const search = page.getByPlaceholder(/rechercher/i);
  await search.fill('h');
  // 1 char ne déclenche pas la requête
  await expect(page.getByText('Hoarau Patrick')).toHaveCount(0);
  await search.fill('ho');
  // debounce 150 ms : doit apparaître < 1 s
  await expect(page.getByText('Hoarau Patrick')).toBeVisible({ timeout: 1000 });

  // ---------------------------------------------------------------------------
  // 3. Drawer 400 px (D-12)
  // ---------------------------------------------------------------------------
  await page.getByText('Hoarau Patrick').click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();
  const box = await drawer.boundingBox();
  expect(box?.width).toBe(400);
  // NIR masqué par défaut, format 1•••••••••76 23 (D-05)
  await expect(drawer.getByText(/1•••••••••\d{2}\s*\d{2}/)).toBeVisible();

  // ---------------------------------------------------------------------------
  // 4. Édition canal préféré
  // ---------------------------------------------------------------------------
  await drawer.getByRole('link', { name: /voir la fiche complète/i }).click();
  await page.getByRole('link', { name: /modifier/i }).click();
  await page.getByLabel('Canal préféré').selectOption('sms');
  await page.getByLabel('Consentement SMS').check();
  await page.getByRole('button', { name: /enregistrer/i }).click();

  // ---------------------------------------------------------------------------
  // 5. Audit_logs : vérif via API service_role
  // ---------------------------------------------------------------------------
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const res = await fetch(
    `${supabaseUrl}/rest/v1/audit_logs?action=eq.patient.update&order=created_at.desc&limit=1`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    },
  );
  const rows = (await res.json()) as Array<{
    action: string;
    metadata: { new?: Record<string, unknown> };
  }>;
  expect(rows[0]?.action).toBe('patient.update');
  expect(rows[0]?.metadata?.new).not.toHaveProperty('nir_encrypted');
});
