/**
 * Mustache custom 5 variables (DEC-051 LOCKED).
 * Pas de dépendance Handlebars (économie ~40 KB).
 *
 * Variables supportées :
 *   - {{patient_prenom}}
 *   - {{patient_nom}}
 *   - {{heure}}
 *   - {{date}}
 *   - {{chauffeur_prenom}}
 *
 * Variables non listées remplacées par chaîne vide (safe — pas d'erreur
 * runtime, le template reste affichable même avec une variable manquante).
 */

export const TEMPLATE_VARIABLES = [
  'patient_prenom',
  'patient_nom',
  'heure',
  'date',
  'chauffeur_prenom',
] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];

export type TemplateVars = Partial<Record<TemplateVariable, string>>;

export function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = (vars as Record<string, string | undefined>)[key];
    return value ?? '';
  });
}
