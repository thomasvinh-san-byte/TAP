'use client';

import { useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FormSection, FormActions } from '@/components/form/form-layout';
import { TEMPLATE_VARIABLES, renderTemplate, type TemplateVars } from '@tap/sms/templates';
import { saveTemplateAction } from '../actions';
import { TemplateTestModal } from './template-test-modal.client';

const SAMPLE_VARS: TemplateVars = {
  patient_prenom: 'Patient prenom',
  patient_nom: 'Patient nom',
  heure: '08:00',
  date: '12/06/2026',
  chauffeur_prenom: 'Chauffeur prenom',
};

const MAX_LENGTH = 160;

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Indian/Reunion',
  });
}

export function TemplateEditor({
  templateKey,
  initialBody,
  updatedAt,
  label,
}: {
  templateKey: string;
  initialBody: string;
  updatedAt: string;
  label: string;
}): JSX.Element {
  const [body, setBody] = useState(initialBody);
  const [feedback, setFeedback] = useState<{ ok?: string; error?: string } | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const over = body.length > MAX_LENGTH;
  const preview = renderTemplate(body, SAMPLE_VARS);

  function insertVariable(variable: string): void {
    const ta = textareaRef.current;
    const insertion = `{{${variable}}}`;
    if (!ta) {
      setBody((b) => b + insertion);
      return;
    }
    const start = ta.selectionStart ?? body.length;
    const end = ta.selectionEnd ?? body.length;
    const next = body.slice(0, start) + insertion + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      const caret = start + insertion.length;
      ta.focus();
      ta.setSelectionRange(caret, caret);
    });
  }

  function handleSubmit(formData: FormData): void {
    setFeedback(null);
    formData.set('template_key', templateKey);
    formData.set('body', body);
    startTransition(async () => {
      const result = await saveTemplateAction(formData);
      if (result.error) {
        setFeedback({ error: result.error });
        return;
      }
      setFeedback({ ok: 'Modèle enregistré.' });
    });
  }

  return (
    <article className="border-border bg-background space-y-12 rounded-md border p-16">
      <header className="space-y-4">
        <h2 className="text-foreground text-base font-semibold">{label}</h2>
        <p className="text-muted-foreground text-xs">
          Clé : <code className="font-mono">{templateKey}</code> · maj {formatUpdatedAt(updatedAt)}
        </p>
      </header>

      <FormSection title="Variables — clic pour insérer">
        <div className="flex flex-wrap gap-8">
          {TEMPLATE_VARIABLES.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => insertVariable(v)}
              className="border-border bg-muted hover:bg-muted/70 rounded border px-8 py-4 font-mono text-xs"
            >
              {`{{${v}}}`}
            </button>
          ))}
        </div>
      </FormSection>

      <form action={handleSubmit} className="space-y-12">
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <Label htmlFor={`tpl-${templateKey}`}>Corps du SMS</Label>
            <span
              id={`tpl-${templateKey}-count`}
              aria-live="polite"
              className={
                'text-xs tabular-nums ' +
                (over ? 'text-destructive font-semibold' : 'text-muted-foreground')
              }
            >
              {body.length}/{MAX_LENGTH}
            </span>
          </div>
          <Textarea
            id={`tpl-${templateKey}`}
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            aria-describedby={`tpl-${templateKey}-count`}
            aria-invalid={over || undefined}
          />
        </div>

        <div className="space-y-8">
          <Label>Aperçu (valeurs génériques)</Label>
          <div className="border-border bg-muted/30 rounded-md border border-dashed p-12 text-sm">
            {preview || <span className="text-muted-foreground">(vide)</span>}
          </div>
        </div>

        {feedback?.ok && (
          <p role="status" className="text-success text-sm">
            {feedback.ok}
          </p>
        )}
        {feedback?.error && (
          <p role="alert" className="text-destructive text-sm">
            {feedback.error}
          </p>
        )}

        <FormActions>
          <Button
            type="button"
            variant="outline"
            onClick={() => setTestOpen(true)}
            disabled={pending}
          >
            Tester l&apos;envoi…
          </Button>
          <Button type="submit" disabled={pending || over || body.length === 0}>
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </FormActions>
      </form>

      <TemplateTestModal
        open={testOpen}
        onOpenChange={setTestOpen}
        templateKey={templateKey}
        currentBody={body}
      />
    </article>
  );
}
