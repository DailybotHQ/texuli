import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { getInertRegistry } from '@texuli/core/inert';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Gallery } from '../src/gallery/index.ts';
import { Lightbox } from '../src/gallery/lightbox.ts';
import {
  clampPan,
  clampZoom,
  columnCount,
  edgeViewable,
  formatLabel,
  GALLERY_LIMITS,
  type GalleryItem,
  masonryLayout,
  resolveGalleryItems,
  resolveGalleryLabels,
  safeAspectRatio,
  stepViewable,
  swipeIntent,
  viewablePosition,
} from '../src/gallery/model.ts';

afterEach(() => getInertRegistry().clear());

const photo = (name: string) => `https://images.example.com/${name}.jpg`;

const ITEMS: GalleryItem[] = [
  {
    id: 'harbor',
    src: photo('harbor'),
    alt: 'Boats in a fictional harbor',
    width: 1600,
    height: 900,
    caption: 'Harbor at dusk',
  },
  { id: 'cliff', src: photo('cliff'), alt: 'A cliff path', width: 900, height: 1600 },
  { id: 'unsafe', src: 'javascript:alert(1)', alt: 'Blocked picture' },
  {
    id: 'lake',
    src: photo('lake'),
    thumbSrc: photo('lake-thumb'),
    alt: 'A quiet lake',
    width: 1200,
    height: 1200,
  },
];

describe('resolveGalleryItems', () => {
  it('passes every source through the image policy and keeps blocked items as fallbacks', () => {
    const items = resolveGalleryItems(ITEMS);
    expect(items.map((item) => item.key)).toEqual(['harbor', 'cliff', 'unsafe', 'lake']);
    expect(items[0]).toMatchObject({
      src: photo('harbor'),
      thumbSrc: photo('harbor'),
      viewable: true,
      ratio: 900 / 1600,
    });
    expect(items[2]).toMatchObject({ src: undefined, thumbSrc: undefined, viewable: false });
    expect(items[3]).toMatchObject({ src: photo('lake'), thumbSrc: photo('lake-thumb') });
    for (const src of [
      'http://images.example.com/a.jpg',
      'data:image/png;base64,AAAA',
      '//evil.example/a.jpg',
      'vbscript:x',
    ]) {
      expect(resolveGalleryItems([{ src, alt: '' }])[0]?.viewable, src).toBe(false);
    }
    expect(
      resolveGalleryItems([{ src: 'http://images.example.com/a.jpg', alt: '' }], 'developer')[0]
        ?.viewable
    ).toBe(true);
  });

  it('blocks an unsafe thumbnail without falling back to the full source', () => {
    const [item] = resolveGalleryItems([
      { src: photo('a'), thumbSrc: 'javascript:alert(1)', alt: 'A' },
    ]);
    expect(item).toMatchObject({ src: photo('a'), thumbSrc: undefined, viewable: true });
  });

  it('never throws on malformed input and bounds what it keeps', () => {
    expect(resolveGalleryItems(undefined)).toEqual([]);
    expect(resolveGalleryItems('nope')).toEqual([]);
    const items = resolveGalleryItems([
      null,
      7,
      {
        src: photo('a'),
        alt: 42,
        caption: `  ${'x'.repeat(900)}  `,
        width: -3,
        height: Number.NaN,
        id: 'dup',
      },
      { src: photo('b'), alt: 'B', id: 'dup', focalPoint: { x: 9, y: 'top' } },
    ]);
    expect(items.map((item) => [item.index, item.key])).toEqual([
      [2, 'dup'],
      [3, 'item-3'],
    ]);
    expect(items[0]?.alt).toBe('');
    expect(items[0]?.caption).toHaveLength(GALLERY_LIMITS.caption);
    expect(items[0]?.ratio).toBe(1);
    expect(items[1]?.focalPoint).toEqual({ x: 1, y: 0.5 });
    const many = Array.from({ length: GALLERY_LIMITS.items + 20 }, (_, i) => ({
      src: photo(`p${i}`),
      alt: `P${i}`,
    }));
    expect(resolveGalleryItems(many)).toHaveLength(GALLERY_LIMITS.items);
  });
});

describe('masonryLayout', () => {
  it('packs each item into the shortest column, inline-start first on ties', () => {
    const layout = masonryLayout([1, 0.5, 0.5, 1, 2], 3);
    expect(layout.positions.map((p) => p.column)).toEqual([0, 1, 2, 1, 2]);
    expect(layout.positions[3]).toEqual({ column: 1, offset: 0.5, above: 1 });
    expect(layout.extents).toEqual([
      { offset: 1, count: 1 },
      { offset: 1.5, count: 2 },
      { offset: 2.5, count: 2 },
    ]);
    expect(masonryLayout([1, 0.5, 0.5, 1, 2], 3)).toEqual(layout);
  });

  it('treats bad ratios as square and clamps the column count', () => {
    expect(masonryLayout([Number.NaN, -1, 0], 0).positions.map((p) => p.offset)).toEqual([0, 1, 2]);
    expect(masonryLayout([], 99).columns).toBe(GALLERY_LIMITS.columns);
    expect(columnCount(1000, 180, 8, 4)).toBe(4);
    expect(columnCount(400, 180, 8, 4)).toBe(2);
    expect(columnCount(100, 180, 8, 4)).toBe(1);
    expect(columnCount(0, 180, 8, 3)).toBe(3);
  });
});

describe('lightbox navigation and gestures', () => {
  const items = resolveGalleryItems(ITEMS);

  it('steps over blocked items, stops at the ends, and wraps with loop', () => {
    expect(stepViewable(items, 1, 1)).toBe(3);
    expect(stepViewable(items, 3, -1)).toBe(1);
    expect(stepViewable(items, 3, 1)).toBe(3);
    expect(stepViewable(items, 3, 1, true)).toBe(0);
    expect(stepViewable(items, 0, -1, true)).toBe(3);
    expect(stepViewable(items, 2, 1)).toBe(3);
    expect(edgeViewable(items, 'start')).toBe(0);
    expect(edgeViewable(items, 'end')).toBe(3);
    expect(viewablePosition(items, 3)).toEqual({ current: 3, total: 3 });
    expect(edgeViewable(resolveGalleryItems([{ src: 'javascript:x', alt: '' }]), 'start')).toBe(-1);
  });

  it('clamps zoom and keeps a zoomed image covering the stage', () => {
    expect(clampZoom(0.2)).toBe(1);
    expect(clampZoom(9)).toBe(GALLERY_LIMITS.maxZoom);
    expect(clampZoom(Number.NaN)).toBe(1);
    expect(clampPan({ x: 500, y: -500 }, 2, { width: 400, height: 300 })).toEqual({
      x: 200,
      y: -150,
    });
    expect(clampPan({ x: 50, y: 50 }, 1, { width: 400, height: 300 })).toEqual({ x: 0, y: 0 });
  });

  it('reads a swipe only when it is long and mostly horizontal, mirrored in RTL', () => {
    expect(swipeIntent(-120, 10, 400)).toBe('next');
    expect(swipeIntent(120, 10, 400)).toBe('previous');
    expect(swipeIntent(-120, 10, 400, true)).toBe('previous');
    expect(swipeIntent(-30, 0, 100)).toBeNull();
    expect(swipeIntent(-50, 0, 1000)).toBeNull();
    expect(swipeIntent(-100, 90, 400)).toBeNull();
    expect(swipeIntent(Number.NaN, 0, 400)).toBeNull();
  });

  it('builds safe aspect ratios and labels', () => {
    expect(safeAspectRatio('4 / 3')).toBe('4 / 3');
    expect(safeAspectRatio('1.5')).toBe('1.5 / 1');
    expect(safeAspectRatio(16 / 9)).toBe(String(16 / 9));
    expect(safeAspectRatio('1 / 1; background: url(https://evil.example)')).toBe('1 / 1');
    expect(safeAspectRatio('0 / 3')).toBe('1 / 1');
    expect(formatLabel('{current} of {total} {other}', { current: 2, total: 5 })).toBe(
      '2 of 5 {other}'
    );
    expect(resolveGalleryLabels({ close: 'Cerrar', next: ' ' }).close).toBe('Cerrar');
    expect(resolveGalleryLabels({ next: ' ' }).next).toBe('Next image');
  });
});

describe('Gallery', () => {
  // Gallery lazy-loads the lightbox chunk on the first open; load it here so
  // a slow first transform under the parallel suite never meets a test wait.
  beforeAll(async () => {
    await import('../src/gallery/Lightbox.svelte');
  });

  it('renders a list of tiles: viewable ones are buttons, blocked ones are fallbacks never requested', () => {
    const { container } = render(Gallery, { props: { items: ITEMS, 'aria-label': 'Trip photos' } });
    const list = screen.getByRole('list', { name: 'Trip photos' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
    const buttons = within(list).getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-haspopup'))).toEqual([
      'dialog',
      'dialog',
      'dialog',
    ]);
    expect(screen.getByRole('button', { name: 'Boats in a fictional harbor' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Blocked picture' }).textContent).toContain(
      'Image unavailable'
    );
    expect(container.innerHTML).not.toContain('javascript:');
    const sources = [...container.querySelectorAll('img')].map((img) => img.getAttribute('src'));
    expect(sources).toEqual([photo('harbor'), photo('cliff'), photo('lake-thumb')]);
    expect(screen.getByText('Harbor at dusk').tagName).toBe('FIGCAPTION');
  });

  it('names a tile without alt text by its position', () => {
    render(Gallery, { props: { items: [{ src: photo('a'), alt: '' }] } });
    expect(screen.getByRole('button', { name: 'Open image 1' })).toBeTruthy();
  });

  it('renders plain tiles when the lightbox is off', () => {
    render(Gallery, { props: { items: ITEMS, lightbox: false } });
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('places masonry tiles from the packed layout and keeps the DOM in item order', () => {
    const { container } = render(Gallery, {
      props: { items: ITEMS, layout: 'masonry', columns: 2 },
    });
    const frame = container.querySelector('[data-tx-gallery]') as HTMLElement;
    expect(frame.dataset.layout).toBe('masonry');
    const cells = [...container.querySelectorAll<HTMLElement>('.tx-gallery-item')];
    const columns = cells.map((cell) => cell.style.getPropertyValue('--tx-gallery-x'));
    expect(columns).toEqual(['0', '1', '0', '0']);
    expect(cells[2]?.style.getPropertyValue('--tx-gallery-y')).toBe(String(900 / 1600));
    expect(cells[3]?.style.getPropertyValue('--tx-gallery-k')).toBe('2');
    expect(container.querySelector<HTMLElement>('.tx-gallery')?.style.blockSize).toContain('max(');
  });

  it('opens the lightbox from a tile, navigates by keyboard and returns focus to the last image', async () => {
    const onIndexChange = vi.fn();
    render(Gallery, { props: { items: ITEMS, onIndexChange } });
    await fireEvent.click(screen.getByRole('button', { name: 'A cliff path' }));
    const dialog = await screen.findByRole('dialog', { name: 'Image viewer' });
    expect(onIndexChange).toHaveBeenLastCalledWith(1);
    await waitFor(() =>
      expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Close' }))
    );
    expect(within(dialog).getByRole('img', { name: 'A cliff path' }).getAttribute('src')).toBe(
      photo('cliff')
    );
    expect(within(dialog).getByText('2 of 3').getAttribute('aria-live')).toBe('polite');

    await fireEvent.keyDown(dialog, { key: 'ArrowRight' });
    // The blocked item is skipped, and the lightbox shows the full source, not the thumbnail.
    expect(within(dialog).getByRole('img', { name: 'A quiet lake' }).getAttribute('src')).toBe(
      photo('lake')
    );
    expect(within(dialog).getByText('3 of 3')).toBeTruthy();
    expect(onIndexChange).toHaveBeenLastCalledWith(3);
    expect(
      (within(dialog).getByRole('button', { name: 'Next image' }) as HTMLButtonElement).disabled
    ).toBe(true);

    await fireEvent.keyDown(dialog, { key: 'Home' });
    expect(within(dialog).getByRole('img', { name: 'Boats in a fictional harbor' })).toBeTruthy();
    expect(dialog.querySelector('.tx-lightbox-caption')?.textContent).toBe('Harbor at dusk');
    expect(
      (within(dialog).getByRole('button', { name: 'Previous image' }) as HTMLButtonElement).disabled
    ).toBe(true);
    await fireEvent.keyDown(dialog, { key: 'End' });
    expect(within(dialog).getByRole('img', { name: 'A quiet lake' })).toBeTruthy();

    await fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'A quiet lake' }));
  });

  it('zooms by keys and buttons, pans with arrows while zoomed, and resets on a new image', async () => {
    render(Lightbox, { props: { items: ITEMS, open: true, index: 0 } });
    const dialog = await screen.findByRole('dialog', { name: 'Image viewer' });
    const image = () => dialog.querySelector('img') as HTMLImageElement;
    const zoomOut = within(dialog).getByRole('button', { name: 'Zoom out' }) as HTMLButtonElement;
    expect(zoomOut.disabled).toBe(true);

    await fireEvent.keyDown(dialog, { key: '+' });
    // The visible percentage is part of the button's name (WCAG 2.5.3).
    expect(within(dialog).getByRole('button', { name: 'Reset zoom 150%' })).toBeTruthy();
    expect(image().style.transform).toContain('scale(1.5)');
    expect(dialog.hasAttribute('data-zoomed')).toBe(true);
    // Zoomed, arrows pan (the stage has no size in this DOM, so the pan clamps to 0) instead of navigating.
    await fireEvent.keyDown(dialog, { key: 'ArrowRight' });
    expect(within(dialog).getByRole('img', { name: 'Boats in a fictional harbor' })).toBeTruthy();

    await fireEvent.click(within(dialog).getByRole('button', { name: 'Zoom in' }));
    expect(image().style.transform).toContain('scale(2)');
    for (let i = 0; i < 10; i++) await fireEvent.keyDown(dialog, { key: '=' });
    expect(image().style.transform).toContain(`scale(${GALLERY_LIMITS.maxZoom})`);
    expect(
      (within(dialog).getByRole('button', { name: 'Zoom in' }) as HTMLButtonElement).disabled
    ).toBe(true);
    await fireEvent.keyDown(dialog, { key: '0' });
    expect(image().style.transform).toContain('scale(1)');

    await fireEvent.keyDown(dialog, { key: '+' });
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Next image' }));
    expect(within(dialog).getByRole('img', { name: 'A cliff path' })).toBeTruthy();
    expect(image().style.transform).toContain('scale(1)');
  });

  it('navigates by swipe, ignores a vertical drag, and closes on a tap on the empty stage', async () => {
    const onOpenChange = vi.fn();
    render(Lightbox, { props: { items: ITEMS, open: true, index: 0, loop: true, onOpenChange } });
    const dialog = await screen.findByRole('dialog', { name: 'Image viewer' });
    const stage = dialog.querySelector('.tx-lightbox-stage') as HTMLElement;
    const swipe = async (dx: number, dy: number, id: number) => {
      await fireEvent.pointerDown(stage, {
        pointerId: id,
        clientX: 300,
        clientY: 200,
        pointerType: 'touch',
      });
      await fireEvent.pointerMove(stage, {
        pointerId: id,
        clientX: 300 + dx / 2,
        clientY: 200 + dy / 2,
        pointerType: 'touch',
      });
      await fireEvent.pointerUp(stage, {
        pointerId: id,
        clientX: 300 + dx,
        clientY: 200 + dy,
        pointerType: 'touch',
      });
    };
    await swipe(-150, 5, 1);
    expect(within(dialog).getByRole('img', { name: 'A cliff path' })).toBeTruthy();
    await swipe(150, 0, 2);
    expect(within(dialog).getByRole('img', { name: 'Boats in a fictional harbor' })).toBeTruthy();
    await swipe(150, 0, 3);
    expect(within(dialog).getByRole('img', { name: 'A quiet lake' })).toBeTruthy();
    await swipe(10, 160, 4);
    expect(within(dialog).getByRole('img', { name: 'A quiet lake' })).toBeTruthy();

    await fireEvent.pointerDown(stage, {
      pointerId: 5,
      clientX: 10,
      clientY: 10,
      pointerType: 'mouse',
      button: 0,
    });
    await fireEvent.pointerUp(stage, {
      pointerId: 5,
      clientX: 10,
      clientY: 10,
      pointerType: 'mouse',
      button: 0,
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('toggles zoom with a double tap on the image', async () => {
    render(Lightbox, { props: { items: ITEMS, open: true, index: 1 } });
    const dialog = await screen.findByRole('dialog', { name: 'Image viewer' });
    const image = dialog.querySelector('img') as HTMLImageElement;
    const tap = async (id: number) => {
      await fireEvent.pointerDown(image, {
        pointerId: id,
        clientX: 50,
        clientY: 50,
        pointerType: 'touch',
      });
      await fireEvent.pointerUp(image, {
        pointerId: id,
        clientX: 50,
        clientY: 50,
        pointerType: 'touch',
      });
    };
    await tap(1);
    await tap(2);
    expect(image.style.transform).toContain('scale(2)');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('shows a labeled fallback when the full image fails to load', async () => {
    render(Lightbox, {
      props: { items: ITEMS, open: true, index: 3, labels: { unavailable: 'No disponible' } },
    });
    const dialog = await screen.findByRole('dialog', { name: 'Image viewer' });
    await fireEvent.error(dialog.querySelector('img') as HTMLImageElement);
    expect(within(dialog).getByRole('img', { name: 'A quiet lake' }).textContent).toContain(
      'No disponible'
    );
  });
});
