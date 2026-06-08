'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { renderTemplate, TEMPLATE_VARIABLES, type TemplateVars } from '@tap/sms/templates';
import { testSendSmsAction } from '../actions';

const DEFAULT_VARS: TemplateVars = {
  patient_prenom: 'Test',
  patient_nom: 'Démo',
  heure: '08:00',
  date: '12/06/2026',
  chauffeur_prenom: 'Chauffeur',
};

export function TemplateTestModal({
  open,
  onOpenChange,
  templateKey,
  currentBody,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateKey: string;
  currentBody: string;
}): JSX.Element {
  const [toPhone, setToPhone] = useState('');
  const [vars, setVars] = useState<TemplateVars>(DEFAULT_VARS);
  const [feedback, setFeedback] = useState<{ sid?: string; error?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const rendered = renderTemplate(currentBody, vars);
  const validPhone = /^\+\d{8,15}$/.test(toPhone);

  function handleVarChange(name: keyof TemplateVars, value: string): void {
    setVars((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(formData: FormData): void {
    setFeedback(null);
    formData.set('template_key', templateKey);
    formData.set('to_phone', toPhone);
    for (const key of TEMPLATE_VARIABLES) {
      const v = vars[key];
      if (v) formData.set(key, v);
    }
    startTransition(async () => {
      const result = await testSendSmsAction(formData);
      if (result.error) {
        setFeedback({ error: result.error });
        return;
      }
      setFeedback({ sid: result.sid });
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tester l&apos;envoi SMS</DialogTitle>
          <DialogDescription>
            Coût estimé ~0,04 € par SMS Twilio. Le destinataire ne reçoit qu&apos;un seul message.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-12">
          <div className="space-y-4">
            <Label htmlFor="test-phone">Numéro destinataire (E.164)</Label>
            <Input
              id="test-phone"
              value={toPhone}
              onChange={(e) => setToPhone(e.target.value)}
              placeholder="+262692XXXXXX"
              required
            />
            {!validPhone && toPhone.length > 0 && (
              <p className="text-destructive text-xs">Format attendu : +262692XXXXXX</p>
            )}
          </div>

          <div className="space-y-8">
            <Label>Variables de test</Label>
            <div className="grid grid-cols-2 gap-8">
              {TEMPLATE_VARIABLES.map((key) => (
                <div key={key} className="space-y-2">
                  <label htmlFor={`var-${key}`} className="text-muted-foreground text-xs">
                    {`{{${key}}}`}
                  </label>
                  <Input
                    id={`var-${key}`}
                    value={vars[key] ?? ''}
                    onChange={(e) => handleVarChange(key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <Label>Aperçu envoi</Label>
            <div className="border-border bg-muted/30 rounded-md border border-dashed p-12 text-sm">
              {rendered || <span className="text-muted-foreground">(vide)</span>}
            </div>
          </div>

          {feedback?.sid && (
            <p role="status" className="text-sm text-emerald-700">
              SMS envoyé (Twilio SID : <code className="font-mono">{feedback.sid}</code>)
            </p>
          )}
          {feedback?.error && (
            <p role="alert" className="text-destructive text-sm">
              {feedback.error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Fermer
            </Button>
            <Button type="submit" disabled={pending || !validPhone}>
              {pending ? 'Envoi…' : 'Envoyer SMS test'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
