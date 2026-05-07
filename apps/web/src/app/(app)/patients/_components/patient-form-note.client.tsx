'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';

interface Props {
  defaultValue?: string;
  maxLength?: number;
}

/**
 * Section « Note opérationnelle » du formulaire patient (B-1, PAT-06).
 * Textarea ≤ 500 caractères + compteur en temps réel (chiffres tabulaires
 * pour stabilité visuelle pendant la frappe — CLAUDE.md § 1).
 */
export function PatientFormNote({ defaultValue = '', maxLength = 500 }: Props) {
  const [value, setValue] = useState(defaultValue);
  return (
    <section className="space-y-12">
      <h2 className="text-sm font-semibold uppercase text-muted-foreground">
        Note opérationnelle
      </h2>
      <div className="space-y-8">
        <Label htmlFor="notes_operationnelles">
          Note opérationnelle (codes d&apos;accès, particularités)
        </Label>
        <textarea
          id="notes_operationnelles"
          name="notes_operationnelles"
          rows={4}
          maxLength={maxLength}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-12 py-8 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-describedby="notes-help"
        />
        <p
          id="notes-help"
          className="text-xs tabular-nums text-muted-foreground"
        >
          {value.length} / {maxLength} caractères
        </p>
      </div>
    </section>
  );
}
