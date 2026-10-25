/**
 * Framework-free palette model: catalog manifests → searchable, grouped
 * entries. It imports nothing from the website, so it can move into a
 * future `@texuli/builder/palette` unchanged (builder-design §10, draft).
 */
import type { CatalogManifest } from '@texuli/catalog';

export const PALETTE_GROUPS = [
  'Layouts',
  'Content blocks',
  'Charts',
  'Media',
  'Interaction',
  'Chat display',
] as const;
export type PaletteGroup = (typeof PALETTE_GROUPS)[number];

/**
 * Why an entry can or cannot be inserted by this host:
 * - `insertable`: the host accepts it and the player paints it;
 * - `no-painter`: Tier U, but the player has no painter for it here;
 * - `not-in-host`: painted, but this host does not edit it yet.
 */
export type PaletteAvailability = 'insertable' | 'no-painter' | 'not-in-host';

export interface PaletteEntry {
  id: string;
  label: string;
  summary: string;
  /** The manifest's catalog tier (`content` or `app`). */
  tier: CatalogManifest['tier'];
  package: string;
  group: PaletteGroup;
  /** Props the manifest marks `required`. */
  requiredProps: number;
  useWhen: readonly string[];
  availability: PaletteAvailability;
  /** Why an unavailable entry cannot be inserted here; `null` when it can. */
  note: string | null;
}

export interface PaletteSources {
  /** Ids the player can paint (keys of its loader map). */
  paintable: (id: string) => boolean;
  /** Ids the host can insert. */
  insertable: (id: string) => boolean;
  /** The specific reason an id is unavailable, when the host knows one (else the generic note). */
  reason?: (id: string) => string | undefined;
}

export const AVAILABILITY_NOTES: Readonly<
  Record<Exclude<PaletteAvailability, 'insertable'>, string>
> = Object.freeze({
  'no-painter': 'Shown for reference: the player has no painter for it here.',
  'not-in-host': 'Shown for reference: this builder does not edit it yet.',
});

export function paletteGroup(manifest: Pick<CatalogManifest, 'id' | 'package'>): PaletteGroup {
  if (manifest.id.startsWith('layout-') || manifest.id === 'deck-slide') return 'Layouts';
  if (manifest.id.startsWith('charts-')) return 'Charts';
  if (manifest.id.startsWith('media-')) return 'Media';
  if (manifest.id.startsWith('chat-')) return 'Chat display';
  if (/^(control|flow|action|form|host)-/.test(manifest.id)) return 'Interaction';
  return 'Content blocks';
}

/** Tier U entries (agent-emittable manifests only), ordered by group then label. */
export function createPaletteEntries(
  manifests: readonly CatalogManifest[],
  sources: PaletteSources
): PaletteEntry[] {
  const seen = new Set<string>();
  const entries: PaletteEntry[] = [];
  for (const manifest of manifests) {
    if (manifest.agentEmittable !== true || seen.has(manifest.id)) continue;
    seen.add(manifest.id);
    const availability: PaletteAvailability = !sources.paintable(manifest.id)
      ? 'no-painter'
      : sources.insertable(manifest.id)
        ? 'insertable'
        : 'not-in-host';
    entries.push({
      id: manifest.id,
      label: manifest.label,
      summary: manifest.summary,
      tier: manifest.tier,
      package: manifest.package,
      group: paletteGroup(manifest),
      requiredProps: manifest.props.filter((prop) => prop.required === true).length,
      useWhen: manifest.useWhen,
      availability,
      note:
        availability === 'insertable'
          ? null
          : (sources.reason?.(manifest.id) ?? AVAILABILITY_NOTES[availability]),
    });
  }
  return entries.sort(
    (left, right) =>
      PALETTE_GROUPS.indexOf(left.group) - PALETTE_GROUPS.indexOf(right.group) ||
      left.label.localeCompare(right.label, 'en')
  );
}

/**
 * Case-insensitive search over label, id, group, summary and `useWhen` hints.
 * Every whitespace-separated term must match somewhere; an empty query keeps all.
 */
export function searchPalette(entries: readonly PaletteEntry[], query: string): PaletteEntry[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...entries];
  return entries.filter((entry) => {
    const haystack = [entry.label, entry.id, entry.group, entry.summary, ...entry.useWhen]
      .join('\n')
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

export function groupPalette(
  entries: readonly PaletteEntry[]
): { group: PaletteGroup; entries: PaletteEntry[] }[] {
  return PALETTE_GROUPS.map((group) => ({
    group,
    entries: entries.filter((entry) => entry.group === group),
  })).filter((section) => section.entries.length > 0);
}

/** Live-region text for the result count. */
export function paletteCountText(shown: number, total: number): string {
  if (shown === total) return `${total} components`;
  if (shown === 0) return `No components match. ${total} available.`;
  return `${shown} of ${total} components`;
}

/** Next active option for ArrowDown/ArrowUp, wrapping; `-1` when the list is empty. */
export function moveActive(current: number, length: number, step: 1 | -1): number {
  if (length === 0) return -1;
  if (current < 0) return step === 1 ? 0 : length - 1;
  return (current + step + length) % length;
}
