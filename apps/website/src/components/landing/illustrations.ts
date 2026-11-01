/**
 * Illustration slots for texuli.com. Files live under
 * `apps/website/public/illustrations/`; until a file exists the
 * {@link SiteIllustration} component paints a token-based texel fallback.
 * The style, sizes and drop-in procedure are in `docs/ILLUSTRATIONS.md`.
 */
import illustrations from '../../data/illustrations.json';

/** How a slot is framed: page banner, frameless landing plate, or full-width band. */
export const ILLUSTRATION_VARIANTS = ['banner', 'plate', 'band'] as const;
export type IllustrationVariant = (typeof ILLUSTRATION_VARIANTS)[number];

export interface IllustrationEntry {
  slot: string;
  file: string;
  /** Optional dark-theme variant; without it the dark theme frames the light file. */
  fileDark?: string;
  width: number;
  height: number;
  variant: IllustrationVariant;
  /** Above-the-fold art (the landing hero): eager load, high fetch priority. */
  priority?: boolean;
  alt: string;
  prompt: string;
  model: string;
  created: string;
}

export const ILLUSTRATIONS: readonly IllustrationEntry[] = Object.freeze(
  (illustrations as IllustrationEntry[]).map((entry) => Object.freeze({ ...entry }))
);

const bySlot = new Map(ILLUSTRATIONS.map((entry) => [entry.slot, entry]));

/** Look up a slot from the manifest, or `undefined` when unknown. */
export function illustrationFor(slot: string): IllustrationEntry | undefined {
  return bySlot.get(slot);
}

/** Public path for an illustration file (site-base relative). */
export function illustrationSrc(file: string, base: string): string {
  const root = base.endsWith('/') ? base : `${base}/`;
  return `${root}illustrations/${file.replace(/^\/+/, '')}`;
}

const SLOT_ID = /^[a-z][a-z0-9-]{1,47}$/;
const WEBP = /^[a-z0-9][a-z0-9-]*\.webp$/;

/** Every problem in a manifest, as readable messages (empty when valid). */
export function manifestProblems(entries: readonly IllustrationEntry[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  let priorities = 0;
  for (const entry of entries) {
    const at = `slot "${entry.slot}"`;
    if (!SLOT_ID.test(entry.slot)) problems.push(`${at}: id must be lowercase kebab-case`);
    if (seen.has(entry.slot)) problems.push(`${at}: duplicate slot`);
    seen.add(entry.slot);
    if (!WEBP.test(entry.file)) problems.push(`${at}: file must be a .webp name`);
    if (
      entry.fileDark !== undefined &&
      (!WEBP.test(entry.fileDark) || entry.fileDark === entry.file)
    )
      problems.push(`${at}: fileDark must be a different .webp name`);
    for (const side of ['width', 'height'] as const)
      if (!Number.isInteger(entry[side]) || entry[side] <= 0)
        problems.push(`${at}: ${side} must be a positive integer`);
    if (!ILLUSTRATION_VARIANTS.includes(entry.variant))
      problems.push(`${at}: variant must be one of ${ILLUSTRATION_VARIANTS.join(', ')}`);
    if (entry.alt.trim().split(/\s+/).length < 8)
      problems.push(`${at}: alt must describe the scene in at least 8 words`);
    if (entry.prompt.trim() === '') problems.push(`${at}: prompt is required`);
    if (entry.priority) priorities += 1;
  }
  if (priorities > 1) problems.push('only one slot may set priority (the landing hero)');
  return problems;
}
