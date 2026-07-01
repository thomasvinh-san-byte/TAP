'use client';

import * as React from 'react';
import { Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateOrganizationSiretAction, exportFecAction } from '../actions';

/**
 * Section « Comptabilité — export FEC » de la facturation (EXPORT-01, §5.23).
 *
 * Regroupe le prérequis (SIRET de la société, dont le SIREN forme les 9
 * premiers chiffres, requis au nommage réglementaire) et l'export FEC du mois
 * sélectionné. Le fichier est un texte à plat conforme (18 champs, séparateur
 * pipe) téléchargé côté client, sur le modèle de l'export CSV.
 */

interface Props {
  mois: string;
  siret: string | null;
}

export function FecExportSection({ mois, siret }: Props): JSX.Element {
  const [currentSiret, setCurrentSiret] = React.useState<string | null>(siret);
  const [editing, setEditing] = React.useState(siret === null);
  const [draft, setDraft] = React.useState(siret ?? '');
  const [savingSiret, setSavingSiret] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  async function saveSiret() {
    setSavingSiret(true);
    const res = await updateOrganizationSiretAction({ siret: draft.trim() });
    setSavingSiret(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setCurrentSiret(draft.trim());
    setEditing(false);
    toast.success('SIRET enregistré.');
  }

  async function exportFec() {
    setExporting(true);
    const res = await exportFecAction({ mois });
    setExporting(false);
    if (res.error || !res.content || !res.filename) {
      toast.error(res.error ?? 'Export impossible.');
      return;
    }
    const blob = new Blob([res.content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(
      res.entryCount === 0
        ? 'FEC généré (aucun encaissement sur la période).'
        : `FEC généré : ${res.entryCount} écriture${res.entryCount! > 1 ? 's' : ''}.`,
    );
  }

  const siren = currentSiret ? currentSiret.slice(0, 9) : null;

  return (
    <section className="border-border bg-background space-y-16 rounded-lg border p-16 sm:p-24">
      <div className="flex items-center gap-8">
        <FileText className="text-muted-foreground h-16 w-16" aria-hidden />
        <h2 className="text-base font-semibold">Comptabilité — export FEC</h2>
      </div>
      <p className="text-muted-foreground text-sm">
        Fichier des écritures comptables (format réglementaire) des ventes encaissées du mois. Ce
        FEC couvre les encaissements connus de l’outil (débit trésorerie, crédit prestations) — il
        ne remplace pas la comptabilité complète de la société. Les comptes par défaut suivent le
        plan comptable général et sont à confirmer avec votre comptable.
      </p>

      {editing ? (
        <div className="space-y-8">
          <Label htmlFor="siret-input">SIRET de la société (14 chiffres)</Label>
          <div className="flex flex-wrap items-center gap-8">
            <Input
              id="siret-input"
              inputMode="numeric"
              autoComplete="off"
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 14))}
              placeholder="12345678900012"
              className="max-w-[220px] tabular-nums"
            />
            <Button type="button" onClick={() => void saveSiret()} disabled={savingSiret}>
              {savingSiret ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            {currentSiret && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setDraft(currentSiret);
                  setEditing(false);
                }}
                disabled={savingSiret}
              >
                Annuler
              </Button>
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            Le SIREN (9 premiers chiffres) sert au nom réglementaire du fichier.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-8">
          <div className="text-sm">
            <span className="text-muted-foreground">SIRET : </span>
            <span className="font-medium tabular-nums">{currentSiret}</span>
            {siren && <span className="text-muted-foreground"> · SIREN {siren}</span>}
          </div>
          <Button type="button" variant="ghost" onClick={() => setEditing(true)}>
            Modifier
          </Button>
        </div>
      )}

      <div className="border-border border-t pt-16">
        <Button
          type="button"
          variant="outline"
          onClick={() => void exportFec()}
          disabled={exporting || !currentSiret}
          className="gap-8"
          title={
            currentSiret
              ? `Exporter le FEC de ${mois}`
              : 'Renseignez le SIRET pour activer l’export FEC'
          }
        >
          <Download className="h-12 w-12" aria-hidden />
          {exporting ? 'Génération…' : `Exporter le FEC (${mois})`}
        </Button>
      </div>
    </section>
  );
}
