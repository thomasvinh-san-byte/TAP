'use client';

/**
 * LoginFormShell — wrapper Client qui détient l'état `prefill` partagé entre
 * <LoginForm> (RHF) et <DemoCredentials> (cards cliquables) (C06 + C07).
 *
 * Lift state up minimal : la callback `onSelect` posée par DemoCredentials
 * met à jour le state local `prefill`, lequel descend en prop dans
 * <LoginForm>. Pattern conservateur (vs. Context) — 2 consommateurs
 * adjacents seulement.
 */

import { useState } from 'react';
import { LoginForm } from '../login-form.client';
import { DemoCredentials } from '@/components/demo-credentials';

export function LoginFormShell({ next }: { next?: string }) {
  const [prefill, setPrefill] = useState<{ email: string; password: string } | null>(null);

  return (
    <div className="space-y-16">
      <LoginForm next={next} prefill={prefill ?? undefined} />
      <DemoCredentials onSelect={(email, password) => setPrefill({ email, password })} />
    </div>
  );
}
