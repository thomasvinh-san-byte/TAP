'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FormSection } from '@/components/form/form-layout';

interface Props {
  defaultValue?: string;
  maxLength?: number;
}

/**
 * Section « Note opérationnelle » du formulaire patient (B-1, PAT-06).
 * Textarea ≤ 500 caractères + compteur en temps réel (chiffres tabulaires
 * pour stabilité visuelle pendant la frappe — CLAUDE.md § 1). Refondue sur le
 * patron de form partagé + `ui/Textarea` homogène (Phase 06.51, DEC-130).
 */
export function PatientFormNote({ defaultValue = '', maxLength = 500 }: Props) {
  const [value, setValue] = useState(defaultValue);
  return (
    <FormSection title="Note opérationnelle">
      <div className="space-y-8">
        <Label htmlFor="notes_operationnelles">
          Note opérationnelle (codes d&apos;accès, particularités)
        </Label>
        <Textarea
          id="notes_operationnelles"
          name="notes_operationnelles"
          rows={4}
          maxLength={maxLength}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-describedby="notes-help"
        />
        <p id="notes-help" className="text-muted-foreground text-xs tabular-nums">
          {value.length} / {maxLength} caractères
        </p>
      </div>
    </FormSection>
  );
}
