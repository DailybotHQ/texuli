/**
 * Illustration slots for texuli.com. Files live under
 * `apps/website/public/illustrations/`; until a file exists the
 * {@link SiteIllustration} component paints a token-based gradient fallback.
 */
import illustrations from '../../data/illustrations.json';

export interface IllustrationEntry {
  slot: string;
  file: string;
  width: number;
  height: number;
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
