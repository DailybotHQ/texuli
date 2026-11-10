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
  ILLUSTRATION_SIZES,
  ILLUSTRATIONS,
  type IllustrationEntry,
  illustrationFor,
  illustrationWidths,
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
      for (const match of readFileSync(file, 'utf8').matchAll(/\bart="([a-z][a-z0-9-]*)"/g)) {
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

  it('swaps to the dark file only under the dark theme, and frames only the fallback', () => {
    expect(source).toContain(
      ":global(:root[data-tx-mode='dark']) .site-illustration--has-dark .site-illustration__dark"
    );
    expect(source).toMatch(/\.site-illustration__dark \{\s+display: none !important;/);
    // Transparent art sits bare on the page: no border, ground or shadow.
    expect(source).toMatch(/\.site-illustration \{(?:(?!\})[\s\S])*\}/);
    expect(source.match(/\.site-illustration \{(?:(?!\})[\s\S])*\}/)?.[0]).not.toMatch(
      /border|background|box-shadow/
    );
    expect(source).toMatch(/\.site-illustration--fallback \{[^}]*border: 1px solid/);
    expect(source).not.toContain('box-shadow');
  });

  it('offers smaller build-time widths with a sizes hint, ending at the full file', () => {
    expect(illustrationWidths({ variant: 'plate', width: 1600 })).toEqual([
      400, 600, 800, 1200, 1600,
    ]);
    expect(illustrationWidths({ variant: 'plate', width: 1040 })).toEqual([400, 600, 800, 1040]);
    expect(illustrationWidths({ variant: 'band', width: 1600 })).toEqual([800, 1200, 1600]);
    expect(illustrationWidths({ variant: 'banner', width: 1920 })).toEqual([400, 800, 1200, 1920]);
    for (const entry of ILLUSTRATIONS)
      expect(ILLUSTRATION_SIZES[entry.variant], entry.slot).toBeTruthy();
    expect(source).toContain('srcset={light.srcset}');
    expect(source).toContain('sizes={sizes}');
  });
});

describe('illustration prompts', () => {
  it('makes every prompt self-contained: subject, camera, palette, no-text rule, size and file', () => {
    for (const entry of ILLUSTRATIONS) {
      const { prompt } = entry;
      expect(prompt.split(/\s+/).length, entry.slot).toBeGreaterThanOrEqual(90);
      expect(prompt, entry.slot).toMatch(/^Subject: /);
      expect(prompt, entry.slot).toContain('isometric');
      for (const hex of ['#F7F5FB', '#6D4AFF', '#B9A8FF', '#FF8A4C'])
        expect(prompt, `${entry.slot} ${hex}`).toContain(hex);
      // Background: the lavender-to-peach ground of the first slots, or the transparent
      // background ILLUSTRATIONS.md now asks of every file.
      const gradient = prompt.includes('#F4F0FF') && prompt.includes('#FFF4EE');
      const transparent = prompt.includes('Background: true transparent alpha');
      expect(gradient || transparent, `${entry.slot} background`).toBe(true);
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

describe('slots awaiting their artwork', () => {
  const NEW_SLOTS = [
    'solution-slides-hero',
    'solution-documents-hero',
    'solution-workflows-hero',
    'solution-canvas-hero',
    'solution-sheets-hero',
    'native-hero',
    'page-built-with',
    'home-built-with',
    'built-with-protoyard',
    'page-solutions',
    'native-shared-blueprint',
    'native-parity',
    'native-solutions',
    'native-agents',
    'native-start',
  ];

  it('registers every new slot with its size, variant and a transparent-background prompt', () => {
    for (const slot of NEW_SLOTS) {
      const entry = illustrationFor(slot);
      expect(entry, slot).toBeDefined();
      if (!entry) continue;
      expect(entry.file).toBe(`${slot}.webp`);
      expect(entry.priority, slot).toBeUndefined();
      expect(entry.prompt, slot).toContain('Background: true transparent alpha');
      const expected = slot.startsWith('page-')
        ? { variant: 'banner', width: 1920, height: 640 }
        : slot === 'native-start'
          ? { variant: 'plate', width: 1200, height: 800 }
          : slot.endsWith('-hero')
            ? { variant: 'plate', width: 1200, height: 1000 }
            : { variant: 'plate', width: 1600, height: 1000 };
      expect({ variant: entry.variant, width: entry.width, height: entry.height }, slot).toEqual(
        expected
      );
      if (entry.variant === 'banner') expect(entry.fileDark, slot).toBeUndefined();
      else expect(entry.fileDark, slot).toBe(`${slot}-dark.webp`);
    }
  });

  it('ships no file yet, so each slot paints the texel mosaic fallback', () => {
    const files = new Set(readdirSync(resolve(WEBSITE, 'src/assets/illustrations')));
    for (const slot of NEW_SLOTS) expect(files.has(`${slot}.webp`), slot).toBe(false);
    const source = read('src/components/landing/SiteIllustration.astro');
    expect(source).toContain("data-tx-illustration-ready={hasFile ? 'file' : 'fallback'}");
    expect(source).toContain('class="site-illustration__texels"');
  });
});

describe('design-systems landing slots (PLAN_017 T-art, ADR-033)', () => {
  const SLOTS = [
    'solution-design-systems-hero',
    'solution-design-systems-story-1',
    'solution-design-systems-story-2',
    'solution-design-systems-story-3',
    'solution-design-systems-story-4',
    'solution-design-systems-story-5',
    'solution-design-systems-how',
    'solution-design-systems-protoyard',
  ];

  it('registers the hero, five stories, the how band and Built with at their sizes', () => {
    for (const slot of SLOTS) {
      const entry = illustrationFor(slot);
      expect(entry, slot).toBeDefined();
      if (!entry) continue;
      expect(entry.file).toBe(`${slot}.webp`);
      expect(entry.fileDark).toBe(`${slot}-dark.webp`);
      expect(entry.priority, slot).toBeUndefined();
      expect(entry.prompt, slot).toContain('Background: true transparent alpha');
      const expected = slot.endsWith('-hero')
        ? { variant: 'plate', width: 1200, height: 1000 }
        : slot.endsWith('-how')
          ? { variant: 'band', width: 1600, height: 700 }
          : { variant: 'plate', width: 1600, height: 1000 };
      expect({ variant: entry.variant, width: entry.width, height: entry.height }, slot).toEqual(
        expected
      );
    }
  });

  it('ships no file yet, so each slot paints the texel mosaic fallback', () => {
    const files = new Set(readdirSync(resolve(WEBSITE, 'src/assets/illustrations')));
    for (const slot of SLOTS) expect(files.has(`${slot}.webp`), slot).toBe(false);
  });
});

describe('platform page banners', () => {
  it('gives every platform page an on-style banner slot', () => {
    const banners: Record<string, string> = {
      'web-and-native/index.astro': 'art="page-web-and-native"',
      'design-systems/index.astro': 'art="page-design-systems"',
      'mcp-server/index.astro': 'art="page-mcp"',
      'forms-page/index.astro': 'art="page-forms" slot="banner"',
      'sheets-page/index.astro': 'art="page-sheets" slot="banner"',
      'canvas-page/index.astro': 'art="page-canvas" slot="banner"',
      'documents-page/index.astro': 'art="page-documents"',
      'slides-page/index.astro': 'art="page-slides"',
      'workflows-page/index.astro': 'art="page-workflows"',
      'dashboards-page/index.astro': 'art="page-dashboards" slot="banner"',
    };
    for (const [page, marker] of Object.entries(banners)) {
      expect(read(`src/pages/${page}`), page).toContain(marker);
      const slot = /"(page-[a-z-]+)"/.exec(marker)?.[1] ?? '';
      expect(illustrationFor(slot)?.variant, slot).toBe('banner');
    }
    const frame = read('src/components/feature-site/FeaturePage.astro');
    expect(frame).toContain('<slot name="banner" />');
    // The frame never imports the banner itself, so pages without one carry none of its CSS.
    expect(frame).not.toContain('PageBanner.astro');
  });

  it('never passes the slot id as `slot`, which Astro drops on a layout child', () => {
    // `slot="banner"` is the FeaturePage named slot, not a slot id; any other `slot=` is the bug.
    const offenders = astroFiles(resolve(WEBSITE, 'src')).filter((file) =>
      /<(?:PageBanner|SiteIllustration)\s[^>]*\bslot="(?!banner")/.test(readFileSync(file, 'utf8'))
    );
    expect(offenders).toEqual([]);
  });
});
