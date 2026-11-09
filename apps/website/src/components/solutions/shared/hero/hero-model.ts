/**
 * View model for `SolutionHero` (ADR-030). It turns `SolutionHeroProps` into what the
 * static markup prints: the status from the registry entry, calls to action resolved
 * through the URL policy, and the art slot (default `entry.art.hero`) with a flag for
 * whether `src/data/illustrations.json` registers it yet.
 */
import { safeHref } from '@texuli/core/url-policy';
import type { SolutionArtSlot, SolutionStatus } from '../../../../data/solutions/schema.ts';
import { withBase } from '../../../foundation/site.ts';
import { illustrationFor } from '../../../landing/illustrations.ts';
import type { SolutionCta, SolutionHeroProps } from '../types.ts';

export interface SolutionHeroCtaView {
  readonly kind: SolutionCta['kind'];
  readonly label: string;
  readonly href: string;
}

export interface SolutionHeroView {
  /** `solution-hero-<slug>`: the h1 id the section is labelled by. */
  readonly headingId: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly lede: string;
  readonly status: SolutionStatus;
  /** Visible status line, for example "Status: in development". */
  readonly statusText: string;
  readonly ctas: readonly SolutionHeroCtaView[];
  readonly art: SolutionArtSlot;
  /** False until the slot is in `illustrations.json`; the hero then paints its own texels. */
  readonly artRegistered: boolean;
  /** Accessible name of the art, from the manifest or derived from the entry. */
  readonly artAlt: string;
}

/** Resolves an app-authored href (developer tier), prefixing the site base for site paths. */
export function resolveHeroHref(href: string, base = '/'): string | undefined {
  const safe = safeHref(href, 'developer');
  if (safe === undefined) return undefined;
  return safe.startsWith('/') ? withBase(base, safe) : safe;
}

/**
 * Builds the hero view. Throws when the props break the block contract (no text, more
 * than two calls to action, a first call to action that is not primary, or an href the
 * URL policy refuses), so a bad landing fails the build instead of shipping.
 */
export function solutionHeroView(props: SolutionHeroProps, base = '/'): SolutionHeroView {
  const { entry } = props;
  for (const key of ['eyebrow', 'title', 'lede'] as const) {
    if (props[key].trim().length === 0) throw new Error(`SolutionHero: ${key} is empty`);
  }
  if (props.ctas.length < 1 || props.ctas.length > 2) {
    throw new Error('SolutionHero: needs one or two calls to action');
  }
  if (props.ctas[0]?.kind !== 'primary') {
    throw new Error('SolutionHero: the first call to action must be primary');
  }
  const ctas = props.ctas.map((cta) => {
    const href = resolveHeroHref(cta.href, base);
    if (href === undefined) throw new Error(`SolutionHero: unsafe href "${cta.href}"`);
    return { kind: cta.kind, label: cta.label, href };
  });
  const art = props.art ?? entry.art.hero;
  const manifest = illustrationFor(art.slot);
  return {
    headingId: `solution-hero-${entry.slug}`,
    eyebrow: props.eyebrow,
    title: props.title,
    lede: props.lede,
    status: entry.status,
    statusText: `Status: ${entry.status}`,
    ctas,
    art,
    artRegistered: manifest !== undefined,
    artAlt: manifest?.alt ?? `Illustration of ${entry.name}, made of small texels.`,
  };
}

/** Seeded texel tones (0–4) for the unregistered-slot plate; stable per slot id. */
export function heroTexels(slot: string, count = 48): number[] {
  let seed = 2166136261;
  for (const char of slot) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  return Array.from({ length: count }, (_, index) => {
    seed = Math.imul(seed ^ (index + 1), 2654435761) >>> 0;
    const roll = seed % 100;
    return roll < 46 ? 0 : roll < 72 ? 1 : roll < 88 ? 2 : roll < 96 ? 3 : 4;
  });
}
