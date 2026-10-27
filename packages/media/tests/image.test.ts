import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { Image } from '../src/image/entry.ts';
import {
  buildSrcset,
  focalPointPosition,
  IMAGE_LIMITS,
  intrinsicSize,
  normalizeFit,
  normalizeFocalPoint,
  normalizeWidths,
  resolveImageSources,
  resolvePlaceholder,
  safeSizes,
} from '../src/index.ts';

const PHOTO = 'https://images.example.com/harbor.jpg';
const DATA_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const cdn = (src: string, width: number) => `${src}?w=${width}`;

describe('resolveImageSources', () => {
  it('keeps https and relative sources and drops unsafe ones, and 6 related cases', () => {
    // keeps https and relative sources and drops unsafe ones
    expect(resolveImageSources({ src: PHOTO }).src).toBe(PHOTO);
    expect(resolveImageSources({ src: '/assets/harbor.webp' }).src).toBe('/assets/harbor.webp');
    for (const src of [
      'javascript:alert(1)',
      'http://images.example.com/a.jpg',
      DATA_PNG,
      '//evil.example/a.jpg',
      'https://user:pass@images.example.com/a.jpg',
      'vbscript:x',
      'https://images.example.com/a b.jpg',
      42,
      undefined,
    ]) {
      const resolved = resolveImageSources({ src });
      expect(resolved.src, String(src)).toBeUndefined();
      expect(resolved.dropped).toContain('src');
    }
    cleanup();
    // widens the policy only for developer trust
    expect(
      resolveImageSources({ src: 'http://localhost:5173/a.png', trust: 'developer' }).src
    ).toBe('http://localhost:5173/a.png');
    expect(resolveImageSources({ src: DATA_PNG, trust: 'developer' }).src).toBe(DATA_PNG);
    expect(
      resolveImageSources({ src: 'javascript:alert(1)', trust: 'developer' }).src
    ).toBeUndefined();
    cleanup();
    {
      // drops a whole srcset when one candidate is unsafe
      expect(
        resolveImageSources({ src: PHOTO, srcset: `${PHOTO} 1x, ${PHOTO}?d=2 2x` }).srcset
      ).toBe(`${PHOTO} 1x, ${PHOTO}?d=2 2x`);
      const mixed = resolveImageSources({
        src: PHOTO,
        srcset: `${PHOTO} 480w, javascript:alert(1) 960w`,
        sizes: '50vw',
      });
      expect(mixed.srcset).toBeUndefined();
      expect(mixed.sizes).toBeUndefined();
      expect(mixed.dropped).toEqual(['srcset']);
    }
    cleanup();
    {
      // builds a responsive srcset from a loader
      const resolved = resolveImageSources({
        src: PHOTO,
        widths: [960, 480, 480, -1, 1.5, 1_920],
        loader: cdn,
        sizes: '(min-width: 48rem) 50vw, 100vw',
      });
      expect(resolved.srcset).toBe(
        `${PHOTO}?w=480 480w, ${PHOTO}?w=960 960w, ${PHOTO}?w=1920 1920w`
      );
      expect(resolved.sizes).toBe('(min-width: 48rem) 50vw, 100vw');
    }
    cleanup();
    {
      // drops a generated srcset when the loader misbehaves
      expect(buildSrcset(PHOTO, [480], () => 'javascript:alert(1)')).toBeUndefined();
      expect(
        buildSrcset(PHOTO, [480], () => {
          throw new Error('cdn down');
        })
      ).toBeUndefined();
      const resolved = resolveImageSources({
        src: PHOTO,
        widths: [480],
        loader: () => '//evil.example/x',
      });
      expect(resolved.srcset).toBeUndefined();
      expect(resolved.dropped).toEqual(['loader']);
      expect(resolved.src).toBe(PHOTO);
    }
    cleanup();
    {
      // caps and sorts widths
      const many = Array.from({ length: 40 }, (_, i) => (40 - i) * 100);
      const widths = normalizeWidths(many);
      expect(widths).toHaveLength(IMAGE_LIMITS.widths);
      expect(widths[0]).toBe(100);
      expect(normalizeWidths([99_999])).toEqual([IMAGE_LIMITS.dimension]);
      expect(normalizeWidths(undefined)).toEqual([]);
    }
    cleanup();
    // accepts only media conditions and lengths in sizes
    expect(safeSizes(' (max-width: 600px)  100vw, calc(50vw - 2rem) ')).toBe(
      '(max-width: 600px) 100vw, calc(50vw - 2rem)'
    );
    expect(safeSizes('100vw"; onerror="alert(1)')).toBeUndefined();
    expect(safeSizes('<script>')).toBeUndefined();
    expect(safeSizes('x'.repeat(IMAGE_LIMITS.sizes + 1))).toBeUndefined();
  });
});

describe('focal point, placeholder and size', () => {
  it('clamps the focal point and maps it to object-position; validates placeholders; accepts only positive integer dimensions', () => {
    // clamps the focal point and maps it to object-position
    expect(normalizeFocalPoint({ x: 2, y: -1 })).toEqual({ x: 1, y: 0 });
    expect(normalizeFocalPoint({ x: Number.NaN, y: '0.2' })).toEqual({ x: 0.5, y: 0.5 });
    expect(normalizeFocalPoint(null)).toEqual({ x: 0.5, y: 0.5 });
    expect(focalPointPosition({ x: 0.25, y: 0.333333 })).toBe('25% 33.33%');
    cleanup();
    // validates placeholders
    expect(resolvePlaceholder({ kind: 'color', color: '#1e3a5f' })).toEqual({
      kind: 'color',
      color: '#1e3a5f',
    });
    expect(
      resolvePlaceholder({ kind: 'color', color: 'red;background:url(https://evil.example)' })
    ).toEqual({
      kind: 'none',
    });
    expect(resolvePlaceholder({ kind: 'blur', src: `${PHOTO}?w=16` })).toEqual({
      kind: 'blur',
      src: `${PHOTO}?w=16`,
    });
    expect(resolvePlaceholder({ kind: 'blur', src: DATA_PNG })).toEqual({ kind: 'none' });
    expect(resolvePlaceholder({ kind: 'blur', src: DATA_PNG }, 'developer')).toEqual({
      kind: 'blur',
      src: DATA_PNG,
    });
    expect(resolvePlaceholder({ kind: 'blur', src: 'javascript:alert(1)' }, 'developer')).toEqual({
      kind: 'none',
    });
    expect(resolvePlaceholder('blur')).toEqual({ kind: 'none' });
    cleanup();
    // accepts only positive integer dimensions
    expect(intrinsicSize(1200, 800)).toEqual({ width: 1200, height: 800, ratio: '1200 / 800' });
    expect(intrinsicSize(1200, undefined)).toBeUndefined();
    expect(intrinsicSize(-1, 800)).toBeUndefined();
    expect(intrinsicSize(12.5, 8)).toBeUndefined();
    expect(intrinsicSize(IMAGE_LIMITS.dimension + 1, 8)).toBeUndefined();
    expect(normalizeFit('contain')).toBe('contain');
    expect(normalizeFit('url(x)')).toBe('cover');
  });
});

describe('Image', () => {
  it('renders a lazy, async, no-referrer image with its sources and size, and 12 related cases', async () => {
    {
      // renders a lazy, async, no-referrer image with its sources and size
      const { container } = render(Image, {
        src: PHOTO,
        widths: [480, 960],
        loader: cdn,
        sizes: '100vw',
        alt: 'Harbor at dawn',
        width: 1200,
        height: 800,
      });
      const img = container.querySelector('img');
      expect(img?.getAttribute('src')).toBe(PHOTO);
      expect(img?.getAttribute('srcset')).toBe(`${PHOTO}?w=480 480w, ${PHOTO}?w=960 960w`);
      expect(img?.getAttribute('sizes')).toBe('100vw');
      expect(img?.getAttribute('alt')).toBe('Harbor at dawn');
      expect(img?.getAttribute('width')).toBe('1200');
      expect(img?.getAttribute('height')).toBe('800');
      expect(img?.getAttribute('loading')).toBe('lazy');
      expect(img?.getAttribute('decoding')).toBe('async');
      expect(img?.getAttribute('referrerpolicy')).toBe('no-referrer');
      const box = container.querySelector<HTMLElement>('[data-tx-image]');
      expect(box?.dataset.status).toBe('loading');
      expect(box?.style.aspectRatio).toBe('1200 / 800');
      expect(box?.style.maxInlineSize).toBe('min(100%, 1200px)');
      expect(box?.hasAttribute('data-sized')).toBe(true);
    }
    cleanup();
    {
      // honors eager loading, fetch priority and developer trust
      const { container } = render(Image, {
        src: 'http://localhost:5173/hero.png',
        alt: 'Hero',
        loading: 'eager',
        fetchPriority: 'high',
        trust: 'developer',
      });
      const img = container.querySelector('img');
      expect(img?.getAttribute('loading')).toBe('eager');
      expect(img?.getAttribute('fetchpriority')).toBe('high');
      expect(img?.hasAttribute('referrerpolicy')).toBe(false);
    }
    cleanup();
    {
      // shows a labeled fallback instead of an unsafe source
      const onstatus = vi.fn();
      const { container } = render(Image, {
        src: 'javascript:alert(1)',
        alt: 'Quarterly chart',
        labels: { unavailable: 'Imagen no disponible' },
        onstatus,
      });
      expect(container.querySelector('img')).toBeNull();
      const fallback = container.querySelector('[role="img"]');
      expect(fallback?.getAttribute('aria-label')).toBe('Quarterly chart');
      expect(fallback?.textContent).toContain('Imagen no disponible');
      expect(container.querySelector<HTMLElement>('[data-tx-image]')?.dataset.status).toBe(
        'blocked'
      );
      expect(onstatus).toHaveBeenLastCalledWith('blocked');
    }
    cleanup();
    {
      // hides the fallback of a decorative image from assistive tech
      const { container } = render(Image, { src: 'data:text/html,hi', alt: '' });
      expect(container.querySelector('[role="img"]')).toBeNull();
      expect(container.querySelector('.tx-image-fallback')?.getAttribute('aria-hidden')).toBe(
        'true'
      );
    }
    cleanup();
    // moves to loaded on load and clears the placeholders
    await (async () => {
      const onload = vi.fn();
      const { container } = render(Image, {
        src: PHOTO,
        alt: 'Harbor',
        placeholder: { kind: 'blur', src: `${PHOTO}?w=16` },
        onload,
      });
      const [img, blur] = container.querySelectorAll('img');
      expect(blur?.getAttribute('alt')).toBe('');
      expect(blur?.getAttribute('aria-hidden')).toBe('true');
      expect(blur?.classList.contains('tx-image-blur-done')).toBe(false);
      await fireEvent.load(img as HTMLImageElement);
      expect(onload).toHaveBeenCalledOnce();
      expect(container.querySelector<HTMLElement>('[data-tx-image]')?.dataset.status).toBe(
        'loaded'
      );
      expect(blur?.classList.contains('tx-image-blur-done')).toBe(true);
    })();
    cleanup();
    {
      // detects an image that loaded before the listeners attached
      const complete = vi
        .spyOn(HTMLImageElement.prototype, 'complete', 'get')
        .mockReturnValue(true);
      const natural = vi
        .spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get')
        .mockReturnValue(1200);
      try {
        const { container } = render(Image, { src: PHOTO, alt: 'Harbor' });
        expect(container.querySelector<HTMLElement>('[data-tx-image]')?.dataset.status).toBe(
          'loaded'
        );
      } finally {
        complete.mockRestore();
        natural.mockRestore();
      }
    }
    cleanup();
    // paints a color placeholder only while loading
    await (async () => {
      const { container } = render(Image, {
        src: PHOTO,
        alt: 'Harbor',
        placeholder: { kind: 'color', color: '#1e3a5f' },
      });
      const box = container.querySelector<HTMLElement>('[data-tx-image]');
      expect(box?.style.backgroundColor).not.toBe('');
      await fireEvent.load(container.querySelector('img') as HTMLImageElement);
      expect(box?.style.backgroundColor).toBe('');
    })();
    cleanup();
    // falls back on a load error and starts over for a new source
    await (async () => {
      const onerror = vi.fn();
      const { container, rerender } = render(Image, { src: PHOTO, alt: 'Harbor', onerror });
      await fireEvent.error(container.querySelector('img') as HTMLImageElement);
      expect(onerror).toHaveBeenCalledOnce();
      expect(container.querySelector('img')).toBeNull();
      expect(container.querySelector<HTMLElement>('[data-tx-image]')?.dataset.status).toBe('error');
      await rerender({ src: `${PHOTO}?v=2`, alt: 'Harbor', onerror });
      expect(container.querySelector('img')?.getAttribute('src')).toBe(`${PHOTO}?v=2`);
      expect(container.querySelector<HTMLElement>('[data-tx-image]')?.dataset.status).toBe(
        'loading'
      );
    })();
    cleanup();
    {
      // keeps the focal point in view and applies the fit
      const { container } = render(Image, {
        src: PHOTO,
        alt: 'Harbor',
        width: 1600,
        height: 900,
        fit: 'contain',
        focalPoint: { x: 0.8, y: 0.3 },
      });
      expect(container.querySelector('img')?.style.objectPosition).toBe('80% 30%');
      expect(container.querySelector<HTMLElement>('[data-tx-image]')?.dataset.fit).toBe('contain');
    }
    cleanup();
    {
      // becomes a link only for a safe href
      const safe = render(Image, {
        src: PHOTO,
        alt: 'Open the harbor album',
        href: 'https://example.com/album',
      });
      expect(safe.container.querySelector('a')?.getAttribute('href')).toBe(
        'https://example.com/album'
      );
      const unsafe = render(Image, { src: PHOTO, alt: 'Harbor', href: 'javascript:alert(1)' });
      expect(unsafe.container.querySelector('a')).toBeNull();
      expect(unsafe.container.querySelector('img')).not.toBeNull();
    }
    cleanup();
    {
      // threads the trust tier into the href policy
      // Untrusted default: relative and http links stay inert (same tier as agent/user content).
      const relativeUntrusted = render(Image, {
        src: PHOTO,
        alt: 'Harbor album',
        href: '/albums/harbor',
      });
      expect(relativeUntrusted.container.querySelector('a')).toBeNull();
      expect(relativeUntrusted.container.querySelector('img')).not.toBeNull();

      const httpUntrusted = render(Image, {
        src: PHOTO,
        alt: 'Harbor album',
        href: 'http://images.example.com/album',
      });
      expect(httpUntrusted.container.querySelector('a')).toBeNull();

      // Developer tier: app-authored relative and http hrefs pass; script schemes still fail.
      const relativeDeveloper = render(Image, {
        src: PHOTO,
        alt: 'Harbor album',
        href: '/albums/harbor',
        trust: 'developer',
      });
      expect(relativeDeveloper.container.querySelector('a')?.getAttribute('href')).toBe(
        '/albums/harbor'
      );

      const httpDeveloper = render(Image, {
        src: PHOTO,
        alt: 'Harbor album',
        href: 'http://localhost:5173/album',
        trust: 'developer',
      });
      expect(httpDeveloper.container.querySelector('a')?.getAttribute('href')).toBe(
        'http://localhost:5173/album'
      );

      const scriptDeveloper = render(Image, {
        src: PHOTO,
        alt: 'Harbor album',
        href: 'javascript:alert(1)',
        trust: 'developer',
      });
      expect(scriptDeveloper.container.querySelector('a')).toBeNull();
    }
    cleanup();
    // becomes a native button with onactivate
    await (async () => {
      const onactivate = vi.fn();
      const { container } = render(Image, {
        src: PHOTO,
        alt: '',
        actionLabel: 'Enlarge the harbor photo',
        onactivate,
      });
      const button = container.querySelector('button');
      expect(button?.getAttribute('type')).toBe('button');
      expect(button?.getAttribute('aria-label')).toBe('Enlarge the harbor photo');
      button?.focus();
      expect(document.activeElement).toBe(button);
      await fireEvent.click(button as HTMLButtonElement);
      expect(onactivate).toHaveBeenCalledOnce();
    })();
    cleanup();
    {
      // merges a consumer class
      const { container } = render(Image, {
        src: PHOTO,
        alt: 'Harbor',
        class: ['rounded', { hero: true }],
      });
      const box = container.querySelector('[data-tx-image]');
      expect(box?.classList.contains('rounded')).toBe(true);
      expect(box?.classList.contains('hero')).toBe(true);
    }
  });
});
