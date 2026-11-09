/**
 * View models for the closing blocks of a Solution landing (ADR-030): recipes
 * (`SolutionRecipesProps`), related Solutions (from the registry) and next steps with the final call-to-action band (`SolutionNextStepsProps`).
 * Every href passes the URL policy (developer tier) through `resolveHeroHref`. A related
 * Solution links only when its landing page exists, so no block links a route that has
 * not shipped. Kept out of the components so the rules are unit-tested.
 */
import type { SolutionEntry, SolutionStatus } from '../../../../data/solutions/schema.ts';
import { resolveHeroHref } from '../hero/hero-model.ts';
import type { SolutionNextStepsProps, SolutionRecipesProps } from '../types.ts';

const isText = (value: string): boolean => value.trim().length > 0;

function resolveOrThrow(block: string, href: string, base: string): string {
  const resolved = resolveHeroHref(href, base);
  if (resolved === undefined) throw new Error(`${block}: unsafe href "${href}"`);
  return resolved;
}

export interface RecipeView {
  readonly title: string;
  readonly summary: string;
  readonly href: string;
  readonly external: boolean;
}

export interface RecipesView {
  readonly headingId: string;
  readonly title: string;
  readonly recipes: readonly RecipeView[];
}

export function recipesView(props: SolutionRecipesProps, base = '/'): RecipesView {
  if (!isText(props.title)) throw new Error('SolutionRecipes: title is empty');
  if (props.recipes.length === 0) throw new Error('SolutionRecipes: needs at least one recipe');
  return {
    headingId: `solution-recipes-${props.entry.slug}`,
    title: props.title,
    recipes: props.recipes.map((recipe) => {
      if (!isText(recipe.title) || !isText(recipe.summary)) {
        throw new Error('SolutionRecipes: every recipe needs a title and a summary');
      }
      return {
        title: recipe.title,
        summary: recipe.summary,
        href: resolveOrThrow('SolutionRecipes', recipe.href, base),
        external: /^https:/i.test(recipe.href),
      };
    }),
  };
}

export interface RelatedView {
  readonly slug: string;
  readonly name: string;
  readonly tagline: string;
  readonly status: SolutionStatus;
  /** Set only when the landing page exists. */
  readonly href: string | undefined;
}

/**
 * The other Solutions, in registry order. `liveRoutes` holds the landing routes whose
 * page exists (`/solutions/<slug>/`); the others are listed without a link.
 */
export function relatedSolutions(
  entry: Pick<SolutionEntry, 'slug'>,
  registry: readonly SolutionEntry[],
  liveRoutes: ReadonlySet<string>,
  base = '/'
): RelatedView[] {
  return registry
    .filter((other) => other.slug !== entry.slug)
    .map((other) => ({
      slug: other.slug,
      name: other.name,
      tagline: other.tagline,
      status: other.status,
      href: liveRoutes.has(other.route) ? resolveHeroHref(other.route, base) : undefined,
    }));
}

/** Turns `import.meta.glob` keys like `/src/pages/solutions/canvas/index.astro` into routes. */
export function liveSolutionRoutes(pageFiles: readonly string[]): Set<string> {
  const routes = new Set<string>();
  for (const file of pageFiles) {
    const match = /\/pages\/solutions\/([a-z0-9-]+)\/index\.astro$/.exec(file);
    if (match) routes.add(`/solutions/${match[1]}/`);
  }
  return routes;
}

export interface NextStepLinkView {
  readonly label: string;
  readonly href: string;
  readonly kind: 'primary' | 'secondary' | 'text';
}

export interface NextStepsView {
  readonly headingId: string;
  readonly title: string;
  readonly sub: string;
  readonly links: readonly NextStepLinkView[];
}

/**
 * The final band: the docs link first as the primary call to action, the next link as
 * secondary, the rest as text links. Throws unless `links` includes `entry.docs`.
 */
export function nextStepsView(props: SolutionNextStepsProps, base = '/'): NextStepsView {
  const { entry } = props;
  const docs = props.links.find((link) => link.href === entry.docs);
  if (!docs) throw new Error('SolutionNextSteps: links must include the docs route');
  const ordered = [docs, ...props.links.filter((link) => link !== docs)];
  return {
    headingId: `solution-next-${entry.slug}`,
    title: `Start building with ${entry.name}`,
    sub: entry.tagline,
    links: ordered.map((link, index) => {
      if (!isText(link.label)) throw new Error('SolutionNextSteps: every link needs a label');
      return {
        label: link.label,
        href: resolveOrThrow('SolutionNextSteps', link.href, base),
        kind: index === 0 ? 'primary' : index === 1 ? 'secondary' : 'text',
      };
    }),
  };
}
