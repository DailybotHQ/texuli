/**
 * Agent surfaces generated from the Solutions registry (ADR-029) and the listed products
 * (ADR-027): the `/solutions/index.json` document, the llms.txt "Solutions" and
 * "Built with Texuli" sections, and the Markdown-twin "For agents" notes for the demo
 * landings. Each function lists only routes whose page exists (`siteRouteExists`, the same
 * rule as the nav), so no surface points at a page that has not shipped.
 *
 * Twins and the sitemap need no registry code: the docs integration writes a Markdown twin
 * beside every built page, the middleware (`functions/_middleware.ts`, `md-negotiate.ts`)
 * negotiates every page path, and the SEO integration lists every indexed page. Once a
 * landing ships, it is covered by those automatically; `registryRoutes` is the list the
 * tests and the twin-parity check expect to find there.
 *
 * Data only, importable outside Vite: the site origin is always a parameter.
 */
import { siteRouteExists } from '../../components/foundation/nav-data.ts';
import { LISTED_PRODUCTS, type ProductEntry } from '../../data/products/index.ts';
import { SOLUTIONS } from '../../data/solutions/index.ts';
import type { SolutionEntry, SolutionSlug } from '../../data/solutions/schema.ts';

/** A route-existence check; tests pass a fake, the build uses `siteRouteExists`. */
export type RouteExists = (route: string) => boolean;

export type RegistryRouteKind = 'catalog' | 'solution' | 'solution-docs' | 'built-with' | 'product';

export interface RegistryRoute {
  readonly route: string;
  readonly kind: RegistryRouteKind;
  readonly title: string;
}

/** The product page route for a listed product (`/built-with/<id>/`). */
export function productRoute(product: Pick<ProductEntry, 'id'>): string {
  return `/built-with/${product.id}/`;
}

/** Every registry-driven route whose page exists, in catalog order. */
export function registryRoutes(
  exists: RouteExists = siteRouteExists,
  solutions: readonly SolutionEntry[] = SOLUTIONS,
  products: readonly ProductEntry[] = LISTED_PRODUCTS
): RegistryRoute[] {
  const routes: RegistryRoute[] = [];
  const add = (route: string, kind: RegistryRouteKind, title: string) => {
    if (exists(route)) routes.push({ route, kind, title });
  };
  add('/solutions/', 'catalog', 'Solutions');
  for (const entry of solutions) {
    add(entry.route, 'solution', entry.name);
    add(entry.docs, 'solution-docs', `${entry.name} docs`);
  }
  add('/built-with/', 'built-with', 'Built with Texuli');
  for (const product of products) {
    if (product.visibility === 'listed') add(productRoute(product), 'product', product.name);
  }
  return routes;
}

/** The workspace directory of a package name (`@texuli/slides` → `slides`, `texuli` → `texuli`). */
export function packageDir(name: string): string {
  return name.startsWith('@texuli/') ? name.slice('@texuli/'.length) : name;
}

export const SOLUTIONS_INDEX_FORMAT = 'texuli/solutions-index-v1';

export interface SolutionsIndexDocument {
  readonly format: typeof SOLUTIONS_INDEX_FORMAT;
  /** The registry this document is generated from (repository path). */
  readonly source: string;
  readonly catalog: string | null;
  readonly solutions: readonly Record<string, unknown>[];
  readonly products: readonly Record<string, unknown>[];
}

/**
 * The `/solutions/index.json` document: the registry facts of every Solution whose landing
 * exists, and every listed product whose page exists. URLs are absolute on `siteUrl`
 * (origin, no trailing slash); a docs page that does not exist yet is `null`, never a dead
 * link. Statuses are the registry's (native ones capped by `validate.ts`).
 */
export function solutionsIndexDocument(
  siteUrl: string,
  exists: RouteExists = siteRouteExists,
  solutions: readonly SolutionEntry[] = SOLUTIONS,
  products: readonly ProductEntry[] = LISTED_PRODUCTS
): SolutionsIndexDocument {
  const abs = (route: string) => `${siteUrl}${route}`;
  return {
    format: SOLUTIONS_INDEX_FORMAT,
    source: 'apps/website/src/data/solutions/index.ts',
    catalog: exists('/solutions/') ? abs('/solutions/') : null,
    solutions: solutions
      .filter((entry) => exists(entry.route))
      .map((entry) => ({
        slug: entry.slug,
        name: entry.name,
        status: entry.status,
        tagline: entry.tagline,
        summary: entry.summary,
        url: abs(entry.route),
        docs: exists(entry.docs) ? abs(entry.docs) : null,
        markdown: abs(`${entry.route.replace(/\/$/, '')}.md`),
        packages: entry.packages.map((pkg) => ({
          name: pkg.name,
          subpaths: [...pkg.subpaths],
          role: pkg.role,
        })),
        capabilities: entry.capabilities.map((cap) => ({
          id: cap.id,
          title: cap.title,
          status: cap.status,
        })),
        platforms: entry.platforms.map((p) => ({
          platform: p.platform,
          status: p.status,
          evidence: [...p.evidence],
        })),
        demo: { scenarios: [...entry.demo.scenarios], limits: [...entry.demo.limits] },
        limits: [...entry.limits],
      })),
    products: products
      .filter((product) => product.visibility === 'listed' && exists(productRoute(product)))
      .map((product) => ({
        id: product.id,
        name: product.name,
        status: product.status,
        summary: product.summary,
        url: abs(productRoute(product)),
        offerings: product.offerings.map((o) => ({ id: o.id, label: o.label, status: o.status })),
      })),
  };
}

/** One llms.txt section, the shape of `SiteLlmsSection` in `components/seo/llms-site.ts`. */
export interface RegistryLlmsSection {
  readonly name: string;
  readonly description: string;
  readonly links: readonly Readonly<{ title: string; href: string; description?: string }>[];
}

/**
 * The llms.txt sections for the registry: "Solutions" (catalog, landings, docs) and
 * "Built with Texuli" (listed products). A section with no existing page is omitted.
 */
export function registryLlmsSections(
  siteUrl: string,
  exists: RouteExists = siteRouteExists,
  solutions: readonly SolutionEntry[] = SOLUTIONS,
  products: readonly ProductEntry[] = LISTED_PRODUCTS
): RegistryLlmsSection[] {
  const abs = (route: string) => `${siteUrl}${route}`;
  const solutionLinks: Array<{ title: string; href: string; description?: string }> = [];
  if (exists('/solutions/'))
    solutionLinks.push({
      title: 'All Solutions',
      href: abs('/solutions/'),
      description: 'The catalog, with each Solution’s status and platforms.',
    });
  if (exists('/solutions/'))
    solutionLinks.push({
      title: 'Solutions index (JSON)',
      href: abs('/solutions/index.json'),
      description: 'The registry facts as JSON.',
    });
  for (const entry of solutions) {
    if (exists(entry.route))
      solutionLinks.push({
        title: entry.name,
        href: abs(entry.route),
        description: `${entry.tagline} Status: ${entry.status}.`,
      });
    if (exists(entry.docs))
      solutionLinks.push({ title: `${entry.name} docs`, href: abs(entry.docs) });
  }
  const productLinks: Array<{ title: string; href: string; description?: string }> = [];
  if (exists('/built-with/'))
    productLinks.push({ title: 'Built with Texuli', href: abs('/built-with/') });
  for (const product of products) {
    if (product.visibility !== 'listed' || !exists(productRoute(product))) continue;
    productLinks.push({
      title: product.name,
      href: abs(productRoute(product)),
      description: `${product.summary} Status: ${product.status}.`,
    });
  }
  const sections: RegistryLlmsSection[] = [];
  if (solutionLinks.length > 0)
    sections.push({
      name: 'Solutions',
      description: 'Embeddable open-source systems that complete a task end to end.',
      links: solutionLinks,
    });
  if (productLinks.length > 0)
    sections.push({
      name: 'Built with Texuli',
      description: 'Products built on Texuli, each with its own brand and domain.',
      links: productLinks,
    });
  return sections;
}

/** MCP operations an agent uses to do what each Solution's demo shows. */
export const SOLUTION_OPERATIONS: Readonly<Record<SolutionSlug, readonly string[]>> = {
  slides: ['deck.run', 'catalog.search', 'component.get'],
  documents: ['document.run', 'block.list', 'block.schema'],
  workflows: ['catalog.search', 'component.get', 'blueprint.validate'],
  canvas: ['catalog.search', 'component.get', 'blueprint.validate'],
  sheets: ['catalog.search', 'component.get', 'blueprint.validate'],
  'design-systems': ['ds.validate', 'ds.generate', 'ds.compile'],
};

/** A "For agents" twin note, the shape of `TwinNote` in `components/docs/twin-notes.ts`. */
export interface RegistryTwinNote {
  readonly route: RegExp;
  readonly demo: string;
  readonly operations: readonly string[];
  readonly packages: readonly string[];
  readonly links: readonly Readonly<{ label: string; href: string }>[];
  readonly limits: readonly string[];
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Twin notes for every Solution landing that exists (its demo cannot be mirrored as text). */
export function solutionTwinNotes(
  exists: RouteExists = siteRouteExists,
  solutions: readonly SolutionEntry[] = SOLUTIONS
): RegistryTwinNote[] {
  return solutions
    .filter((entry) => exists(entry.route))
    .map((entry) => {
      const limits = entry.demo.limits.join(' ');
      return {
        route: new RegExp(`^${escapeRegExp(entry.route)}$`),
        demo: `${entry.demo.title}: the live ${entry.name} demo runs in the browser on fixture data.${limits ? ` ${limits}` : ''}`,
        operations: SOLUTION_OPERATIONS[entry.slug],
        packages: [...new Set(entry.packages.map((pkg) => packageDir(pkg.name)))],
        links: exists(entry.docs) ? [{ label: `${entry.name} docs`, href: entry.docs }] : [],
        limits: entry.limits,
      };
    });
}
