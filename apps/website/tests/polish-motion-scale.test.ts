import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const siteStyles = read('../src/styles/site-layers.css');
const landing = read('../src/pages/index.astro');
const story = read('../src/components/brand/StoryStrip.astro');
const liveDemo = read('../src/components/primitives-page/live/LiveDemo.svelte');
const baseLayout = read('../src/layouts/BaseLayout.astro');
const examplePreviewLayout = read('../src/layouts/ExamplePreviewLayout.astro');
const galleryPreview = read('../src/pages/gallery-components/preview.astro');
const baseCss = read('../../../packages/tokens/src/css/base.css');

describe('website motion system', () => {
  it('defines one duration and easing scale for site motion', () => {
    expect(siteStyles).toContain('--site-motion-fast: 120ms;');
    expect(siteStyles).toContain('--site-motion-base: 180ms;');
    expect(siteStyles).toContain('--site-motion-slow: 280ms;');
    expect(siteStyles).toContain('--site-motion-ambient: 2.8s;');
    expect(siteStyles).toContain('--site-motion-easing: cubic-bezier(0.2, 0, 0, 1);');
    expect(siteStyles).toContain('--site-motion-linked-easing: linear;');
  });

  it('uses the scale on every time-based transition and animation', () => {
    expect(liveDemo).toContain(
      'transition: background-color var(--site-motion-fast) var(--site-motion-easing);'
    );
    expect(story).toContain('animation-duration: var(--site-motion-ambient);');
    expect(story).toContain('animation-timing-function: var(--site-motion-easing);');
    expect(story).toContain('animation-delay: var(--site-motion-fast);');
    expect(story).toContain('animation-delay: var(--site-motion-base);');
    expect(story).toContain('animation-delay: var(--site-motion-slow);');
    expect(landing).toContain('animation-timing-function: var(--site-motion-linked-easing);');
  });

  it('keeps motion to paint or transform properties and the landing reveal opt-in', () => {
    expect(liveDemo).toMatch(/transition:\s*background-color\b/);
    expect(liveDemo).not.toMatch(
      /transition:\s*(?:all|(?:[^;]*,\s*)?(?:margin|padding|width|height|top|left|right|bottom)\b)/
    );
    expect(story).toMatch(/@keyframes texel-pulse[\s\S]*?opacity:/);
    expect(landing).toContain('@media (prefers-reduced-motion: no-preference)');
    expect(landing).toContain('@supports (animation-timeline: view())');
    expect(landing).toContain('translate: 0 1.5rem;');
  });

  it('keeps the shared reduced-motion stylesheet on every base page', () => {
    expect(baseLayout).toContain("import '@texuli/tokens/base.css';");
    expect(examplePreviewLayout).toContain("import '@texuli/tokens/base.css';");
    expect(galleryPreview).toContain("import '@texuli/tokens/base.css';");
    const reducedMotion = baseCss.split('@media (prefers-reduced-motion: reduce)')[1];
    expect(reducedMotion).toContain('animation-duration: 0.01ms !important;');
    expect(reducedMotion).toContain('transition-duration: 0.01ms !important;');
    expect(reducedMotion).toContain('scroll-behavior: auto !important;');
  });
});
