import { requireDirigeantPage } from '@/lib/auth/require-dirigeant-page';
import { createClient } from '@/lib/supabase/server';
import { TEMPLATE_VARIABLES } from '@tap/sms';
import { TemplateEditor } from './_components/template-editor.client';

export const metadata = { title: 'Templates SMS — TAP Régulation' };
export const dynamic = 'force-dynamic';

interface SmsTemplate {
  key: string;
  body: string;
  updated_at: string;
}

const TEMPLATE_LABELS: Record<string, string> = {
  j1_reminder: 'Rappel J-1 (veille de la course)',
  j2h_reminder: 'Rappel J-2h (deux heures avant)',
};

export default async function SmsTemplatesPage(): Promise<JSX.Element> {
  await requireDirigeantPage();
  const supabase = createClient();
  const { data } = await supabase
    .from('sms_templates')
    .select('key, body, updated_at')
    .order('key');
  const templates = (data as SmsTemplate[] | null) ?? [];

  return (
    <div className="space-y-24">
      <header className="space-y-8">
        <h1 className="text-2xl font-semibold tracking-tight">Templates SMS</h1>
        <p className="text-sm text-muted-foreground">
          Rappels automatiques envoyés aux patients consentants. Limite 160
          caractères par SMS.
        </p>
      </header>

      <section className="rounded-md border border-border bg-muted/20 p-12">
        <h2 className="mb-8 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Variables disponibles
        </h2>
        <div className="flex flex-wrap gap-8">
          {TEMPLATE_VARIABLES.map((v) => (
            <code
              key={v}
              className="rounded bg-background px-8 py-2 font-mono text-xs text-foreground"
            >
              {'{{'}
              {v}
              {'}}'}
            </code>
          ))}
        </div>
      </section>

      {templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun template seedé. Vérifiez la migration{' '}
          <code>20260519000005_sms_templates.sql</code>.
        </p>
      ) : (
        <div className="grid gap-16 lg:grid-cols-2">
          {templates.map((tpl) => (
            <TemplateEditor
              key={tpl.key}
              templateKey={tpl.key}
              initialBody={tpl.body}
              updatedAt={tpl.updated_at}
              label={TEMPLATE_LABELS[tpl.key] ?? tpl.key}
            />
          ))}
        </div>
      )}
    </div>
  );
}
