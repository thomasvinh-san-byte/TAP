import { MessageSquare } from 'lucide-react';
import { requireDirigeantPage } from '@/lib/auth/require-dirigeant-page';
import { createClient } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/page-header';
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
  pickup_confirmed: 'Prise en charge confirmée (démarrage du transport)',
};

export default async function SmsTemplatesPage(): Promise<JSX.Element> {
  await requireDirigeantPage();
  const supabase = await createClient();
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
      <PageHeader
        title="Modèles SMS"
        description="Rappels automatiques envoyés aux patients consentants. Limite 160 caractères par SMS."
      />

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
        <EmptyState
          icon={MessageSquare}
          title="Aucun modèle de SMS"
          description="Les modèles sont seedés par migration. Vérifiez 20260519000005_sms_templates.sql si aucun n'apparaît."
        />
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
