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

export interface AlertSound {
  /** Le son est armé (utilisable) — false par défaut (autoplay). */
  armed: boolean;
  /** Arme le son. À appeler dans un gestionnaire d'événement utilisateur. */
  arm: () => void;
  /** Désarme (coupe le son). */
  disarm: () => void;
  /** Joue le bip si armé ; no-op sinon (dégradation propre). */
  play: () => void;
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

  const play = useCallback(() => {
    const ctx = ctxRef.current;
    if (!armed || !ctx) return; // dégradation propre
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = BEEP_FREQUENCY_HZ;
      gain.gain.value = BEEP_GAIN;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t0 = ctx.currentTime;
      osc.start(t0);
      osc.stop(t0 + BEEP_DURATION_S);
    } catch {
      // jamais d'erreur remontée à l'UI pour un son
    }
  }, [armed]);

  useEffect(() => {
    return () => {
      void ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, []);

  return { armed, arm, disarm, play };
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
