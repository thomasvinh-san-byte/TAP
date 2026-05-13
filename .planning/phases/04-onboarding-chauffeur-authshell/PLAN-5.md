---
phase: 04-onboarding-chauffeur-authshell
plan: 5
wave: 4
order_in_wave: 1
depends_on: [4]
files_modified:
  - apps/web/tests/e2e/accept-invitation-happy-path.spec.ts
  - apps/web/tests/e2e/accept-invitation-token-expired.spec.ts
  - apps/web/tests/e2e/helpers/inbucket.ts
  - docs/showcase/04-onboarding-chauffeur-authshell/login-jour.png
  - docs/showcase/04-onboarding-chauffeur-authshell/accept-invite.png
  - .planning/phases/04-onboarding-chauffeur-authshell/04-SUMMARY.md
autonomous: false
requirements:
  - CHAUF-01
  - CHAUF-02
  - CHAUF-03
  - CHAUF-04
  - NFR-001
  - NFR-002
  - NFR-006
estimated_minutes: 60
covers_constraints:
  - C08
  - C09
---

# PLAN-5 — Tests Playwright (happy path + token expired) + Captures Visible Progress + Walkthrough

## Objectif

Verrouiller la phase via :

1. **2 tests Playwright E2E** sur le golden path d'invitation (C08) :
   - `accept-invitation-happy-path.spec.ts` — dirigeant invite, chauffeur active, redirect `/conduite`.
   - `accept-invitation-token-expired.spec.ts` — `/accept-invite?error=expired` montre panneau sans form.
2. **2 captures Visible Progress** (C09) dans
   `docs/showcase/04-onboarding-chauffeur-authshell/` :
   - `login-jour.png` — `/login` AuthShell mode jour + DemoCredentials visibles.
   - `accept-invite.png` — `/accept-invite` form complet avec email pré-rempli.
3. **Walkthrough script** + bilan dans `04-SUMMARY.md`.

Ce plan est **partiellement non-autonome** : la production des captures
suppose une vérification humaine sur preview Vercel (dirigeant valide
visuellement avant merge final).

## Files modified

- `apps/web/tests/e2e/accept-invitation-happy-path.spec.ts` — nouveau
- `apps/web/tests/e2e/accept-invitation-token-expired.spec.ts` — nouveau
- `apps/web/tests/e2e/helpers/inbucket.ts` — helper réutilisable pour reset + extract token Inbucket
- `docs/showcase/04-onboarding-chauffeur-authshell/login-jour.png` — capture humaine
- `docs/showcase/04-onboarding-chauffeur-authshell/accept-invite.png` — capture humaine
- `.planning/phases/04-onboarding-chauffeur-authshell/04-SUMMARY.md` — rédaction finale

## Tasks

### 5.1 Helper Inbucket réutilisable

Fichier `apps/web/tests/e2e/helpers/inbucket.ts` :

```ts
import type { APIRequestContext } from '@playwright/test';

const INBUCKET_BASE =
  process.env.INBUCKET_URL ?? 'http://localhost:54324';

/**
 * Reset complet d'une mailbox Inbucket (toutes les invitations test).
 * À appeler en beforeEach (Q4.2).
 */
export async function resetInbucketMailbox(
  request: APIRequestContext,
  mailbox: string,
): Promise<void> {
  // Inbucket API : DELETE /api/v1/mailbox/:mailbox
  await request.delete(`${INBUCKET_BASE}/api/v1/mailbox/${mailbox}`);
}

/**
 * Récupère le dernier email reçu + extrait l'URL d'activation.
 * Polling 10 × 1 s pour laisser l'invitation arriver.
 */
export async function fetchLatestInviteUrl(
  request: APIRequestContext,
  mailbox: string,
): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const res = await request.get(`${INBUCKET_BASE}/api/v1/mailbox/${mailbox}`);
    if (res.ok()) {
      const messages = (await res.json()) as Array<{ id: string }>;
      if (messages.length > 0) {
        const detail = await request.get(
          `${INBUCKET_BASE}/api/v1/mailbox/${mailbox}/${messages[0].id}`,
        );
        const body = (await detail.json()) as { body: { text: string; html: string } };
        const text = body.body.text ?? body.body.html ?? '';
        // Le template Supabase contient {{ .ConfirmationURL }} :
        // → https://<project>.supabase.co/auth/v1/verify?token=...&type=invite&redirect_to=...
        // Ou en local : http://localhost:3000/accept-invite?token_hash=...&type=invite
        const match = text.match(/https?:\/\/[^\s)]+(?:accept-invite|verify)[^\s)]*/);
        if (match) return match[0];
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Aucun email d'invitation reçu pour ${mailbox} après 10s.`);
}
```

### 5.2 Test Playwright — happy path

Fichier `apps/web/tests/e2e/accept-invitation-happy-path.spec.ts` :

```ts
import { test, expect } from '@playwright/test';
import { resetInbucketMailbox, fetchLatestInviteUrl } from './helpers/inbucket';

const TEST_EMAIL = 'chauffeur-test@example.com';
const TEST_MAILBOX = 'chauffeur-test';
const TEST_DRIVER_NAME = 'Chauffeur test'; // NFR-001 aucun nom propre

test.describe('Invitation chauffeur — happy path', () => {
  test.beforeEach(async ({ request }) => {
    // Reset Inbucket avant chaque run (Q4.2)
    await resetInbucketMailbox(request, TEST_MAILBOX);
  });

  test('dirigeant invite → chauffeur active compte → redirect /conduite', async ({
    page,
    request,
  }) => {
    // 1. Login dirigeant démo
    await page.goto('/login');
    await page.getByLabel('Adresse e-mail').fill('dirigeant@demo.tap');
    await page.getByLabel('Mot de passe').fill('demo1234!');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await page.waitForURL(/\/(admin|tableau-de-bord|cockpit)/);

    // 2. Aller créer une fiche chauffeur test
    await page.goto('/admin/chauffeurs');
    await page.getByRole('button', { name: /Nouveau chauffeur|Ajouter/ }).click();
    await page.getByLabel(/Nom/).fill(TEST_DRIVER_NAME);
    // Cocher au moins un type_permis pour passer Zod
    await page.getByLabel(/Taxi/).check();
    await page.getByRole('button', { name: /Enregistrer|Créer/ }).click();
    await expect(page.getByText(TEST_DRIVER_NAME)).toBeVisible();

    // 3. Click bouton Inviter sur la ligne du chauffeur test
    const row = page.getByRole('row', { name: new RegExp(TEST_DRIVER_NAME) });
    await row.getByRole('button', { name: 'Inviter' }).click();
    await page.getByLabel(/Adresse e-mail|Email/).fill(TEST_EMAIL);
    await page.getByRole('button', { name: /Envoyer l'invitation|Inviter/ }).click();
    await expect(page.getByText(/Invitation envoyée|envoyé/i)).toBeVisible();

    // 4. Récupérer l'URL d'invitation depuis Inbucket
    const inviteUrl = await fetchLatestInviteUrl(request, TEST_MAILBOX);
    expect(inviteUrl).toContain('accept-invite');

    // 5. Se déconnecter du dirigeant (purger session) puis ouvrir le lien
    await page.goto('/logout'); // ou clear cookies si /logout pas exposé
    await page.goto(inviteUrl);
    await page.waitForURL(/\/accept-invite/);

    // 6. Vérifier email read-only pré-rempli
    const emailField = page.getByLabel('Adresse e-mail');
    await expect(emailField).toHaveValue(TEST_EMAIL);
    await expect(emailField).toHaveAttribute('readonly', '');

    // 7. Saisir password + confirm + CGU
    await page.getByLabel('Mot de passe').fill('motdepasse-test-123');
    await page.getByLabel('Confirmer le mot de passe').fill('motdepasse-test-123');
    await page.getByLabel(/conditions générales/i).check();

    // 8. Submit
    await page.getByRole('button', { name: 'Activer mon compte' }).click();

    // 9. Assert redirect /conduite
    await page.waitForURL(/\/conduite/);
    await expect(page).toHaveURL(/\/conduite/);

    // 10. Optionnel : vérifier toast success (peut disparaître en 4s)
    // await expect(page.getByText(/Compte activé|Bienvenue/i)).toBeVisible({ timeout: 2000 });
  });
});
```

**Note** : la vérification BDD `drivers.profile_id` rattaché (SC #4)
peut être faite par requête Supabase test client si le helper existe ;
sinon, le redirect `/conduite` (qui n'est accessible qu'aux chauffeurs
authentifiés) suffit comme preuve fonctionnelle.

### 5.3 Test Playwright — token expired

Fichier `apps/web/tests/e2e/accept-invitation-token-expired.spec.ts` :

```ts
import { test, expect } from '@playwright/test';

test.describe('Invitation chauffeur — token expiré', () => {
  test('lien expiré → panneau erreur sans form ni retry', async ({ page }) => {
    // Simule l'erreur via query string (Route Handler GET redirige vers
    // /accept-invite?error=expired si verifyOtp échoue)
    await page.goto('/accept-invite?error=expired');

    // 1. Panneau erreur visible
    await expect(
      page.getByText(/Lien d'invitation expiré|expiré/i),
    ).toBeVisible();

    // 2. Aucun champ password rendu
    await expect(page.getByLabel('Mot de passe')).toHaveCount(0);
    await expect(page.getByLabel('Confirmer le mot de passe')).toHaveCount(0);

    // 3. Aucun bouton de retry self-service
    await expect(
      page.getByRole('button', { name: /Renvoyer|Réessayer|Retry/i }),
    ).toHaveCount(0);

    // 4. Indication factuelle de contacter le régulateur
    await expect(page.getByText(/régulateur|contactez/i)).toBeVisible();
  });

  test('lien invalide → panneau erreur générique', async ({ page }) => {
    await page.goto('/accept-invite?error=invalid_link');
    await expect(
      page.getByText(/invalide|déjà utilisé/i),
    ).toBeVisible();
    await expect(page.getByLabel('Mot de passe')).toHaveCount(0);
  });
});
```

### 5.4 Captures Visible Progress

Production des captures sur **preview Vercel** (CLAUDE.md § 13.5 — pas
de sandbox locale). Procédure pour le dirigeant :

**`docs/showcase/04-onboarding-chauffeur-authshell/login-jour.png`** :

1. Ouvrir la preview Vercel sur `/login` en mode jour.
2. Vérifier que `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS=1` est posé (sinon
   DemoCredentials absent — voir `setup-vercel.yml`).
3. Capture viewport 1280 × 800 (desktop standard) montrant :
   - Colonne identité gauche (logo TAP + baseline + footer)
   - Colonne form droite (titre Connexion + 2 champs + bouton Se connecter)
   - 3 cards DemoCredentials sous le bouton
4. PNG ≤ 500 Ko (compression `pngquant --quality=75-85` si nécessaire).

**`docs/showcase/04-onboarding-chauffeur-authshell/accept-invite.png`** :

1. Suivre le happy path complet (dirigeant invite chauffeur-test) sur
   preview.
2. Ouvrir le lien magic dans un onglet privé.
3. Capture viewport 1280 × 800 montrant :
   - Colonne identité gauche
   - Colonne form droite : titre « Activer mon compte », hint « Définissez
     votre mot de passe… », email read-only pré-rempli, 2 champs password,
     case CGU avec lien, bouton « Activer mon compte »
4. PNG ≤ 500 Ko.

**Vérifications NFR-001** :
- Aucun nom propre réel sur les captures. Les comptes démo
  `dirigeant@demo.tap` / `chauffeur-test@example.com` sont OK (seed démo,
  exception explicite `.planning/regle-neutralite-et-ton.md` § 1).
- Aucun emoji visible.

### 5.5 Rédiger `04-SUMMARY.md`

Fichier `.planning/phases/04-onboarding-chauffeur-authshell/04-SUMMARY.md`.

Structure attendue (pattern phases précédentes) :

```markdown
# Phase 04 — Onboarding chauffeur + AuthShell mode jour — SUMMARY

**Status :** livrée le YYYY-MM-DD
**Plans exécutés :** 5 (PLAN-1 à PLAN-5)
**Critère ADR-003 :** ✓ design partner enchaîne les 5 étapes du
golden path sans intervention dev.

## Periphery (résumé par PLAN)

### PLAN-1 — Cadrage
- DEC-024..028 inscrits dans PROJECT.md
- @hookform/resolvers ^3.x ajouté

### PLAN-2 — Migration BDD
- Table `driver_invitations` 11 colonnes, 3 policies RLS,
  trigger audit_logs (4 actions : driver_invited / _accepted /
  _revoked / _resent)
- 6 tests pgTAP RLS verts
- Schema push appliqué

### PLAN-3 — Server Actions
- `inviteDriverAction` (8 étapes incl. rate limit handling)
- `resendInvitationAction` (anti-race 23h59)
- `acceptInvitationAction` (audit applicatif `cgu_accepted_via_invitation`)
- `driverInvitationSchema` + `acceptInvitationSchema` Zod (DEC-026)

### PLAN-4 — UI
- `<AuthShell>` mode jour (split desktop / single column mobile)
- 4 pages refondues : /login, /welcome, /setup, /accept-invite
- Premier RHF du repo : LoginForm + AcceptInviteForm
- DemoCredentials Client cliquable (prefill via lift state up)
- Bouton Inviter + badge statut 4 états dans drivers-list

### PLAN-5 — Tests + captures
- 2 specs Playwright (happy path + token expired) verts sur preview
- 2 captures `docs/showcase/04-onboarding-chauffeur-authshell/`

## Walkthrough script (5-10 étapes)

1. Aller sur `https://<preview>.vercel.app/login` (mode jour).
2. Cliquer la card « Dirigeant » dans DemoCredentials → champs prefilled.
3. Cliquer « Se connecter » → redirect tableau de bord.
4. Naviguer sur `/admin/chauffeurs`.
5. Créer une fiche chauffeur test (nom : « Chauffeur test », type Taxi).
6. Cliquer le bouton « Inviter » sur la ligne du chauffeur créé,
   saisir `chauffeur-test@example.com`, valider.
7. Toast « Invitation envoyée » visible.
8. Ouvrir Inbucket (http://localhost:54324 en dev, ou boîte mail réelle
   en preview avec SMTP Supabase).
9. Cliquer le lien magic dans l'email → atterrissage `/accept-invite`
   avec email pré-rempli.
10. Saisir password ≥ 8 chars, confirmer, cocher CGU, cliquer « Activer
    mon compte » → redirect `/conduite`.

## Vérification dirigeant (30 min UAT)

- [ ] Walkthrough 1-10 termine sans erreur.
- [ ] Login DemoCredentials cliquable conforme `login-jour.png`.
- [ ] Form `/accept-invite` conforme `accept-invite.png`.
- [ ] Token expiré → panneau erreur sans form.
- [ ] Mobile iPhone SE 375 px : layout single column lisible.

## Risques identifiés / dette transitoire

- Headers HTTP `X-Frame-Options` et `Referrer-Policy` : à vérifier
  dans `next.config.js`. Si absent → tâche Phase 04.5.
- Open redirect `?next=` LoginForm : valider sanitisation dans
  `signInAction` (actions.ts) → tâche Phase 04.5 si non fait.
- 10 captures showcase Phase 03 toujours pending → reportées Phase 04.5
  comme acté C10.
- `pnpm db:types` régénération reportée Phase 04.5.

## Lien preview Vercel

(URL produite par CD post-merge, collée ici par le dirigeant.)

## Captures

![/login mode jour](../../docs/showcase/04-onboarding-chauffeur-authshell/login-jour.png)
![/accept-invite](../../docs/showcase/04-onboarding-chauffeur-authshell/accept-invite.png)
```

### 5.6 Checkpoint humain (avant merge)

`autonomous: false` — ce plan **DOIT** être validé par le dirigeant
avant merge final :

1. Tests Playwright verts dans GitHub Actions `preview-smoke.yml`.
2. Les 2 captures sont posées dans `docs/showcase/` et conformes UI-SPEC § 7.6/7.7/7.8.
3. UAT manuel 30 min effectué, frictions notées dans `04-SUMMARY.md`.
4. URL preview Vercel collée dans le SUMMARY.

### 5.7 Commit final

Message :

```
test(04): playwright invitation chauffeur + captures + SUMMARY (C08+C09)

- helpers/inbucket.ts : reset mailbox + fetch latest invite URL (Q4.2)
- accept-invitation-happy-path.spec.ts : dirigeant invite →
  chauffeur active → redirect /conduite (10 assertions)
- accept-invitation-token-expired.spec.ts : ?error=expired → panneau
  sans form ; ?error=invalid_link → message générique
- docs/showcase/04-onboarding-chauffeur-authshell/login-jour.png (≤ 500 Ko)
- docs/showcase/04-onboarding-chauffeur-authshell/accept-invite.png (≤ 500 Ko)
- 04-SUMMARY.md : walkthrough script + UAT checklist + dette transitoire

Tests verts : 14/14 pgTAP (PLAN-2) + 2/2 Playwright (PLAN-5).
Preview Vercel : <URL>.

Réfs : Phase 04 § PLAN-5, C08, C09, ADR-003, CLAUDE.md § 13.5.
```

## Traçabilité contraintes

| Contrainte | Traitement dans ce plan |
|---|---|
| **C08** (2 tests Playwright : happy path + token expired, reset Inbucket beforeEach) | PLAN-5 §5.1 (helper Inbucket) + §5.2 (happy path 10 assertions) + §5.3 (token expired 2 specs) |
| **C09** (2 captures `login-jour.png` + `accept-invite.png` dans `docs/showcase/`) | PLAN-5 §5.4 (procédure capture preview Vercel + verif NFR-001) |
| **ADR-003** (design partner enchaîne golden path) | PLAN-5 §5.5 (walkthrough 5-10 étapes) + §5.6 (UAT 30 min) |
| **CLAUDE.md § 13.5** (Visible Progress Mandate) | PLAN-5 §5.4 (captures) + §5.5 (SUMMARY + walkthrough + lien preview Vercel) |

## Threat model

ASVS L1 — tests + documentation :

| Item | Évaluation |
|---|---|
| **Tests exposent credentials** | Comptes démo `@demo.tap` + mot de passe `demo1234!` apparaissent dans les specs Playwright. Acceptable : ces credentials sont déjà publics (seedés en preview, affichés DemoCredentials). N'apparaissent JAMAIS en prod commerciale (flag retiré). |
| **Captures fuitent données réelles** | NFR-001 explicite : « Chauffeur test », `chauffeur-test@example.com` — données fictives. Comptes démo `dirigeant@demo.tap` exceptionnellement OK (seed démo). |
| **Inbucket exposé en prod** | Inbucket = service local Supabase dev. En CI il tourne dans le runner GitHub Actions, jamais exposé Internet. Aucune fuite. |
| **Token leakage dans logs Playwright trace** | Playwright trace garde l'URL `?token_hash=...` du happy path. Le trace n'est uploadé que sur échec (artifact GitHub Action) et purge auto 30 jours. Token expire 24h → impact nul. |

Pas de surface code production touchée → pas de STRIDE applicable.

## Verification

- `pnpm exec playwright test apps/web/tests/e2e/accept-invitation-*.spec.ts`
  passe en local (avec Supabase + Inbucket lancés).
- GitHub Action `preview-smoke.yml` exécute les 2 specs sur preview
  cloud et passe vert avant merge (cf. CLAUDE.md § 13.5).
- Les 2 PNG existent dans `docs/showcase/04-onboarding-chauffeur-authshell/`
  et ≤ 500 Ko (commande `du -k docs/showcase/04-*/*.png`).
- `04-SUMMARY.md` contient walkthrough + UAT checklist + URL preview Vercel.

## Success criteria (extrait des 11 SC phase)

Couvre :
- SC #10 (2 tests Playwright passent : happy path + token expired)
- SC #11 (2 captures Visible Progress dans showcase folder)

Verrouille collectivement les SC #1..#9 par exécution réelle du
walkthrough sur preview Vercel.

## Output

Ce plan **conclut** la phase 04. `04-SUMMARY.md` est le livrable final
prêt pour `/gsd-verify-work` ultérieur.
