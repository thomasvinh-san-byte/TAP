'use client';

import * as React from 'react';
import { useAlertSound, type EarconKind } from '@/lib/alert-sound/use-alert-sound';
import { speak as ttsSpeak } from '@/lib/tts/speak.client';

/**
 * Fournisseur audio chauffeur — PWA-02 (§5.16).
 *
 * Centralise, pour toute la zone (driver), UN SEUL contexte audio armé et les
 * préférences de la conductrice :
 *   - voix (lecture du nom + adresse au démarrage) — activée par défaut
 *   - earcons (sons brefs distincts par type d'événement) — activés par défaut
 *
 * Pourquoi un provider et pas des hooks isolés : l'armement de l'AudioContext
 * (politique d'autoplay) doit être PARTAGÉ. Un seul `useAlertSound` armé à la
 * première interaction sert le bouton de conduite (voix) et le fil de messages
 * (earcon message). Persistance simple via localStorage (défaut activé).
 *
 * Dégradation propre : hors provider, `useDriverAudio` renvoie des no-op.
 */

const VOICE_KEY = 'tap:driver:voice';
const EARCONS_KEY = 'tap:driver:earcons';

function readPref(key: string): boolean {
  try {
    // Défaut activé : seule la valeur explicite 'off' désactive.
    return window.localStorage.getItem(key) !== 'off';
  } catch {
    return true;
  }
}

function writePref(key: string, on: boolean): void {
  try {
    window.localStorage.setItem(key, on ? 'on' : 'off');
  } catch {
    // localStorage indisponible → préférence non persistée (sans erreur)
  }
}

interface DriverAudioValue {
  voiceEnabled: boolean;
  earconsEnabled: boolean;
  setVoiceEnabled: (on: boolean) => void;
  setEarconsEnabled: (on: boolean) => void;
  /** Lit un texte (nom + adresse) si la voix est activée ; no-op sinon. */
  announce: (text: string) => void;
  /** Joue l'earcon du type si les earcons sont activés et l'audio armé. */
  earcon: (kind: EarconKind) => void;
  /** L'audio a été armé par une interaction (sinon earcons en no-op). */
  armed: boolean;
}

const NOOP: DriverAudioValue = {
  voiceEnabled: false,
  earconsEnabled: false,
  setVoiceEnabled: () => {},
  setEarconsEnabled: () => {},
  announce: () => {},
  earcon: () => {},
  armed: false,
};

const DriverAudioContext = React.createContext<DriverAudioValue | null>(null);

export function DriverAudioProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const { arm, armed, playEarcon } = useAlertSound();
  const [voiceEnabled, setVoiceState] = React.useState(true);
  const [earconsEnabled, setEarconsState] = React.useState(true);

  // Préférences persistées, lues au montage (défaut activé si absentes).
  React.useEffect(() => {
    setVoiceState(readPref(VOICE_KEY));
    setEarconsState(readPref(EARCONS_KEY));
  }, []);

  // Armement de l'audio à la première interaction (politique d'autoplay).
  React.useEffect(() => {
    if (armed) return;
    const onInteract = () => arm();
    const opts = { passive: true } as const;
    window.addEventListener('pointerdown', onInteract, opts);
    window.addEventListener('keydown', onInteract, opts);
    window.addEventListener('touchstart', onInteract, opts);
    return () => {
      window.removeEventListener('pointerdown', onInteract);
      window.removeEventListener('keydown', onInteract);
      window.removeEventListener('touchstart', onInteract);
    };
  }, [armed, arm]);

  const setVoiceEnabled = React.useCallback((on: boolean) => {
    setVoiceState(on);
    writePref(VOICE_KEY, on);
  }, []);

  const setEarconsEnabled = React.useCallback((on: boolean) => {
    setEarconsState(on);
    writePref(EARCONS_KEY, on);
  }, []);

  const announce = React.useCallback(
    (text: string) => {
      if (!voiceEnabled) return;
      ttsSpeak(text);
    },
    [voiceEnabled],
  );

  const earcon = React.useCallback(
    (kind: EarconKind) => {
      if (!earconsEnabled) return;
      playEarcon(kind);
    },
    [earconsEnabled, playEarcon],
  );

  const value = React.useMemo<DriverAudioValue>(
    () => ({
      voiceEnabled,
      earconsEnabled,
      setVoiceEnabled,
      setEarconsEnabled,
      announce,
      earcon,
      armed,
    }),
    [voiceEnabled, earconsEnabled, setVoiceEnabled, setEarconsEnabled, announce, earcon, armed],
  );

  return <DriverAudioContext.Provider value={value}>{children}</DriverAudioContext.Provider>;
}

export function useDriverAudio(): DriverAudioValue {
  return React.useContext(DriverAudioContext) ?? NOOP;
}
