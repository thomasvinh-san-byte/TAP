'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { checkLoginThrottle, recordLoginAttempt, type ThrottleResult } from './_lib/rate-limit';

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
  next: z.string().optional(),
});

export type SignInState = {
  error?: string;
};

/**
 * Origine réseau de la requête pour la limitation par origine. Tient compte des
 * en-têtes transmis par l'infrastructure (proxy Vercel/Supabase). Valeur de
 * repli neutre si absente (regroupe alors les requêtes sans IP connue).
 */
async function resolveClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return h.get('x-real-ip') ?? 'unknown';
}

/**
 * Authentification email/mot de passe.
 *
 * - Validation zod (email format, mot de passe requis)
 * - signInWithPassword côté serveur (jamais de mot de passe en mémoire client)
 * - Reformulation FR systématique des erreurs Supabase (CLAUDE.md § 5)
 * - Open redirect protection : `next` doit commencer par `/`, sinon fallback `/patients`
 */
export async function signInAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
  // FormData.get() retourne null pour un champ absent ou vide (cas d'un hidden
  // input "next" non renseigné). zod .optional() n'accepte que undefined → on
  // coerce null → undefined avant le parse.
  const rawEmail = formData.get('email');
  const rawPassword = formData.get('password');
  const rawNext = formData.get('next');

  const parsed = signInSchema.safeParse({
    email: rawEmail ?? undefined,
    password: rawPassword ?? undefined,
    next: rawNext ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Saisie invalide' };
  }

  // Durcissement force brute : limitation applicative par compte ET par origine,
  // AVANT toute vérification de mot de passe. Complète la limitation native (par
  // origine seule) du fournisseur d'auth, insuffisante et peu fiable ici.
  const ip = await resolveClientIp();

  // Fail-open sur incident d'infra (indisponibilité de la table de tentatives) :
  // on ne verrouille pas tout le monde ; la limitation native reste un plancher.
  let throttle: ThrottleResult = { limited: false };
  try {
    throttle = await checkLoginThrottle({ email: parsed.data.email, ip });
  } catch (e) {
    console.error('[login] échec de la vérification de limitation (fail-open)', e);
  }
  if (throttle.limited) {
    // Détail (dimension) au journal serveur uniquement, sans donnée personnelle.
    console.warn(`[login] tentative refusée par limitation (dimension=${throttle.reason})`);
    return { error: 'Trop de tentatives. Réessayez dans quelques minutes.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  // Enregistre la tentative réellement effectuée (succès OU échec). On
  // n'enregistre PAS les tentatives déjà bloquées ci-dessus (anti-DoS : la
  // fenêtre draine). Best-effort : un échec d'écriture ne bloque pas la connexion.
  try {
    await recordLoginAttempt({ email: parsed.data.email, ip, success: !error });
  } catch (e) {
    console.error('[login] échec d’enregistrement de la tentative', e);
  }

  if (error) {
    // Message neutre : ne révèle ni l'existence du compte ni la cause exacte
    // (anti-énumération). Détail éventuel au journal serveur uniquement.
    return { error: 'Identifiants invalides.' };
  }

  // Open redirect protection : `next` doit commencer par `/`, pas par `//`.
  const next = parsed.data.next;
  if (next && next.startsWith('/') && !next.startsWith('//')) {
    redirect(next);
  }

  // DEC-054 + DEC-071 — redirect role-aware : dirigeant → /tableau-de-bord,
  // régulateur → /cockpit, chauffeur → /conduite, fallback /patients.
  // DEC-071 amende la clause incidente de DEC-054 (le dirigeant n'atterrit
  // plus sur /cockpit mais sur son tableau de bord) ; le cœur de DEC-054
  // (régulateur → /cockpit) est préservé.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const profileRes = await supabase.from('profiles').select('role').eq('id', user.id).single();
    const profile = profileRes.data as { role: string | null } | null;
    if (profile?.role === 'dirigeant') {
      redirect('/tableau-de-bord');
    }
    if (profile?.role === 'regulateur') {
      redirect('/cockpit');
    }
    if (profile?.role === 'chauffeur') {
      redirect('/conduite');
    }
  }

  redirect('/patients');
}
