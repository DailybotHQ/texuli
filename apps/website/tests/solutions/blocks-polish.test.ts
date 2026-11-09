import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ILLUSTRATIONS, manifestProblems } from '../../src/components/landing/illustrations.ts';
import {
  howArt,
  howSlotId,
  isRegisteredSlot,
  storyArtSlot,
  storySlotId,
} from '../../src/components/solutions/shared/art/art-slots.ts';
import { SOLUTIONS } from '../../src/data/solutions/index.ts';

const SHARED = resolve(import.meta.dirname, '../../src/components/solutions/shared');
const read = (path: string): string => readFileSync(resolve(SHARED, path), 'utf8');
const markupOf = (source: string): string =>
  source.slice(source.lastIndexOf('---') + 3, source.indexOf('<style>'));
const stylesOf = (source: string): string => source.slice(source.indexOf('<style>'));

const stories = read('story/SolutionStories.astro');
const how = read('architecture/SolutionHow.astro');
const hero = read('hero/SolutionHero.astro');
const layout = read('SolutionLayout.astro');

function astroFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return astroFiles(path);
    return name.endsWith('.astro') ? [path] : [];
  });
}

describe('reserved art slots', () => {
  it('names the story and how slots after the Solution slug', () => {
    expect(storySlotId('slides', 0)).toBe('solution-slides-story-1');
    expect(storySlotId('slides', 2)).toBe('solution-slides-story-3');
    expect(howSlotId('canvas')).toBe('solution-canvas-how');
  });

  it('defaults a story to its reserved slot and keeps an explicit one', () => {
    expect(storyArtSlot('sheets', {}, 1)).toEqual({
      slot: 'solution-sheets-story-2',
      variant: 'plate',
    });
    const own = { slot: 'page-slides', variant: 'banner' } as const;
    expect(storyArtSlot('slides', { art: own }, 0)).toBe(own);
  });

  it('renders the how band only for a registered slot', () => {
    const registered = (slot: string) => slot === 'solution-slides-how' || slot === 'known';
    expect(howArt('slides', undefined, registered)).toEqual({
      slot: 'solution-slides-how',
      variant: 'band',
    });
    expect(howArt('canvas', undefined, registered)).toBeUndefined();
    expect(howArt('canvas', { slot: 'known', variant: 'band' }, registered)?.slot).toBe('known');
    expect(howArt('canvas', { slot: 'unknown', variant: 'band' }, registered)).toBeUndefined();
  });

  it('gives every Solution valid slot ids that never fail the build while unregistered', () => {
    for (const entry of SOLUTIONS) {
      const slots = [0, 1, 2].map((i) => storySlotId(entry.slug, i)).concat(howSlotId(entry.slug));
      for (const slot of slots) expect(slot, slot).toMatch(/^[a-z][a-z0-9-]{1,47}$/);
      // Against the real manifest: unregistered → no band; registered → that slot.
      const band = howArt(entry.slug, undefined);
      expect(band?.slot ?? null).toBe(
        isRegisteredSlot(howSlotId(entry.slug)) ? howSlotId(entry.slug) : null
      );
    }
  });

  it('keeps every art below the fold lazy: only the home hero is a priority slot', () => {
    expect(manifestProblems(ILLUSTRATIONS)).toEqual([]);
    expect(ILLUSTRATIONS.filter((entry) => entry.priority).map((entry) => entry.slot)).toEqual([
      'home-hero',
    ]);
  });
});

describe('story bands', () => {
  const markup = markupOf(stories);

  it('paints each story slot in alternating text and art bands, mosaic when unregistered', () => {
    expect(stories).toContain('storyArtSlot(entry.slug, story, index)');
    expect(stories).toContain('illustrationFor(slot) !== undefined');
    expect(markup).toContain('<SiteIllustration art={band.art.slot} />');
    expect(markup).toMatch(/class="solution-story__mosaic" aria-hidden="true"/);
    expect(markup).toMatch(/`solution-story--art-\$\{band\.side\}`/);
  });

  it('opens each band with the home texel mark, decorative only', () => {
    expect(markup).toContain('<TexelMark count={band.mark} />');
    expect(stories).toContain("import TexelMark from '../../../sections/home/TexelMark.astro';");
    expect(stylesOf(stories)).toMatch(
      /\.solution-story__art::before \{[\s\S]*?pointer-events: none;/
    );
  });
});

describe('how-it-works band', () => {
  const markup = markupOf(how);

  it('renders the optional art as a full-width band under the steps, only when registered', () => {
    expect(how).toContain('const art = howArt(Astro.props.entry.slug, Astro.props.art);');
    expect(markup).toMatch(/\{\s*art && \(\s*<div class="solution-how__band"/);
    expect(markup).toContain('<SiteIllustration art={art.slot} />');
    expect(markup.indexOf('solution-how__band')).toBeGreaterThan(markup.indexOf('</figure>'));
    expect(markup.match(/<h2\b/g)).toHaveLength(1);
  });
});

describe('hero composition', () => {
  const markup = markupOf(hero);

  it('composes eyebrow, display h1, status pill and the art plate', () => {
    expect(markup.match(/<h1\b/g)).toHaveLength(1);
    expect(markup).toContain('<TexelMark count={3} />');
    expect(markup).toContain('<span>{view.eyebrow}</span>');
    expect(markup).toContain('data-tx-solution-status={view.status}');
    expect(markup).toMatch(
      /<div class="solution-hero__plate">[\s\S]*?<SiteIllustration art=\{view\.art\.slot\} \/>/
    );
    expect(stylesOf(hero)).toMatch(
      /\.solution-hero h1 \{[\s\S]*?font-size: clamp\(2\.75rem, 9vw, 5\.25rem\);/
    );
  });

  it('keeps the loose texels decorative', () => {
    const loose = markup.match(/<span class="solution-hero__loose[^>]*>/g) ?? [];
    expect(loose).toHaveLength(3);
    for (const tag of loose) expect(tag).toContain('aria-hidden="true"');
  });
});

describe('landing rhythm', () => {
  const styles = stylesOf(layout);

  it('reads the home tokens and alternates tinted bands with a ground close', () => {
    expect(styles).toMatch(/--home-accent: #6d4aff;/);
    expect(styles).toMatch(
      /--home-tint: color-mix\(in oklab, #6d4aff 6%, var\(--tx-background\)\);/
    );
    expect(styles).toMatch(/--solution-band-raised: var\(--home-tint\);/);
    expect(styles).toMatch(
      /\[data-solution-section='next'\] \{\s*background: var\(--home-ground\);/
    );
    expect(styles).toMatch(/data-tx-mode='high-contrast'/);
  });

  it('reveals bands with CSS only, behind reduced motion and scroll-timeline support', () => {
    const motion = styles.slice(styles.indexOf('@media (prefers-reduced-motion: no-preference)'));
    expect(motion.length).toBeLessThan(styles.length);
    expect(motion).toMatch(
      /^@media \(prefers-reduced-motion: no-preference\) \{\s*@supports \(animation-timeline: view\(\)\)/
    );
    expect(motion).toContain(':not([data-solution-island])');
    const keyframes = styles.slice(styles.indexOf('@keyframes solution-rise'));
    expect(keyframes).toMatch(/translate: 0 1\.5rem;/);
    expect(keyframes.slice(0, keyframes.indexOf('}\n  }') + 1)).not.toMatch(/opacity/);
    // The only animation in the layout is inside the guarded block.
    expect(styles.indexOf('animation-name')).toBeGreaterThan(
      styles.indexOf('prefers-reduced-motion')
    );
  });
});

describe('every shared block', () => {
  const files = astroFiles(SHARED);

  it('stays sink-free with logical CSS, and the polished blocks ship no script', () => {
    expect(files.length).toBeGreaterThan(10);
    for (const source of [stories, how, hero, layout]) expect(source).not.toMatch(/<script\b/);
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const markup = source.includes('<style>') ? markupOf(source) : source;
      expect(source, file).not.toMatch(/set:html|\{@html|innerHTML/);
      expect(markup, file).not.toMatch(/client:[a-z]+/);
      if (source.includes('<style>')) {
        expect(stylesOf(source), file).not.toMatch(
          /margin-(left|right)|padding-(left|right)|\b(left|right|top|bottom):/
        );
      }
    }
  });

  it('animates nothing outside a reduced-motion guard', () => {
    for (const file of files) {
      const styles = readFileSync(file, 'utf8');
      const first = styles.search(/animation(-name)?:|transition:/);
      if (first === -1) continue;
      expect(styles.lastIndexOf('prefers-reduced-motion', first), file).toBeGreaterThan(-1);
    }
  });
});
