import { requireDirigeantPage } from '@/lib/auth/require-dirigeant-page';
import { createClient } from '@/lib/supabase/server';
import { TEMPLATE_VARIABLES } from '@tap/sms';
import { TemplateEditor } from './_components/template-editor.client';

export const metadata = { title: 'Modèles SMS' };
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
  const { data, error } = await supabase
    .from('sms_templates')
    .select('key, body, updated_at')
    .order('key');
  if (error) {
    console.error('[admin/sms-templates] Erreur Supabase:', error);
  }
  const templates = (data as SmsTemplate[] | null) ?? [];

  return (
    <div className="space-y-24">
      <header className="space-y-8">
        <h1 className="text-2xl font-semibold tracking-tight">Modèles SMS</h1>
        <p className="text-muted-foreground text-sm">
          Rappels automatiques envoyés aux patients consentants. Limite 160 caractères par SMS.
        </p>
      </header>

      <section className="border-border bg-muted/20 rounded-md border p-12">
        <h2 className="text-muted-foreground mb-8 text-xs font-semibold uppercase tracking-wide">
          Variables disponibles
        </h2>
        <div className="flex flex-wrap gap-8">
          {TEMPLATE_VARIABLES.map((v) => (
            <code
              key={v}
              className="bg-background text-foreground rounded px-8 py-2 font-mono text-xs"
            >
              {'{{'}
              {v}
              {'}}'}
            </code>
          ))}
        </div>
      </section>

      {templates.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aucun modèle seedé. Vérifiez la migration <code>20260519000005_sms_templates.sql</code>.
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
