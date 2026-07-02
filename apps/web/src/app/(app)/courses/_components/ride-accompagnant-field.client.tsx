'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 *
 * Case oui/non ; si oui → facturation (gratuit/payant) + identité libre.
 * Le coût d'un accompagnant payant est appliqué via la grille tarifaire
 * (supplément paramétrable), jamais hardcodé. Désactiver l'accompagnant
 * réinitialise les sous-champs côté parent (cohérence).
 */
interface Props {
  present: boolean;
  payant: boolean;
  identite: string;
  onPresentChange: (v: boolean) => void;
  onPayantChange: (v: boolean) => void;
  onIdentiteChange: (v: string) => void;
}

export function AccompagnantField({
  present,
  payant,
  identite,
  onPresentChange,
  onPayantChange,
  onIdentiteChange,
}: Props): JSX.Element {
  return (
    <div className="border-border space-y-12 rounded-md border p-12">
      <div className="flex items-center gap-12">
        <Checkbox
          id="accompagnant"
          checked={present}
          onChange={(e) => onPresentChange(e.target.checked)}
        />
        <Label htmlFor="accompagnant">Accompagnant</Label>
      </div>

      {present && (
        <div className="space-y-12 pl-24">
          <div className="flex items-center gap-12">
            <Checkbox
              id="accompagnant_payant"
              checked={payant}
              onChange={(e) => onPayantChange(e.target.checked)}
            />
            <Label htmlFor="accompagnant_payant">
              Accompagnant payant (supplément appliqué au tarif)
            </Label>
          </div>
          <div className="space-y-8">
            <Label htmlFor="accompagnant_identite">
              Identité de l&apos;accompagnant (facultatif)
            </Label>
            <Input
              id="accompagnant_identite"
              value={identite}
              onChange={(e) => onIdentiteChange(e.target.value)}
              maxLength={120}
              placeholder="Nom de l'accompagnant"
            />
          </div>
        </div>
      )}
    </div>
  );
}
