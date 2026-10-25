import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  blockText,
  checkMediaBlock,
  classifyMediaSource,
  loadMediaFamily,
  MEDIA_BLOCK_TYPES,
  safeParseBlock,
} from '../src/index.ts';
import { resolveMediaBlockLabels } from '../src/media/index.ts';
import { MediaBlockView } from '../src/media/renderers.ts';
import { resolveBlockMediaSrc } from '../src/media/resolve.ts';

afterEach(cleanup);

/** 1×1 PNG (red). Decoded size well under the 192 KB cap. */
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** Minimal mp4-shaped data URI accepted by the video classifier. */
const MP4 = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAI';

describe('MEDIA_BLOCK_TYPES', () => {
  it('lists the four media family types', () => {
    expect([...MEDIA_BLOCK_TYPES]).toEqual(['image', 'figure', 'video', 'gallery']);
  });
});

describe('safeParseBlock media', () => {
  it('accepts image, figure, video and gallery', () => {
    const image = safeParseBlock({
      type: 'image',
      src: PNG,
      alt: 'Red pixel',
      width: 1,
      height: 1,
      caption: 'A test pixel',
    });
    expect(image.success).toBe(true);

    const figure = safeParseBlock({
      type: 'figure',
      src: 'assets/cover.webp',
      alt: 'Cover',
      width: 16,
      height: 9,
      caption: 'Required caption',
      credit: 'Example Studio',
    });
    expect(figure.success).toBe(true);

    const video = safeParseBlock({
      type: 'video',
      src: MP4,
      label: 'Demo clip',
      width: 16,
      height: 9,
      muted: true,
      autoplay: true,
    });
    expect(video.success).toBe(true);

    const gallery = safeParseBlock({
      type: 'gallery',
      title: 'Shots',
      columns: 2,
      items: [
        { src: PNG, alt: 'A', width: 1, height: 1 },
        { src: 'assets/b.webp', alt: 'B', width: 4, height: 3, caption: 'B' },
      ],
    });
    expect(gallery.success).toBe(true);
  });

  it('rejects hostile and invalid media sources', () => {
    expect(
      safeParseBlock({
        type: 'image',
        src: 'https://evil.example/x.png',
        alt: 'Remote',
        width: 1,
        height: 1,
      }).success
    ).toBe(false);

    expect(
      safeParseBlock({
        type: 'image',
        src: 'javascript:alert(1)',
        alt: 'Nope',
        width: 1,
        height: 1,
      }).success
    ).toBe(false);

    expect(
      safeParseBlock({
        type: 'image',
        src: 'assets/icon.svg',
        alt: 'SVG',
        width: 1,
        height: 1,
      }).success
    ).toBe(false);

    expect(
      safeParseBlock({
        type: 'image',
        src: PNG,
        decorative: true,
        alt: 'Conflict',
        width: 1,
        height: 1,
      }).success
    ).toBe(false);

    expect(
      safeParseBlock({
        type: 'image',
        src: PNG,
        width: 1,
        height: 1,
      }).success
    ).toBe(false);

    expect(
      safeParseBlock({
        type: 'figure',
        src: PNG,
        alt: 'Missing caption',
        width: 1,
        height: 1,
      }).success
    ).toBe(false);

    expect(
      safeParseBlock({
        type: 'video',
        src: MP4,
        label: 'Loud autoplay',
        width: 16,
        height: 9,
        autoplay: true,
      }).success
    ).toBe(false);

    expect(
      safeParseBlock({
        type: 'video',
        src: 'https://cdn.example/clip.mp4',
        label: 'Remote',
        width: 16,
        height: 9,
      }).success
    ).toBe(false);

    expect(
      safeParseBlock({
        type: 'gallery',
        items: [{ src: 'https://evil.example/a.png', alt: 'A', width: 1, height: 1 }],
      }).success
    ).toBe(false);
  });
});

describe('classifyMediaSource / resolveBlockMediaSrc', () => {
  it('classifies avatar, data and relative sources', () => {
    expect(classifyMediaSource('avatar:av-007', 'image')).toMatchObject({
      ok: true,
      kind: 'avatar',
    });
    expect(classifyMediaSource(PNG, 'image')).toMatchObject({ ok: true, kind: 'data' });
    expect(classifyMediaSource('assets/cover.webp', 'image')).toMatchObject({
      ok: true,
      kind: 'relative',
    });
    expect(classifyMediaSource(MP4, 'video')).toMatchObject({ ok: true, kind: 'data' });
  });

  it('resolves data and relative; avatars need a host adapter', () => {
    expect(resolveBlockMediaSrc(PNG, 'image')).toBe(PNG);
    expect(resolveBlockMediaSrc('assets/a.webp', 'image')).toBe('assets/a.webp');
    expect(resolveBlockMediaSrc('avatar:av-001', 'image')).toBeUndefined();
    expect(resolveBlockMediaSrc('avatar:av-001', 'image', (id) => `/avatars/${id}.webp`)).toBe(
      '/avatars/av-001.webp'
    );
  });
});

describe('checkMediaBlock / blockText', () => {
  it('accepts media types and rejects text types', () => {
    const ok = checkMediaBlock({
      type: 'image',
      src: PNG,
      alt: 'Pixel',
      width: 1,
      height: 1,
    });
    expect(ok.ok).toBe(true);

    const bad = checkMediaBlock({ type: 'heading', level: 1, text: 'Hi' });
    expect(bad.ok).toBe(false);
  });

  it('summarizes media blocks as plain text', () => {
    const image = safeParseBlock({
      type: 'image',
      src: PNG,
      alt: 'Dock',
      width: 1,
      height: 1,
      caption: 'At dusk',
      credit: 'Studio',
    });
    expect(image.success).toBe(true);
    if (image.success) expect(blockText(image.data)).toBe('Dock At dusk Studio');

    const video = safeParseBlock({
      type: 'video',
      src: './clips/demo.mp4',
      label: 'Tour',
      width: 16,
      height: 9,
      caption: 'Overview',
    });
    expect(video.success).toBe(true);
    if (video.success) expect(blockText(video.data)).toBe('Tour Overview');
  });
});

describe('MediaBlockView', () => {
  it('renders image, figure caption, gallery and video from validated data', () => {
    const image = render(MediaBlockView, {
      props: {
        block: {
          type: 'image',
          src: PNG,
          alt: 'Red pixel',
          width: 1,
          height: 1,
          caption: 'Test pixel',
        },
      },
    });
    const img = image.container.querySelector('[data-tx-media-img]');
    expect(img?.getAttribute('src')).toBe(PNG);
    expect(img?.getAttribute('alt')).toBe('Red pixel');
    expect(image.getByText('Test pixel')).toBeTruthy();
    image.unmount();

    const figure = render(MediaBlockView, {
      props: {
        block: {
          type: 'figure',
          src: PNG,
          alt: 'Diagram',
          width: 2,
          height: 1,
          caption: 'Flow map',
          credit: 'Labs',
        },
      },
    });
    expect(figure.container.querySelector('[data-tx-block="figure"]')).toBeTruthy();
    expect(figure.getByText(/Flow map/)).toBeTruthy();
    expect(figure.getByText(/Labs/)).toBeTruthy();
    figure.unmount();

    const gallery = render(MediaBlockView, {
      props: {
        block: {
          type: 'gallery',
          title: 'Shots',
          columns: 2,
          items: [
            { src: PNG, alt: 'A', width: 1, height: 1, caption: 'One' },
            { src: PNG, alt: 'B', width: 1, height: 1 },
          ],
        },
      },
    });
    expect(gallery.getByText('Shots')).toBeTruthy();
    expect(gallery.container.querySelectorAll('[data-tx-media-img]')).toHaveLength(2);
    expect(gallery.container.querySelector('[data-columns="2"]')).toBeTruthy();
    gallery.unmount();

    const video = render(MediaBlockView, {
      props: {
        block: {
          type: 'video',
          src: MP4,
          label: 'Demo clip',
          width: 16,
          height: 9,
          caption: 'Walkthrough',
          controls: true,
        },
      },
    });
    const el = video.container.querySelector('[data-tx-media-video]');
    expect(el?.getAttribute('aria-label')).toBe('Demo clip');
    expect(el?.hasAttribute('controls')).toBe(true);
    expect(video.getByText('Walkthrough')).toBeTruthy();
  });

  it('rejects hostile input and notifies oninvalid', () => {
    const oninvalid = vi.fn();
    const view = render(MediaBlockView, {
      props: {
        block: {
          type: 'image',
          src: 'https://evil.example/x.png',
          alt: 'Remote',
          width: 1,
          height: 1,
        },
        oninvalid,
      },
    });
    expect(view.container.querySelector('[data-tx-block="invalid"]')).toBeTruthy();
    expect(view.container.querySelector('img')).toBeNull();
    expect(oninvalid).toHaveBeenCalled();
  });

  it('loadMediaFamily resolves the lazy renderer', async () => {
    const mod = await loadMediaFamily();
    expect(typeof mod.default).toBe('function');
  });

  it('merges label overrides', () => {
    const labels = resolveMediaBlockLabels({ invalid: 'Bloque inválido' });
    expect(labels.invalid).toBe('Bloque inválido');
    expect(labels.galleryFallback).toBe('Image unavailable');
  });
});
