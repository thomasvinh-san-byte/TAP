import { promises as fs } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { compileMDX } from 'next-mdx-remote/rsc';
import { LastUpdated } from '../_components/last-updated';

/**
 * Helper SSG : lit un fichier Markdown sous `src/content/legal/<slug>.md`,
 * extrait le frontmatter (gray-matter) et compile le corps MDX (next-mdx-remote/rsc).
 * Le composant `<LastUpdated />` est exposé aux pages MDX.
 *
 * Voir CONTEXT.md D-13 + RESEARCH.md § Markdown rendering.
 */
export type LegalSlug = 'cgu' | 'cgv' | 'confidentialite' | 'cookies' | 'dpo';

export type LegalFrontmatter = {
  title: string;
  version: string;
  effective_at: string;
};

function toIsoDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? '');
}

export async function loadLegalDoc(slug: LegalSlug) {
  const filePath = path.join(process.cwd(), 'src/content/legal', `${slug}.md`);
  const raw = await fs.readFile(filePath, 'utf-8');
  const { data, content } = matter(raw);
  // YAML coerce automatiquement `version: 2026-05-08` en Date — on
  // re-stringify pour rester cohérent avec le type LegalFrontmatter et
  // éviter une erreur React « Objects are not valid as a child ».
  const frontmatter: LegalFrontmatter = {
    title: String(data.title ?? ''),
    version: toIsoDate(data.version),
    effective_at: toIsoDate(data.effective_at),
  };
  const { content: rendered } = await compileMDX({
    source: content,
    components: { LastUpdated },
    options: { parseFrontmatter: false },
  });
  return { frontmatter, rendered };
}
