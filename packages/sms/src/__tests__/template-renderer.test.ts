import { describe, it, expect } from 'vitest';
import { renderTemplate } from '../template-renderer';

describe('renderTemplate', () => {
  it('substitue toutes les variables présentes', () => {
    const tpl = 'Bonjour {{patient_prenom}}, demain {{date}} à {{heure}}.';
    const result = renderTemplate(tpl, {
      patient_prenom: 'Patrick',
      date: '12/06/2026',
      heure: '08:00',
    });
    expect(result).toBe('Bonjour Patrick, demain 12/06/2026 à 08:00.');
  });

  it('remplace par chaîne vide quand une variable est manquante', () => {
    const tpl = 'Hello {{patient_prenom}} {{patient_nom}}.';
    expect(renderTemplate(tpl, { patient_prenom: 'Jean' })).toBe('Hello Jean .');
  });

  it('remplace par chaîne vide quand la variable est inconnue (hors Mustache 5)', () => {
    const tpl = 'X={{unknown_var}}|Y={{patient_prenom}}';
    expect(renderTemplate(tpl, { patient_prenom: 'P' })).toBe('X=|Y=P');
  });

  it('renvoie le template inchangé sans variable', () => {
    const tpl = 'Texte fixe sans variable.';
    expect(renderTemplate(tpl, { patient_prenom: 'Ignoré' })).toBe('Texte fixe sans variable.');
  });

  it('substitue plusieurs occurrences de la même variable', () => {
    const tpl = '{{patient_prenom}} et {{patient_prenom}} arrivent.';
    expect(renderTemplate(tpl, { patient_prenom: 'Léa' })).toBe('Léa et Léa arrivent.');
  });

  it('traite explicitement undefined comme chaîne vide', () => {
    const tpl = 'Heure : {{heure}}';
    expect(renderTemplate(tpl, { heure: undefined })).toBe('Heure : ');
  });
});
