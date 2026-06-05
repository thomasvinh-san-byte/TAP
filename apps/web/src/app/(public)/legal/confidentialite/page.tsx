import type { Metadata } from 'next';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { loadLegalDoc, legalMdxComponents } from '../_lib/load-legal';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { frontmatter } = await loadLegalDoc('confidentialite');
  return { title: frontmatter.title };
}

export default async function ConfidentialitePage() {
  const { frontmatter, source } = await loadLegalDoc('confidentialite');
  return (
    <article className="prose prose-sm max-w-none">
      <p className="text-muted-foreground mb-32 text-sm">Version : {frontmatter.version}</p>
      <MDXRemote
        source={source}
        components={legalMdxComponents}
        options={{ parseFrontmatter: false }}
      />
    </article>
  );
}
