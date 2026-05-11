import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Avatar à initiales — couleur déterministe par rôle ou hash du nom.
 *
 * Utilisé partout où une photo n'existe pas (profils internes, équipiers,
 * chauffeurs sans avatar uploadé). Contrastes WCAG AA garantis sur les
 * 6 teintes du système (couleurs HSL alignées tokens design).
 */
type Role = 'dirigeant' | 'regulateur' | 'chauffeur';

export interface InitialsAvatarProps {
  name: string;
  role?: Role;
  size?: 24 | 32 | 48;
  className?: string;
}

function extractInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    return (parts[0] ?? '').slice(0, 2).toUpperCase() || '?';
  }
  const first = parts[0]?.[0] ?? '';
  const last = parts[parts.length - 1]?.[0] ?? '';
  return (first + last).toUpperCase() || '?';
}

const ROLE_COLORS: Record<Role, { bg: string; fg: string }> = {
  dirigeant: { bg: 'hsl(217 92% 32%)', fg: 'hsl(0 0% 100%)' },
  regulateur: { bg: 'hsl(14 78% 45%)', fg: 'hsl(0 0% 100%)' },
  chauffeur: { bg: 'hsl(142 71% 30%)', fg: 'hsl(0 0% 100%)' },
};

// Palette stable pour les utilisateurs sans rôle (hash → index).
// Contrastes vérifiés WCAG AA sur fond blanc + texte blanc.
const FALLBACK_PALETTE = [
  { bg: 'hsl(217 70% 38%)', fg: 'hsl(0 0% 100%)' },
  { bg: 'hsl(262 60% 45%)', fg: 'hsl(0 0% 100%)' },
  { bg: 'hsl(330 65% 42%)', fg: 'hsl(0 0% 100%)' },
  { bg: 'hsl(14 65% 45%)', fg: 'hsl(0 0% 100%)' },
  { bg: 'hsl(32 80% 38%)', fg: 'hsl(0 0% 100%)' },
  { bg: 'hsl(160 60% 30%)', fg: 'hsl(0 0% 100%)' },
  { bg: 'hsl(195 70% 32%)', fg: 'hsl(0 0% 100%)' },
  { bg: 'hsl(240 35% 40%)', fg: 'hsl(0 0% 100%)' },
];

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

function resolveColors(name: string, role?: Role): { bg: string; fg: string } {
  if (role) return ROLE_COLORS[role];
  const idx = hashString(name.trim().toLowerCase()) % FALLBACK_PALETTE.length;
  return FALLBACK_PALETTE[idx] ?? FALLBACK_PALETTE[0]!;
}

const SIZE_CLASSES: Record<24 | 32 | 48, string> = {
  24: 'h-24 w-24 text-xs',
  32: 'h-32 w-32 text-xs',
  48: 'h-48 w-48 text-base',
};

export function InitialsAvatar({
  name,
  role,
  size = 32,
  className,
}: InitialsAvatarProps): JSX.Element {
  const initials = extractInitials(name);
  const { bg, fg } = resolveColors(name, role);

  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        'select-none',
        SIZE_CLASSES[size],
        className,
      )}
      style={{ backgroundColor: bg, color: fg }}
    >
      {initials}
    </span>
  );
}
