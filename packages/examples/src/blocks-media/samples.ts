/** Tiny 1×1 PNGs (distinct hues) — pass the block media classifier as data URIs. */
const RED =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const GREEN =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const BLUE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==';

/**
 * Valid media family samples for the visual fixture (fictional Harbor Notes).
 * Video is covered by unit tests: incomplete data-URI clips make Chromium's
 * media chrome flicker and break screenshot stability.
 */
export const MEDIA_FAMILY_SAMPLES = [
  {
    type: 'image' as const,
    src: RED,
    alt: 'Harbor Notes brand swatch (red)',
    width: 320,
    height: 180,
    caption: 'Brand primary swatch (fictional).',
    credit: 'Harbor Notes design',
    fit: 'cover' as const,
  },
  {
    type: 'figure' as const,
    src: GREEN,
    alt: 'Simplified service map',
    width: 480,
    height: 270,
    caption: 'Request path through the API gateway (example diagram plate).',
    credit: 'Northwind Labs',
    fit: 'contain' as const,
  },
  {
    type: 'gallery' as const,
    title: 'Harbor Notes screens',
    columns: 3 as const,
    items: [
      {
        src: RED,
        alt: 'Harbor Notes inbox screen mock (red plate)',
        width: 240,
        height: 160,
        caption: 'Inbox',
      },
      {
        src: GREEN,
        alt: 'Harbor Notes editor screen mock (green plate)',
        width: 240,
        height: 160,
        caption: 'Editor',
      },
      {
        src: BLUE,
        alt: 'Harbor Notes share sheet mock (blue plate)',
        width: 240,
        height: 160,
        caption: 'Share',
      },
    ],
  },
];

/** Hostile payloads the renderer must refuse. */
export const MEDIA_HOSTILE_SAMPLES = [
  {
    type: 'image',
    src: 'https://evil.example/steal.png',
    alt: 'Remote image',
    width: 1,
    height: 1,
  },
  {
    type: 'video',
    src: 'javascript:alert(1)',
    label: 'Scripted',
    width: 16,
    height: 9,
  },
  {
    type: 'gallery',
    items: [{ src: 'assets/icon.svg', alt: 'SVG', width: 1, height: 1 }],
  },
];
