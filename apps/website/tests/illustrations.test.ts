// @vitest-environment node
/**
 * Illustration slots (PLAN_012 T-illustration-slots, T-illustration-prompts):
 * the manifest is well formed, every slot a template names exists, the
 * component reserves the aspect ratio, loads only the hero eagerly and swaps
 * the dark file under the dark theme, and every prompt is self-contained
 * (style, palette, no-text rule, exact size, file name).
 * Templates are read as source (the root config does not compile .astro);
 * the rendered slots are covered by tests/e2e/site-landing.spec.ts.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PROMPTS_DOC, renderPromptsDoc } from '../scripts/illustration-prompts.ts';
import {
  ILLUSTRATIONS,
  type IllustrationEntry,
  illustrationFor,
  manifestProblems,
} from '../src/components/landing/illustrations.ts';

const WEBSITE = resolve(import.meta.dirname, '..');
const read = (path: string): string => readFileSync(resolve(WEBSITE, path), 'utf8');

function astroFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return astroFiles(path);
    return path.endsWith('.astro') ? [path] : [];
  });
}

const valid: IllustrationEntry = {
  slot: 'home-sample',
  file: 'home-sample.webp',
  width: 1600,
  height: 1000,
  variant: 'plate',
  alt: 'A small stack of violet cubes beside a pearl window',
  prompt: 'A prompt.',
  model: '',
  created: '',
};

describe('illustration manifest', () => {
  it('is well formed', () => {
    expect(manifestProblems(ILLUSTRATIONS)).toEqual([]);
  });

  it('reports each kind of broken entry', () => {
    expect(manifestProblems([valid])).toEqual([]);
    const broken = manifestProblems([
      valid,
      { ...valid, slot: 'Bad Slot', file: 'x.png' },
      { ...valid, fileDark: 'home-sample.webp', width: 0 },
      { ...valid, slot: 'home-two', variant: 'poster' as never, alt: 'too short', prompt: ' ' },
      { ...valid, slot: 'home-three', priority: true },
      { ...valid, slot: 'home-four', priority: true },
    ]);
    for (const fragment of [
      'kebab-case',
      'must be a .webp',
      'fileDark must be',
      'width must be',
      'duplicate slot',
      'variant must be',
      'at least 8 words',
      'prompt is required',
      'only one slot may set priority',
    ])
      expect(broken.join('\n')).toContain(fragment);
  });

  it('lets only the landing hero load eagerly', () => {
    expect(ILLUSTRATIONS.filter((entry) => entry.priority).map((entry) => entry.slot)).toEqual([
      'home-hero',
    ]);
  });

  it('has a manifest entry for every slot a template names', () => {
    const used = new Set<string>();
    for (const file of astroFiles(resolve(WEBSITE, 'src'))) {
      for (const match of readFileSync(file, 'utf8').matchAll(/\bslot="([a-z][a-z0-9-]*)"/g)) {
        const [, slot] = match;
        if (slot && (slot.startsWith('home-') || slot.startsWith('page-'))) used.add(slot);
      }
    }
    expect(used.size).toBeGreaterThan(0);
    for (const slot of used) expect(illustrationFor(slot), slot).toBeDefined();
  });
});

describe('SiteIllustration', () => {
  const source = read('src/components/landing/SiteIllustration.astro');

  it('reserves the aspect ratio and explicit dimensions with or without a file', () => {
    expect(source).toMatch(/--si-ratio:\$\{ratio\}/);
    expect(source).toMatch(/aspect-ratio:\$\{ratio\}/);
    expect(source).toMatch(/width=\{entry\.width\}\s+height=\{entry\.height\}/);
  });

  it('loads eagerly with high priority only for a priority slot', () => {
    expect(source).toContain("loading={eager ? 'eager' : 'lazy'}");
    expect(source).toContain("fetchpriority={eager ? 'high' : undefined}");
  });

  it('swaps to the dark file only under the dark theme, and frames plates otherwise', () => {
    expect(source).toContain(
      ":global(:root[data-tx-mode='dark']) .site-illustration--has-dark .site-illustration__dark"
    );
    expect(source).toMatch(/\.site-illustration__dark \{\s+display: none !important;/);
    expect(source).toContain(":global(:root[data-tx-mode='dark']) .site-illustration--plate");
  });
});

describe('illustration prompts', () => {
  it('makes every prompt self-contained: subject, camera, palette, no-text rule, size and file', () => {
    for (const entry of ILLUSTRATIONS) {
      const { prompt } = entry;
      expect(prompt.split(/\s+/).length, entry.slot).toBeGreaterThanOrEqual(90);
      expect(prompt, entry.slot).toMatch(/^Subject: /);
      expect(prompt, entry.slot).toContain('isometric');
      for (const hex of ['#F7F5FB', '#6D4AFF', '#B9A8FF', '#FF8A4C', '#F4F0FF', '#FFF4EE'])
        expect(prompt, `${entry.slot} ${hex}`).toContain(hex);
      expect(prompt, entry.slot).toContain('No text: absolutely no letters, words, numbers');
      expect(prompt, entry.slot).toContain(`exactly ${entry.width}x${entry.height} pixels`);
      expect(prompt, entry.slot).toContain(`saved as ${entry.file}`);
      if (entry.fileDark) expect(prompt, entry.slot).toContain(`save it as ${entry.fileDark}`);
    }
  });

  it('keeps the generated prompts doc in sync with the manifest', () => {
    expect(readFileSync(PROMPTS_DOC, 'utf8')).toBe(renderPromptsDoc(ILLUSTRATIONS));
  });
});
