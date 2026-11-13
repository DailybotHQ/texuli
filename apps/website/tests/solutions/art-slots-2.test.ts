// @vitest-environment node
/**
 * Round-2 illustration slots: the three landing stories and the how-it-works band of each
 * Solution. Every slot is registered in the manifest with its size, variant, alt and a
 * self-contained prompt, is listed in the generated prompts doc, and ships its light WebP in
 * `src/assets/illustrations/` at the exact size with an alpha channel (dark variants optional).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PROMPTS_DOC } from '../../scripts/illustration-prompts.ts';
import { ILLUSTRATIONS, illustrationFor } from '../../src/components/landing/illustrations.ts';
import { SOLUTIONS } from '../../src/data/solutions/index.ts';
import { webpInfo } from '../webp-info.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const SLUGS = ['slides', 'documents', 'workflows', 'canvas', 'sheets'] as const;
const PARTS = [
  { part: 'story-1', variant: 'plate', width: 1600, height: 1000 },
  { part: 'story-2', variant: 'plate', width: 1600, height: 1000 },
  { part: 'story-3', variant: 'plate', width: 1600, height: 1000 },
  { part: 'how', variant: 'band', width: 1600, height: 700 },
] as const;
const ROUND_2 = SLUGS.flatMap((slug) =>
  PARTS.map(({ part, ...size }) => ({ slot: `solution-${slug}-${part}`, ...size }))
);

describe('round-2 illustration slots', () => {
  it('covers each implemented Solution landing with three stories and a how band', () => {
    expect([...SLUGS].sort()).toEqual(
      SOLUTIONS.filter((entry) =>
        (['slides', 'documents', 'workflows', 'canvas', 'sheets'] as const).includes(
          entry.slug as (typeof SLUGS)[number]
        )
      )
        .map((s) => s.slug)
        .sort()
    );
    expect(ROUND_2).toHaveLength(20);
    expect(new Set(ILLUSTRATIONS.map((e) => e.slot)).size).toBe(ILLUSTRATIONS.length);
  });

  it('registers each slot with its size, variant, alt and a matching prompt', () => {
    for (const { slot, variant, width, height } of ROUND_2) {
      const entry = illustrationFor(slot);
      expect(entry, slot).toBeDefined();
      if (!entry) continue;
      expect({ variant: entry.variant, width: entry.width, height: entry.height }, slot).toEqual({
        variant,
        width,
        height,
      });
      expect(entry.file).toBe(`${slot}.webp`);
      expect(entry.fileDark).toBe(`${slot}-dark.webp`);
      expect(entry.priority, slot).toBeUndefined();
      expect(entry.alt.length, slot).toBeGreaterThan(20);
      expect(entry.prompt, slot).toContain(`exactly ${width}x${height} pixels`);
      expect(entry.prompt, slot).toContain(`saved as ${slot}.webp`);
      expect(entry.prompt, slot).toContain(`save it as ${slot}-dark.webp`);
      expect(entry.prompt, slot).toContain('Background: true transparent alpha');
    }
  });

  it('lists each slot in the generated prompts doc with its alt', () => {
    const doc = readFileSync(PROMPTS_DOC, 'utf8');
    for (const { slot } of ROUND_2) {
      const entry = illustrationFor(slot);
      expect(doc, slot).toContain(`\n## ${slot}\n`);
      expect(doc, slot).toContain(`Alt text on the page: ${entry?.alt}`);
    }
  });

  it('ships each light WebP at its exact size with an alpha channel, and no dark file yet', () => {
    const dir = resolve(WEBSITE, 'src/assets/illustrations');
    const files = new Set(readdirSync(dir));
    for (const { slot, width, height } of ROUND_2) {
      const info = webpInfo(readFileSync(resolve(dir, `${slot}.webp`)));
      expect(info, slot).toEqual({ width, height, alpha: true });
      expect(files.has(`${slot}-dark.webp`), slot).toBe(false);
    }
  });
});
