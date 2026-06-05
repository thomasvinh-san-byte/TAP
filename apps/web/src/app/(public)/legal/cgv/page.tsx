import type { Metadata } from 'next';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { loadLegalDoc, legalMdxComponents } from '../_lib/load-legal';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { frontmatter } = await loadLegalDoc('cgv');
  return { title: frontmatter.title };
}

export default async function CgvPage() {
  const { frontmatter, source } = await loadLegalDoc('cgv');
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
