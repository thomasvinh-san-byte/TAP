import { promises as fs } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { LastUpdated } from '../_components/last-updated';

/**
 * Helper SSG : lit un fichier Markdown sous `src/content/legal/<slug>.md`,
 * extrait le frontmatter (gray-matter) et expose le contenu brut + les
 * composants à mapper. Le rendu via `<MDXRemote>` est fait dans la PAGE
 * (Server Component) — pas ici. Sinon Next 15 cross-bundle le React
 * Element entre la frontière de module et lève « React Element from older
 * version ». Pattern recommandé : la page importe `<MDXRemote>` directement
 * et passe `source` + `components`.
 *
 * Voir CONTEXT.md D-13 + RESEARCH.md § Markdown rendering.
 */
export type LegalSlug = 'cgu' | 'cgv' | 'confidentialite' | 'cookies' | 'dpo';

export type LegalFrontmatter = {
  title: string;
  version: string;
  effective_at: string;
};

export const legalMdxComponents = { LastUpdated };

function toIsoDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? '');
}

export async function loadLegalDoc(slug: LegalSlug): Promise<{
  frontmatter: LegalFrontmatter;
  source: string;
}> {
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
  return { frontmatter, source: content };
}
