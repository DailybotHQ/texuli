import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import AvatarHarness from './fixtures/AvatarHarness.svelte';

/**
 * G79: the loading image is never `hidden`. A host rule such as Tailwind v4's
 * `[hidden] { display: none !important }` keeps a hidden lazy image from
 * rendering, so the browser never fetches it and the fallback stays forever.
 * While loading it is rendered, visually hidden and `aria-hidden`; once loaded
 * it is a plain visible image. The browser check (with that host rule
 * injected) is tests/e2e/bugs-75-79.spec.ts.
 */

/** A fictional URL happy-dom never fetches: the test fires `load` itself. */
const SRC = 'https://cdn.example/ada.webp';

afterEach(() => cleanup());

describe('Avatar.Image while loading (G79)', () => {
  it('stays rendered (not hidden) and visually hidden until it loads, then shows', async () => {
    const view = render(AvatarHarness, { props: { src: SRC } });
    const img = view.container.querySelector('[data-tx-avatar-image]') as HTMLImageElement;
    expect(img.hasAttribute('hidden')).toBe(false);
    expect(img.getAttribute('aria-hidden')).toBe('true');
    expect(img.style.opacity).toBe('0');
    expect(img.style.position).toBe('absolute');
    expect(view.container.querySelector('[data-tx-avatar-fallback]')).toBeTruthy();

    await fireEvent.load(img);
    expect(img.hasAttribute('hidden')).toBe(false);
    expect(img.hasAttribute('aria-hidden')).toBe(false);
    expect(img.getAttribute('style') ?? '').toBe('');
    expect(view.container.querySelector('[data-tx-avatar-fallback]')).toBeNull();
  });
});
