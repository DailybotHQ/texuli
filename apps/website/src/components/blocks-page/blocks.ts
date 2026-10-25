/**
 * texuli.com blocks and templates (T-site-blocks-page): copy-ready page
 * sections. Each lists the styled components its source imports, so the page
 * can show the exact `texuli add` command; the e2e spec runs those commands.
 */

export type PageBlockId = 'hero' | 'features' | 'pricing' | 'faq' | 'auth' | 'footer';

export interface PageBlock {
  id: PageBlockId;
  title: string;
  description: string;
  /** Section source file under `sections/`. */
  file: string;
  /** `texuli add` ids the source imports (from `texuli/<id>`), in order. */
  add: readonly string[];
}

export const PAGE_BLOCKS: readonly PageBlock[] = [
  {
    id: 'hero',
    title: 'Hero',
    description: 'An announcement badge, the headline, a short lead and two actions.',
    file: 'HeroSection.svelte',
    add: ['badge', 'button'],
  },
  {
    id: 'features',
    title: 'Features',
    description: 'A responsive grid of cards, one per capability.',
    file: 'FeaturesSection.svelte',
    add: ['card'],
  },
  {
    id: 'pricing',
    title: 'Pricing',
    description: 'Three plans with the middle one featured; prices kept as integer cents.',
    file: 'PricingSection.svelte',
    add: ['badge', 'button', 'card'],
  },
  {
    id: 'faq',
    title: 'FAQ',
    description: 'Questions in a keyboard-operable accordion, one open at a time.',
    file: 'FaqSection.svelte',
    add: ['tabs-accordion'],
  },
  {
    id: 'auth',
    title: 'Sign in',
    description: 'An email and password form with inline validation messages.',
    file: 'AuthSection.svelte',
    add: ['button', 'card', 'field', 'input'],
  },
  {
    id: 'footer',
    title: 'Footer',
    description: 'Brand, link columns and the legal line, in plain markup on tokens.',
    file: 'FooterSection.svelte',
    add: [],
  },
];

export function blockPath(id: PageBlockId): string {
  return `/blocks-page/${id}/`;
}

/** The install command for a block, or `null` when it needs no components. */
export function addCommand(block: PageBlock): string | null {
  return block.add.length > 0 ? `texuli add ${block.add.join(' ')}` : null;
}

/** The `texuli/<id>` subpaths a section imports, read from its source. */
export function importedTexuliIds(source: string): string[] {
  const ids = new Set<string>();
  for (const match of source.matchAll(/from\s+['"]texuli\/([a-z-]+)['"]/g)) {
    if (match[1]) ids.add(match[1]);
  }
  return [...ids].sort();
}
