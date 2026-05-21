import type { Metadata } from 'next';
import { loadLegalDoc } from '../_lib/load-legal';

export const dynamic = 'force-static';

export async function generateMetadata(): Promise<Metadata> {
  const { frontmatter } = await loadLegalDoc('confidentialite');
  return { title: frontmatter.title };
}

export default async function ConfidentialitePage() {
  const { frontmatter, rendered } = await loadLegalDoc('confidentialite');
  return (
    <article className="prose prose-sm max-w-none">
      <p className="text-muted-foreground mb-32 text-sm">Version : {frontmatter.version}</p>
      {rendered}
    </article>
  );
}
