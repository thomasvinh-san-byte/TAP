'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Mécanisme d'alerte sonore réutilisable (COCKPIT-01, §5.13). Bip court et sobre
 * généré via l'API Web Audio — aucune dépendance, aucun asset.
 *
 * Politique d'autoplay : le son ne peut démarrer qu'après une interaction
 * utilisateur. On l'ARME explicitement (`arm`, appelé depuis un clic) ; tant
 * qu'il n'est pas armé, `play()` est un no-op silencieux (dégradation propre sur
 * l'alerte visuelle seule). Réutilisable par toute alerte critique future.
 */

type WindowWithAudio = Window & { webkitAudioContext?: typeof AudioContext };

const BEEP_FREQUENCY_HZ = 880;
const BEEP_DURATION_S = 0.18;
const BEEP_GAIN = 0.06; // volume sobre, audible sans agresser

/**
 * Types d'earcons (PWA-02, §5.16) — sons non verbaux BREFS et DISTINCTS par
 * nature d'événement. Sobriété : trois profils maximum, jamais de mélodie.
 *   - `new_ride` : nouvelle course affectée  → paire ascendante (attire l'œil)
 *   - `update`   : modification / annulation → note grave unique (neutre)
 *   - `message`  : nouveau message           → note aiguë unique (léger)
 */
export type EarconKind = 'new_ride' | 'update' | 'message';

/** Un ton : fréquence, décalage de départ (s) et durée (s). */
interface Tone {
  freq: number;
  at: number;
  dur: number;
}

/** Profils sonores des earcons — volontairement courts et différenciés. */
const EARCON_TONES: Record<EarconKind, readonly Tone[]> = {
  new_ride: [
    { freq: 587, at: 0, dur: 0.12 },
    { freq: 880, at: 0.13, dur: 0.16 },
  ],
  update: [{ freq: 440, at: 0, dur: 0.22 }],
  message: [{ freq: 1175, at: 0, dur: 0.14 }],
};

export interface AlertSound {
  /** Le son est armé (utilisable) — false par défaut (autoplay). */
  armed: boolean;
  /** Arme le son. À appeler dans un gestionnaire d'événement utilisateur. */
  arm: () => void;
  /** Désarme (coupe le son). */
  disarm: () => void;
  /** Joue le bip d'alerte unique (COCKPIT-01) si armé ; no-op sinon. */
  play: () => void;
  /** Joue l'earcon du type donné si armé ; no-op sinon (PWA-02). */
  playEarcon: (kind: EarconKind) => void;
}

export function useAlertSound(): AlertSound {
  const [armed, setArmed] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);

  const arm = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      if (!ctxRef.current) {
        const Ctor = window.AudioContext ?? (window as WindowWithAudio).webkitAudioContext;
        if (!Ctor) return; // pas de Web Audio → on reste en visuel seul
        ctxRef.current = new Ctor();
      }
      void ctxRef.current.resume();
      setArmed(true);
    } catch {
      // Activation impossible : on reste en alerte visuelle seule.
      setArmed(false);
    }
  }, []);

  const disarm = useCallback(() => setArmed(false), []);

  // Séquenceur de tons partagé par `play` et `playEarcon`. No-op si non armé.
  const playTones = useCallback(
    (tones: readonly Tone[]) => {
      const ctx = ctxRef.current;
      if (!armed || !ctx) return; // dégradation propre
      try {
        const base = ctx.currentTime;
        for (const tone of tones) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = tone.freq;
          gain.gain.value = BEEP_GAIN;
          osc.connect(gain);
          gain.connect(ctx.destination);
          const t0 = base + tone.at;
          osc.start(t0);
          osc.stop(t0 + tone.dur);
        }
      } catch {
        // jamais d'erreur remontée à l'UI pour un son
      }
    },
    [armed],
  );

  const play = useCallback(() => {
    playTones([{ freq: BEEP_FREQUENCY_HZ, at: 0, dur: BEEP_DURATION_S }]);
  }, [playTones]);

  const playEarcon = useCallback(
    (kind: EarconKind) => {
      playTones(EARCON_TONES[kind]);
    },
    [playTones],
  );

  useEffect(() => {
    return () => {
      void ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, []);

  return { armed, arm, disarm, play, playEarcon };
}

/**
 * Joue le son une SEULE fois quand un identifiant d'alerte APPARAÎT (transition),
 * jamais en boucle tant que la même alerte reste active. Réutilisable par toute
 * liste d'alertes critiques identifiée par des ids stables.
 */
export function useAlertSoundOnNew(ids: string[], sound: AlertSound): void {
  const seen = useRef<Set<string>>(new Set());
  useEffect(() => {
    const next = new Set(ids);
    let hasNew = false;
    for (const id of next) {
      if (!seen.current.has(id)) {
        hasNew = true;
        break;
      }
    }
    if (hasNew) sound.play();
    seen.current = next;
  }, [ids, sound]);
}
