/**
 * Build-time component gallery catalog from closed catalog manifests.
 * Reuses the component-pages loader so ids stay in sync.
 */
import {
  COMPONENT_PAGES,
  type ComponentPageEntry,
  componentPagePath,
} from '../component-pages/load-manifests.ts';
import { initialProps, type LivePropSchema } from '../live/props-state.ts';
import { STAGE_CONTROLS } from '../live/stage-controls.ts';

/** One authored example on a gallery card (id and title; props stay in the manifest). */
export type GalleryExample = {
  id: string;
  title: string;
};

/** Serializable gallery card for the filter island. */
export type GalleryComponentCard = {
  id: string;
  label: string;
  summary: string;
  /** Manifest group = primary category. */
  category: string;
  package: string;
  tier: string;
  agentEmittable: boolean;
  /** Filter chips: category, tier, package, agent, enum variants, example ids. */
  tags: readonly string[];
  /** Documented visual variants (enum prop values + example titles). */
  variants: readonly string[];
  href: string;
  examples: readonly GalleryExample[];
  /** Props the card's panel edits: the ones its live stage applies. */
  controls: readonly LivePropSchema[];
  /** Starting panel values: the first example's props, then the defaults. */
  initial: Readonly<Record<string, string | number | boolean>>;
};

function tagsFor(entry: ComponentPageEntry, variants: readonly string[]): string[] {
  const tags = new Set<string>();
  tags.add(entry.group);
  tags.add(entry.tier);
  tags.add(entry.package);
  tags.add(entry.agentEmittable ? 'agent-emittable' : 'app-chrome');
  for (const v of variants) tags.add(v);
  for (const ex of entry.examples) tags.add(ex.id);
  return [...tags].sort((a, b) => a.localeCompare(b, 'en'));
}

function variantsFor(entry: ComponentPageEntry): string[] {
  const out = new Set<string>();
  for (const prop of entry.props) {
    if (prop.kind === 'enum' && prop.enumValues) {
      for (const value of prop.enumValues) out.add(value);
    }
  }
  for (const ex of entry.examples) {
    const variant = ex.props.variant;
    if (typeof variant === 'string') out.add(variant);
    const tone = ex.props.tone;
    if (typeof tone === 'string') out.add(tone);
  }
  return [...out].sort((a, b) => a.localeCompare(b, 'en'));
}

function controlsFor(entry: ComponentPageEntry): LivePropSchema[] {
  const names = STAGE_CONTROLS[entry.id] ?? [];
  return entry.props
    .filter((prop) => names.includes(prop.name))
    .map((prop) => ({
      name: prop.name,
      kind: prop.kind,
      ...(prop.enumValues ? { enumValues: prop.enumValues } : {}),
      ...(prop.default !== undefined ? { default: prop.default } : {}),
    }));
}

/** Only string, number and boolean values reach a preview. */
function primitiveValues(
  values: Record<string, unknown>
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [name, value] of Object.entries(values)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[name] = value;
    }
  }
  return out;
}

function toCard(entry: ComponentPageEntry): GalleryComponentCard {
  const variants = variantsFor(entry);
  const controls = controlsFor(entry);
  return {
    id: entry.id,
    label: entry.label,
    summary: entry.summary,
    category: entry.group,
    package: entry.package,
    tier: entry.tier,
    agentEmittable: Boolean(entry.agentEmittable),
    tags: tagsFor(entry, variants),
    variants,
    href: componentPagePath(entry.id),
    examples: entry.examples.map((ex) => ({ id: ex.id, title: ex.title })),
    controls,
    initial: primitiveValues(initialProps(controls, entry.examples[0])),
  };
}

/** Closed gallery cards, sorted by id (same order as component pages). */
export function buildGalleryComponentCards(): readonly GalleryComponentCard[] {
  return Object.freeze(COMPONENT_PAGES.map(toCard));
}

/** Unique categories in sort order. */
export function galleryCategories(cards: readonly GalleryComponentCard[]): readonly string[] {
  return Object.freeze(
    [...new Set(cards.map((c) => c.category))].sort((a, b) => a.localeCompare(b, 'en'))
  );
}

/** Unique tags across cards (for the filter chip list). */
export function galleryAllTags(cards: readonly GalleryComponentCard[]): readonly string[] {
  const tags = new Set<string>();
  for (const card of cards) for (const tag of card.tags) tags.add(tag);
  return Object.freeze([...tags].sort((a, b) => a.localeCompare(b, 'en')));
}
