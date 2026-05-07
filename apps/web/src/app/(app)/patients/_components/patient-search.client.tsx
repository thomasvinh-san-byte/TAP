'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

/**
 * Champ de recherche patient (D-10 : déclenche à 2 caractères).
 * autoFocus = retour rapide à la saisie pour la régulatrice (CLAUDE.md § 5).
 */
export function PatientSearch({ value, onChange }: Props) {
  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-12 top-1/2 -translate-y-1/2 h-16 w-16 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Rechercher (nom, prénom, téléphone)…"
        className="pl-32 h-48"
        aria-label="Rechercher un patient"
        autoFocus
      />
    </div>
  );
}
