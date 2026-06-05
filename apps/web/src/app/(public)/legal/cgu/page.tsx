import type { Metadata } from 'next';
import { loadLegalDoc } from '../_lib/load-legal';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { frontmatter } = await loadLegalDoc('cgu');
  return { title: frontmatter.title };
}

export default async function CguPage() {
  const { frontmatter, rendered } = await loadLegalDoc('cgu');
  return (
    <article className="prose prose-sm max-w-none">
      <p className="text-muted-foreground mb-32 text-sm">Version : {frontmatter.version}</p>
      {rendered}
    </article>
  );
}
