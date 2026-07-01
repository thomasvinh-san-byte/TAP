'use client';

/**
 * Lecture vocale (TTS) chauffeur — PWA-02 (§5.16).
 *
 * Énonce un texte court (nom du patient + adresse de départ) au démarrage d'une
 * course via l'API navigateur SpeechSynthesis. Contenu limité au nom et à
 * l'adresse, déjà affichés à l'écran — AUCUNE donnée médicale.
 *
 * Deux médias, deux usages (PWA-02) : la voix est réservée au contenu RICHE et
 * NON urgent au démarrage. Les notifications passent par les earcons — ne JAMAIS
 * lire une notification à voix haute.
 *
 * Dégradation propre systématique :
 *   - pas de SpeechSynthesis (navigateur/OS) → ne fait rien
 *   - voix chargées de façon asynchrone → on attend `voiceschanged` une fois
 *   - aucune voix française disponible → on n'énonce rien (pas de voix anglaise
 *     sur un texte français), sans erreur
 *   - jamais d'exception remontée à l'appelant
 */

function pickFrenchVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | null {
  const voices = synth.getVoices();
  if (voices.length === 0) return null;
  return voices.find((v) => v.lang?.toLowerCase().startsWith('fr')) ?? null;
}

export function speak(text: string): void {
  if (typeof window === 'undefined') return;
  const synth = window.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return;

  const trimmed = text.trim();
  if (trimmed.length === 0) return;

  const run = (voice: SpeechSynthesisVoice) => {
    try {
      synth.cancel(); // coupe une éventuelle lecture en cours (une seule à la fois)
      const utter = new SpeechSynthesisUtterance(trimmed);
      utter.voice = voice;
      utter.lang = voice.lang || 'fr-FR';
      utter.rate = 0.95; // légèrement posé pour la conduite
      synth.speak(utter);
    } catch {
      // jamais d'erreur remontée pour une lecture vocale
    }
  };

  const voice = pickFrenchVoice(synth);
  if (voice) {
    run(voice);
    return;
  }

  // Voix pas encore chargées (chargement asynchrone Chrome/Safari) : on attend
  // `voiceschanged` une seule fois. Si aucune voix FR ensuite, on abandonne
  // silencieusement (pas d'énoncé dans une autre langue).
  try {
    const onVoicesChanged = () => {
      synth.removeEventListener('voiceschanged', onVoicesChanged);
      const late = pickFrenchVoice(synth);
      if (late) run(late);
    };
    synth.addEventListener('voiceschanged', onVoicesChanged, { once: true });
  } catch {
    // addEventListener indisponible → dégradation silencieuse
  }
}
