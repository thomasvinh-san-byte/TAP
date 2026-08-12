'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { FileText, Save, Upload } from 'lucide-react';
import {
  COMPLIANCE_KINDS_BY_ENTITY,
  COMPLIANCE_LABELS,
  type ComplianceEntityType,
  type ComplianceKind,
} from '@tap/shared';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DateFieldFr } from '@/components/date-field-fr.client';
import { ComplianceBadge } from '@/components/ui/compliance-badge';
import {
  listComplianceItemsForEntityAction,
  upsertComplianceItemAction,
  uploadComplianceDocumentAction,
  getComplianceDocumentUrlAction,
  type ComplianceItemRow,
} from '../actions';

/**
 * <ComplianceFieldset> — section « Conformité » embarquée dans driver-form
 * et vehicle-form (Phase 06.33, DEC-112 D-03).
 *
 * Pré-définit les slots attendus par entité (3 pour chauffeur, 4 pour
 * véhicule, 1 pour organisation). Chaque slot expose deux dates :
 * délivrance (`issued_at`) et échéance (`expires_at`). Save inline via
 * Server Action `upsertComplianceItemAction` (un par slot modifié).
 *
 * Statut visible côté droit via `<ComplianceBadge>` — dérivé, jamais
 * stocké (DEC-112 D-04).
 *
 * Pour les NOUVELLES entités (entityId null), la section affiche un
 * placeholder — la conformité se saisit après création (UUID requis).
 */

interface Props {
  entityType: ComplianceEntityType;
  entityId: string | null;
  /** Items existants pré-chargés (Server Component parent) ; sinon chargés à mount. */
  initialItems?: ComplianceItemRow[];
  /**
   * Échafaudage upload (DEC-143) — évalué CÔTÉ SERVEUR (`UPLOAD_DOCS_ENABLED`)
   * et passé en prop. OFF par défaut : zone de dépôt non câblée (pré-HDS).
   */
  uploadEnabled?: boolean;
}

interface SlotState {
  id?: string;
  reference: string;
  issued_at: string;
  expires_at: string;
  document_url: string;
}

function findItem(items: ComplianceItemRow[], kind: ComplianceKind): ComplianceItemRow | null {
  return items.find((it) => it.kind === kind) ?? null;
}

function initialSlot(item: ComplianceItemRow | null): SlotState {
  return {
    id: item?.id,
    reference: item?.reference ?? '',
    issued_at: item?.issued_at ?? '',
    expires_at: item?.expires_at ?? '',
    document_url: item?.document_url ?? '',
  };
}

export function ComplianceFieldset({
  entityType,
  entityId,
  initialItems,
  uploadEnabled = false,
}: Props): JSX.Element {
  const kinds = COMPLIANCE_KINDS_BY_ENTITY[entityType];
  const [pending, startTransition] = useTransition();
  const [slots, setSlots] = useState<Record<ComplianceKind, SlotState>>(() => {
    const out: Partial<Record<ComplianceKind, SlotState>> = {};
    for (const k of kinds) out[k] = initialSlot(findItem(initialItems ?? [], k));
    return out as Record<ComplianceKind, SlotState>;
  });

  // Si pas d'items pré-chargés ET entité existante, charger à mount via SA.
  useEffect(() => {
    if (initialItems !== undefined) return;
    if (!entityId && entityType !== 'organization') return;
    let cancelled = false;
    void listComplianceItemsForEntityAction(entityType, entityId).then((res) => {
      if (cancelled || res.error) return;
      setSlots((prev) => {
        const next = { ...prev };
        for (const k of kinds) {
          const found = res.items.find((it) => it.kind === k);
          if (found) next[k] = initialSlot(found);
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  if (!entityId && entityType !== 'organization') {
    return (
      <fieldset className="border-border space-y-8 rounded-md border p-16">
        <legend className="text-base font-semibold">Conformité réglementaire</legend>
        <p className="text-muted-foreground text-sm">
          Les échéances pourront être saisies après création de la fiche.
        </p>
      </fieldset>
    );
  }

  function setField(kind: ComplianceKind, field: keyof SlotState, value: string) {
    setSlots((prev) => ({ ...prev, [kind]: { ...prev[kind], [field]: value } }));
  }

  function save(kind: ComplianceKind) {
    const slot = slots[kind];
    startTransition(async () => {
      const res = await upsertComplianceItemAction({
        id: slot.id,
        entity_type: entityType,
        entity_id: entityId,
        kind,
        reference: slot.reference,
        issued_at: slot.issued_at,
        expires_at: slot.expires_at,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (res.id && !slot.id) {
        // Première création : on retient l'id pour les prochains saves.
        setSlots((prev) => ({ ...prev, [kind]: { ...prev[kind], id: res.id } }));
      }
      toast.success('Échéance enregistrée.');
    });
  }

  return (
    <fieldset className="border-border space-y-16 rounded-md border p-16">
      <legend className="text-base font-semibold">Conformité réglementaire</legend>
      <p className="text-muted-foreground text-sm">
        Suivi des échéances obligatoires. Les alertes (90/60/30/7 jours) et le blocage de
        planification arriveront en lot 2 et 3.
      </p>

      <div className="space-y-16">
        {kinds.map((kind) => {
          const slot = slots[kind];
          const issuedId = `compliance-${kind}-issued`;
          const expiresId = `compliance-${kind}-expires`;
          const refId = `compliance-${kind}-ref`;
          const docId = `compliance-${kind}-doc`;
          return (
            <div key={kind} className="border-border space-y-8 rounded-md border p-12">
              <div className="flex flex-wrap items-center justify-between gap-8">
                <h3 className="text-sm font-semibold">{COMPLIANCE_LABELS[kind]}</h3>
                {slot.expires_at && <ComplianceBadge expiresAt={slot.expires_at} />}
              </div>

              <div className="grid gap-12 sm:grid-cols-3">
                <div className="space-y-4">
                  <Label htmlFor={refId}>Référence (optionnel)</Label>
                  <input
                    id={refId}
                    type="text"
                    value={slot.reference}
                    onChange={(e) => setField(kind, 'reference', e.target.value)}
                    placeholder="N° de document"
                    className="border-input bg-background focus-visible:ring-ring h-10 w-full rounded-md border px-12 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  />
                </div>
                <div className="space-y-4">
                  <Label htmlFor={issuedId}>Date de délivrance</Label>
                  <DateFieldFr
                    id={issuedId}
                    name={issuedId}
                    value={slot.issued_at}
                    onChange={(v) => setField(kind, 'issued_at', v)}
                  />
                </div>
                <div className="space-y-4">
                  <Label htmlFor={expiresId}>Date d&apos;échéance</Label>
                  <DateFieldFr
                    id={expiresId}
                    name={expiresId}
                    value={slot.expires_at}
                    onChange={(v) => setField(kind, 'expires_at', v)}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <Label htmlFor={docId}>Document justificatif</Label>
                {slot.document_url ? (
                  <ComplianceDocViewLink id={docId} path={slot.document_url} />
                ) : uploadEnabled ? (
                  <ComplianceDocUpload
                    inputId={docId}
                    entityType={entityType}
                    entityId={entityId}
                    kind={kind}
                    itemId={slot.id}
                    onUploaded={(path, id) =>
                      setSlots((prev) => ({
                        ...prev,
                        [kind]: { ...prev[kind], document_url: path, id },
                      }))
                    }
                  />
                ) : (
                  <p id={docId} className="text-muted-foreground text-sm" aria-disabled="true">
                    Téléversement désactivé.
                  </p>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => save(kind)}
                  disabled={pending}
                  className="gap-8"
                >
                  <Save className="h-12 w-12" aria-hidden />
                  {pending ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Zone de dépôt RÉELLE d'un justificatif (flag `UPLOAD_DOCS_ENABLED` ON).
 * Envoie le fichier + le contexte (entité, type d'échéance, id éventuel) à
 * `uploadComplianceDocumentAction` (validation + upload Storage privé + persist
 * du chemin). Au succès, remonte le chemin persisté au parent.
 */
function ComplianceDocUpload({
  inputId,
  entityType,
  entityId,
  kind,
  itemId,
  onUploaded,
}: {
  inputId: string;
  entityType: ComplianceEntityType;
  entityId: string | null;
  kind: ComplianceKind;
  itemId?: string;
  onUploaded: (path: string, id: string) => void;
}): JSX.Element {
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleUpload() {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      toast.error('Sélectionnez un fichier (PDF, JPEG ou PNG).');
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set('file', file);
      fd.set('entity_type', entityType);
      if (entityId) fd.set('entity_id', entityId);
      fd.set('kind', kind);
      if (itemId) fd.set('item_id', itemId);
      const res = await uploadComplianceDocumentAction(fd);
      if (res.error || !res.path || !res.id) {
        toast.error(res.error ?? 'Téléversement impossible.');
        return;
      }
      toast.success('Document téléversé.');
      onUploaded(res.path, res.id);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-8">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        aria-label="Document justificatif à téléverser"
        className="text-muted-foreground file:bg-muted file:text-foreground text-sm file:mr-8 file:rounded-md file:border-0 file:px-12 file:py-4 file:text-sm"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleUpload}
        disabled={pending}
        className="gap-8"
      >
        <Upload className="h-12 w-12" aria-hidden />
        {pending ? 'Téléversement…' : 'Téléverser'}
      </Button>
    </div>
  );
}

/**
 * Lien « Voir le document » — bucket PRIVÉ : on demande une URL SIGNÉE courte à
 * la volée (pas d'URL publique stockée), puis on l'ouvre. Gère le document
 * absent / expiré.
 */
function ComplianceDocViewLink({ id, path }: { id: string; path: string }): JSX.Element {
  const [pending, startTransition] = useTransition();

  function open() {
    startTransition(async () => {
      const res = await getComplianceDocumentUrlAction(path);
      if (res.error || !res.url) {
        toast.error(res.error ?? 'Document indisponible.');
        return;
      }
      window.open(res.url, '_blank', 'noopener,noreferrer');
    });
  }

  return (
    <button
      id={id}
      type="button"
      onClick={open}
      disabled={pending}
      className="text-primary hover:text-primary/80 focus-visible:ring-ring inline-flex items-center gap-4 rounded text-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2"
    >
      <FileText className="h-12 w-12" aria-hidden />
      {pending ? 'Ouverture…' : 'Voir le document'}
    </button>
  );
}
