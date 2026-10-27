// @vitest-environment node
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * The site llms.txt generator (T-100 P2-5) exports its inputs so the
 * site-aeo spec compares the served file with exactly what the generator
 * emits, instead of a hand copy of the title, summary and intro. Importing
 * it must not write the file.
 */

const OUT = join(import.meta.dirname, '../../apps/website/public/llms.txt');

describe('generate-site-llms exports', () => {
  it('imports without writing public/llms.txt and exposes one config', async () => {
    const before = statSync(OUT).mtimeMs;
    const generator = await import('../generate-site-llms.ts');
    expect(statSync(OUT).mtimeMs).toBe(before);
    expect(generator.SITE_LLMS_CONFIG.title).toBe('Texuli');
    expect(generator.SITE_LLMS_CONFIG.summary.length).toBeGreaterThan(20);
    expect(generator.SITE_LLMS_CONFIG.intro.length).toBeGreaterThan(60);
  });

  it('builds the committed file byte for byte', async () => {
    const { buildSiteLlmsTxt } = await import('../generate-site-llms.ts');
    expect(buildSiteLlmsTxt()).toBe(readFileSync(OUT, 'utf8'));
  });
});
