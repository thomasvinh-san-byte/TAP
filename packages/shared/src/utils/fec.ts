/**
 * Génération de l'export comptable FEC — EXPORT-01 (§5.23).
 *
 * FEC = Fichier des Écritures Comptables, format réglementaire strict (article
 * A47 A-1 du Livre des procédures fiscales). Util PUR sans dépendance, testable
 * isolément (Vitest) et réutilisé par la Server Action côté web.
 *
 * Périmètre comptable ASSUMÉ (Étape 0) : ce FEC couvre les VENTES ENCAISSÉES
 * que TAP connaît (une écriture par encaissement : débit trésorerie / crédit
 * ventes de prestations). Ce n'est PAS la comptabilité exhaustive de
 * l'entreprise (pas de TVA, pas de contreparties tierces, pas de plan comptable
 * complet). Les numéros de compte sont PARAMÉTRABLES ; les valeurs par défaut
 * suivent le PCG français mais sont À CONFIRMER par le comptable de la société.
 *
 * Conformité de structure (non négociable) :
 *   - 18 champs, dans l'ordre imposé, noms exacts en ligne d'en-tête
 *   - fichier texte à plat, séparateur PIPE `|` (jamais le point-virgule)
 *   - dates AAAAMMJJ sans séparateur ; montants à virgule décimale, 2 décimales
 *   - nommage `SIREN` + `FEC` + `AAAAMMJJ` (clôture) + `.txt`
 *   - écritures numérotées sans rupture ; chaque écriture équilibrée (D = C)
 *
 * Pas de donnée médicale : le FEC est comptable (montant, mode de règlement,
 * référence de pièce). Aucun nom patient, aucune note.
 */

/** Les 18 champs FEC, dans l'ordre réglementaire imposé. */
export const FEC_FIELDS = [
  'JournalCode',
  'JournalLib',
  'EcritureNum',
  'EcritureDate',
  'CompteNum',
  'CompteLib',
  'CompAuxNum',
  'CompAuxLib',
  'PieceRef',
  'PieceDate',
  'EcritureLib',
  'Debit',
  'Credit',
  'EcritureLet',
  'DateLet',
  'ValidDate',
  'Montantdevise',
  'Idevise',
] as const;

/** Séparateur réglementaire retenu : le pipe (le point-virgule est refusé). */
export const FEC_SEPARATOR = '|';

export type FecPaymentMethod = 'cash' | 'cb' | 'cheque' | 'cgss_differe';

/** Plan de comptes paramétrable (numéros + libellés). */
export interface FecAccountConfig {
  journalCode: string;
  journalLib: string;
  compteVenteNum: string;
  compteVenteLib: string;
  compteCaisseNum: string;
  compteCaisseLib: string;
  compteBanqueNum: string;
  compteBanqueLib: string;
  compteClientCgssNum: string;
  compteClientCgssLib: string;
}

/**
 * Valeurs par défaut du plan comptable général français. À CONFIRMER par le
 * comptable (chaque entreprise a son propre plan) — d'où le caractère
 * paramétrable de `FecAccountConfig`.
 */
export const DEFAULT_FEC_ACCOUNTS: FecAccountConfig = {
  journalCode: 'VE',
  journalLib: 'Ventes encaissées',
  compteVenteNum: '706000', // PCG 706 — prestations de services
  compteVenteLib: 'Prestations de services - transport',
  compteCaisseNum: '531000', // PCG 53 — caisse
  compteCaisseLib: 'Caisse',
  compteBanqueNum: '512000', // PCG 512 — banque
  compteBanqueLib: 'Banque',
  compteClientCgssNum: '411000', // PCG 411 — clients (CGSS en règlement différé)
  compteClientCgssLib: 'Clients - CGSS',
};

const METHOD_LABEL: Record<FecPaymentMethod, string> = {
  cash: 'espèces',
  cb: 'carte bancaire',
  cheque: 'chèque',
  cgss_differe: 'CGSS différé',
};

/** Un encaissement source (donnée métier, sans médical). */
export interface FecEncaissement {
  /** Référence de la pièce justificative (identifiant de course). */
  pieceRef: string;
  /** Date de l'encaissement (ISO). Sert d'EcritureDate et de PieceDate. */
  date: string;
  /** Montant réglé en euros (> 0). */
  amountEur: number;
  method: FecPaymentMethod;
}

export interface FecGenerationInput {
  /** SIREN de l'organisation (9 chiffres) — nommage réglementaire du fichier. */
  siren: string;
  /** Date de clôture de la période (ISO) — nom de fichier + ValidDate. */
  clotureDate: string;
  encaissements: FecEncaissement[];
  /** Plan de comptes ; par défaut `DEFAULT_FEC_ACCOUNTS`. */
  accounts?: FecAccountConfig;
}

export interface FecGenerationResult {
  filename: string;
  content: string;
  /** Nombre de lignes d'écriture (hors en-tête). */
  lineCount: number;
  /** Nombre d'écritures (chacune = 2 lignes équilibrées). */
  entryCount: number;
  totalDebit: number;
  totalCredit: number;
  /** Équilibre global : total débit = total crédit (aux arrondis près). */
  balanced: boolean;
}

/** AAAAMMJJ (UTC) — format de date FEC sans séparateur. */
export function formatFecDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

/** Montant à 2 décimales, virgule décimale, sans séparateur de milliers. */
export function formatFecAmount(n: number): string {
  return n.toFixed(2).replace('.', ',');
}

/**
 * Neutralise les caractères qui casseraient la structure à plat (séparateur,
 * retours à la ligne, tabulation) dans un champ texte libre.
 */
function sanitizeFecField(value: string): string {
  return value.replace(/[|\t\r\n]/g, ' ').trim();
}

/** Compte de trésorerie/créance mis au débit selon le mode de règlement. */
function debitAccount(
  method: FecPaymentMethod,
  cfg: FecAccountConfig,
): { num: string; lib: string } {
  switch (method) {
    case 'cash':
      return { num: cfg.compteCaisseNum, lib: cfg.compteCaisseLib };
    case 'cb':
    case 'cheque':
      return { num: cfg.compteBanqueNum, lib: cfg.compteBanqueLib };
    case 'cgss_differe':
      return { num: cfg.compteClientCgssNum, lib: cfg.compteClientCgssLib };
  }
}

function fieldsToLine(fields: Record<(typeof FEC_FIELDS)[number], string>): string {
  return FEC_FIELDS.map((f) => sanitizeFecField(fields[f])).join(FEC_SEPARATOR);
}

/**
 * Génère le fichier FEC des ventes encaissées de la période.
 *
 * Chaque encaissement produit UNE écriture équilibrée de deux lignes partageant
 * le même `EcritureNum` : débit trésorerie (ou créance CGSS), crédit ventes.
 * Les écritures sont numérotées chronologiquement, sans rupture.
 *
 * @throws si le SIREN n'est pas composé de 9 chiffres (nommage non conforme).
 */
export function generateFec(input: FecGenerationInput): FecGenerationResult {
  if (!/^\d{9}$/.test(input.siren)) {
    throw new Error('SIREN invalide : 9 chiffres attendus.');
  }
  const cfg = input.accounts ?? DEFAULT_FEC_ACCOUNTS;
  const validDate = formatFecDate(input.clotureDate);

  // Tri chronologique stable (date puis pieceRef) pour une numérotation sans
  // inversion ni trou, reproductible.
  const sorted = [...input.encaissements].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.pieceRef < b.pieceRef ? -1 : a.pieceRef > b.pieceRef ? 1 : 0;
  });

  const lines: string[] = [];
  let totalDebit = 0;
  let totalCredit = 0;
  let ecritureNum = 0;

  for (const enc of sorted) {
    const amount = Math.round(enc.amountEur * 100) / 100;
    if (!(amount > 0)) continue; // pas d'écriture pour un montant nul/invalide

    ecritureNum += 1;
    const ecritureDate = formatFecDate(enc.date);
    const num = String(ecritureNum);
    const pieceRef = enc.pieceRef;
    const lib = `Encaissement transport (${METHOD_LABEL[enc.method]})`;
    const debit = debitAccount(enc.method, cfg);

    const base = {
      JournalCode: cfg.journalCode,
      JournalLib: cfg.journalLib,
      EcritureNum: num,
      EcritureDate: ecritureDate,
      CompAuxNum: '',
      CompAuxLib: '',
      PieceRef: pieceRef,
      PieceDate: ecritureDate,
      EcritureLib: lib,
      EcritureLet: '',
      DateLet: '',
      ValidDate: validDate,
      Montantdevise: '',
      Idevise: '',
    };

    // Ligne 1 — débit trésorerie / créance.
    lines.push(
      fieldsToLine({
        ...base,
        CompteNum: debit.num,
        CompteLib: debit.lib,
        Debit: formatFecAmount(amount),
        Credit: formatFecAmount(0),
      }),
    );
    // Ligne 2 — crédit ventes de prestations.
    lines.push(
      fieldsToLine({
        ...base,
        CompteNum: cfg.compteVenteNum,
        CompteLib: cfg.compteVenteLib,
        Debit: formatFecAmount(0),
        Credit: formatFecAmount(amount),
      }),
    );

    totalDebit += amount;
    totalCredit += amount;
  }

  const header = FEC_FIELDS.join(FEC_SEPARATOR);
  const content = [header, ...lines].join('\r\n');
  totalDebit = Math.round(totalDebit * 100) / 100;
  totalCredit = Math.round(totalCredit * 100) / 100;

  return {
    filename: `${input.siren}FEC${validDate}.txt`,
    content,
    lineCount: lines.length,
    entryCount: ecritureNum,
    totalDebit,
    totalCredit,
    balanced: Math.abs(totalDebit - totalCredit) < 0.005,
  };
}
