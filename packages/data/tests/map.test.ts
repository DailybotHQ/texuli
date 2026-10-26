// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PORT_MERIDIAN } from '../src/engines/map/port-meridian.ts';
import MapView from '../src/map/MapView.svelte';
import {
  initialMapView,
  linePath,
  type MapFence,
  type MapMarker,
  type MapRoute,
  positionMarkers,
  resolveMapTone,
  routeProgress,
} from '../src/map/model.ts';

const markers: MapMarker[] = [
  { id: 'north-pier', lng: -18.6, lat: -30.4, label: 'North Pier', detail: '12 active' },
  { id: 'old-mill', lng: -19.2, lat: -31.1, label: 'Old Mill', tone: 'accent' },
  { id: 'lantern', lng: -17.8, lat: -31.6, label: 'Lantern Point', tone: 'success' },
];

const route: MapRoute = {
  id: 'coast-run',
  label: 'Coast run',
  tone: 'primary',
  progress: 0.5,
  stops: [
    { lng: -18.6, lat: -30.4 },
    { lng: -19.1, lat: -30.72 },
    { lng: -17.8, lat: -31.6 },
  ],
};

const fence: MapFence = {
  id: 'yard',
  name: 'North yard',
  shape: 'polygon',
  tone: 'warning',
  ring: [
    [-18.7, -30.3],
    [-18.5, -30.3],
    [-18.5, -30.5],
    [-18.7, -30.5],
  ],
};

afterEach(cleanup);

describe('map view model', () => {
  it('fits the fictional basemap and projects point or cluster positions', () => {
    const view = initialMapView(PORT_MERIDIAN);
    expect(view.zoom).toBeGreaterThan(0);
    expect(view.center.lng).toBeCloseTo(-18.5, 0);
    const positions = positionMarkers(markers, view);
    expect(positions.markers.map(({ id }) => id)).toEqual(['north-pier', 'old-mill', 'lantern']);
    expect(positions.clusters).toEqual([]);

    const nearby = [markers[0]!, { ...markers[0]!, id: 'nearby', lng: -18.601, lat: -30.401 }];
    const clustered = positionMarkers(nearby, view);
    expect(clustered.markers).toEqual([]);
    expect(clustered.clusters).toHaveLength(1);
    expect(clustered.clusters[0]?.count).toBe(2);
  });

  it('resolves tone aliases to strong roles and builds route paths', () => {
    expect(resolveMapTone('accent')).toBe('primary');
    expect(resolveMapTone('default')).toBe('primary');
    expect(resolveMapTone('primary')).toBe('primary');
    expect(resolveMapTone('info')).toBe('info');
    expect(resolveMapTone(undefined)).toBe('primary');
    const view = initialMapView(PORT_MERIDIAN);
    const path = linePath(route.stops, view, { width: 800, height: 480 });
    expect(path.startsWith('M')).toBe(true);
    expect(path).toContain('L');
    const progress = routeProgress(route);
    expect(progress.at).toBeTruthy();
    expect(progress.travelled.length).toBeGreaterThan(1);
  });
});

describe('MapView', () => {
  it('renders offline vector features, accessible controls, markers and attribution', () => {
    render(MapView, { props: { markers, label: 'Dispatch map' } });
    const surface = screen.getByRole('region', { name: /Dispatch map map/ });
    expect(surface.getAttribute('aria-roledescription')).toBe('map');
    expect(screen.getByRole('group', { name: 'Map controls' })).toBeTruthy();
    // Composed name when detail is set; title alone when it is not.
    expect(screen.getAllByRole('button', { name: 'North Pier, 12 active' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Old Mill' })).toHaveLength(2);
    expect(screen.getByText(/Port Meridian is fictional/)).toBeTruthy();
    expect(document.querySelectorAll('[data-feature="road"]').length).toBeGreaterThan(0);
    expect(document.querySelector('image')).toBeNull();
    expect(document.querySelectorAll('[data-marker]').length).toBe(3);
  });

  it('names list rows label, detail with data-list-item and aria-current on selection', async () => {
    const onSelect = vi.fn();
    render(MapView, { props: { markers, onSelect } });
    const locations = within(
      screen.getByRole('complementary', { name: `${PORT_MERIDIAN.name} locations` })
    );
    const list = locations.getByRole('list', { name: 'Map places' });
    expect(list.getAttribute('data-map-place-list')).toBe('');
    const rows = list.querySelectorAll('[role="listitem"]');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]?.getAttribute('aria-setsize')).toBe('3');
    expect(rows[0]?.getAttribute('aria-posinset')).toBe('1');

    const northList = list.querySelector('[data-list-item="north-pier"]') as HTMLButtonElement;
    expect(northList).toBeTruthy();
    expect(northList.getAttribute('aria-label')).toBe('North Pier, 12 active');
    expect(list.querySelector('[data-list-item="old-mill"]')?.getAttribute('aria-label')).toBe(
      'Old Mill'
    );
    expect(document.querySelector('[data-marker="north-pier"]')?.getAttribute('aria-label')).toBe(
      'North Pier, 12 active'
    );

    await fireEvent.click(locations.getByRole('button', { name: 'Old Mill' }));
    expect(locations.getByRole('button', { name: 'Old Mill' }).getAttribute('aria-pressed')).toBe(
      'true'
    );
    const selectedItem = list.querySelector('[data-list-item="old-mill"]');
    expect(selectedItem?.getAttribute('aria-current')).toBe('true');
    expect(screen.getByText(/Selected:/).parentElement?.textContent).toContain('Old Mill');
    expect(onSelect).toHaveBeenCalledWith(markers[1]);
  });

  it('exposes keyboard-operable pan and zoom controls and resets to the basemap bounds', async () => {
    render(MapView, { props: { markers } });
    const initialPosition = document.querySelector('.marker')?.getAttribute('style');
    const zoomIn = screen.getByRole('button', { name: 'Zoom in' });
    expect(zoomIn.getAttribute('type')).toBe('button');
    await fireEvent.click(zoomIn);
    expect(document.querySelector('.marker')?.getAttribute('style')).not.toBe(initialPosition);
    await fireEvent.click(screen.getByRole('button', { name: 'Pan map west' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Reset map view' }));
    expect(document.querySelector('.marker')?.getAttribute('style')).toBe(initialPosition);
  });

  it('pans with pointer drag on the map surface', async () => {
    render(MapView, { props: { markers } });
    const surface = document.querySelector('[data-map-surface]') as HTMLElement;
    const before = document.querySelector('[data-marker]')?.getAttribute('style');
    await fireEvent.pointerDown(surface, { button: 0, clientX: 200, clientY: 120, pointerId: 1 });
    await fireEvent.pointerMove(surface, { button: 0, clientX: 260, clientY: 120, pointerId: 1 });
    await fireEvent.pointerUp(surface, { button: 0, clientX: 260, clientY: 120, pointerId: 1 });
    expect(document.querySelector('[data-marker]')?.getAttribute('style')).not.toBe(before);
  });

  it('pans with arrow keys when the map surface has focus', async () => {
    render(MapView, { props: { markers } });
    const surface = screen.getByRole('region', { name: /map with interactive/i });
    surface.focus();
    const before = document.querySelector('[data-marker]')?.getAttribute('style');
    await fireEvent.keyDown(surface, { key: 'ArrowRight' });
    expect(document.querySelector('[data-marker]')?.getAttribute('style')).not.toBe(before);
  });

  it('roves the virtualized place list with Home End PageDown PageUp', async () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      id: `m-${i}`,
      lng: -18.5 + i * 0.01,
      lat: -30.5,
      label: `Place ${i}`,
    }));
    render(MapView, { props: { markers: many } });
    const list = screen.getByRole('list', { name: 'Map places' });
    list.focus();
    await fireEvent.keyDown(list, { key: 'End' });
    expect(list.querySelector('[data-list-index="39"]')).toBeTruthy();
    await fireEvent.keyDown(list, { key: 'Home' });
    expect(list.querySelector('[data-list-index="0"]')).toBeTruthy();
    await fireEvent.keyDown(list, { key: 'PageDown' });
    const active = list.querySelector('button[tabindex="0"]');
    expect(active).toBeTruthy();
  });

  it('exposes clusters as keyboard-operable buttons with data-cluster that zoom into their points', async () => {
    const close = [markers[0]!, { ...markers[0]!, id: 'nearby', label: 'Nearby', lng: -18.601 }];
    render(MapView, { props: { markers: close } });
    const cluster = screen.getByRole('button', { name: '2 locations; zoom in' });
    expect(cluster.getAttribute('type')).toBe('button');
    expect(cluster.getAttribute('data-cluster')).toBeTruthy();
    // Clustered points are not individual markers on the map surface.
    expect(document.querySelector('[data-marker="north-pier"]')).toBeNull();
    expect(document.querySelector('[data-marker="nearby"]')).toBeNull();
    // List still exposes every place with stable hooks.
    expect(document.querySelector('[data-list-item="north-pier"]')).toBeTruthy();
    expect(document.querySelector('[data-list-item="nearby"]')).toBeTruthy();
    await fireEvent.click(cluster);
    expect(screen.getAllByRole('button', { name: 'North Pier, 12 active' }).length).toBeGreaterThan(
      0
    );
    // Nearby inherits detail from the close fixture clone of North Pier.
    expect(screen.getAllByRole('button', { name: 'Nearby, 12 active' }).length).toBeGreaterThan(0);
    expect(document.querySelector('[data-marker="north-pier"]')).toBeTruthy();
    expect(document.querySelector('[data-marker="nearby"]')).toBeTruthy();
  });

  it('cellPx=1 keeps two close markers separate; default still clusters; list stays single', () => {
    // ~0.05° apart: one cluster cell at default 72, two cells at cellPx=1.
    const close: MapMarker[] = [
      markers[0]!,
      { ...markers[0]!, id: 'nearby', label: 'Nearby', detail: undefined, lng: -18.55 },
    ];

    const { unmount } = render(MapView, { props: { markers: close, cellPx: 1 } });
    expect(document.querySelector('[data-marker="north-pier"]')).toBeTruthy();
    expect(document.querySelector('[data-marker="nearby"]')).toBeTruthy();
    expect(document.querySelector('[data-cluster]')).toBeNull();
    // Place list is one row per marker (never duplicated by clustering).
    expect(document.querySelectorAll('[data-list-item]')).toHaveLength(2);
    expect(document.querySelectorAll('[data-list-item="north-pier"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-list-item="nearby"]')).toHaveLength(1);
    unmount();

    render(MapView, { props: { markers: close } });
    expect(document.querySelector('[data-cluster]')).toBeTruthy();
    expect(document.querySelector('[data-marker="north-pier"]')).toBeNull();
    expect(document.querySelector('[data-marker="nearby"]')).toBeNull();
    expect(document.querySelectorAll('[data-list-item]')).toHaveLength(2);
  });

  it('renders routes and fences with legend names and strong tones', () => {
    render(MapView, {
      props: {
        markers: [
          {
            id: 'depot',
            lng: -18.6,
            lat: -30.4,
            label: 'Depot',
            tone: 'primary',
            shape: 'square',
            glyph: 'D',
          },
        ],
        routes: [route],
        fences: [fence],
        listPlacement: 'below',
      },
    });
    expect(document.querySelector('[data-route="coast-run"]')).toBeTruthy();
    expect(document.querySelector('[data-route-travelled="coast-run"]')).toBeTruthy();
    expect(document.querySelector('[data-fence="yard"]')).toBeTruthy();
    expect(document.querySelector('[data-route-list="coast-run"]')?.textContent).toContain(
      'Route: Coast run'
    );
    expect(document.querySelector('[data-fence-list="yard"]')?.textContent).toContain(
      'Fence: North yard'
    );
    const marker = document.querySelector('[data-marker="depot"]');
    expect(marker?.getAttribute('data-shape')).toBe('square');
    expect(marker?.className).toContain('tone-primary');
    expect(marker?.textContent).toContain('D');
    expect(document.querySelector('[data-map-view]')?.getAttribute('data-list-placement')).toBe(
      'below'
    );
  });

  it('picks a point with onPick on Enter when the surface is focused', async () => {
    const onPick = vi.fn();
    render(MapView, { props: { markers, onPick } });
    const surface = screen.getByRole('region', { name: /map with interactive/i });
    surface.focus();
    await fireEvent.keyDown(surface, { key: 'Enter' });
    expect(onPick).toHaveBeenCalled();
    const point = onPick.mock.calls[0]?.[0] as { lng: number; lat: number };
    expect(Number.isFinite(point.lng)).toBe(true);
    expect(Number.isFinite(point.lat)).toBe(true);
  });

  it('keeps route paths fill none and fences a non-none fill', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(
      resolve(process.cwd(), 'packages/data/src/map/MapView.svelte'),
      'utf8'
    );
    // CSS tone rules are split: routes stroke-only, fences keep fill.
    expect(source).toMatch(/\.route-base\.tone-primary[\s\S]*?fill:\s*none/);
    expect(source).toMatch(/\.fence\.tone-primary[\s\S]*?fill:\s*var\(--map-tone-primary\)/);
    expect(source).not.toMatch(
      /\.route-base\.tone-primary\s*,\s*\.route-travelled\.tone-primary\s*,\s*\.fence\.tone-primary/
    );

    render(MapView, {
      props: {
        markers: [markers[0]!],
        routes: [route],
        fences: [fence],
      },
    });
    const routePath = document.querySelector('[data-route="coast-run"]') as SVGPathElement;
    const travelled = document.querySelector(
      '[data-route-travelled="coast-run"]'
    ) as SVGPathElement;
    const fencePath = document.querySelector('[data-fence="yard"]') as SVGPathElement;
    expect(routePath).toBeTruthy();
    expect(fencePath).toBeTruthy();

    // Presentation attributes: routes never fill; fences carry a tone fill.
    expect(routePath.getAttribute('fill')).toBe('none');
    expect(travelled.getAttribute('fill')).toBe('none');
    expect(fencePath.getAttribute('fill')).toBe('var(--map-tone-warning)');
    expect(fencePath.getAttribute('fill-opacity')).toBe('0.18');

    const routeFill = getComputedStyle(routePath).fill;
    const fenceFill = getComputedStyle(fencePath).fill;
    const isNone = (value: string) =>
      !value || value === 'none' || value === 'rgba(0, 0, 0, 0)' || value === 'transparent';
    // When the harness applies styles, also check computed values.
    if (routeFill) expect(isNone(routeFill)).toBe(true);
    if (fenceFill && fenceFill !== 'var(--map-tone-warning)') {
      expect(isNone(fenceFill)).toBe(false);
    }
  });

  it('exposes data-center and data-zoom that change on keyboard pan and zoom', async () => {
    const onViewChange = vi.fn();
    render(MapView, { props: { markers, onViewChange } });
    const surface = screen.getByRole('region', { name: /map with interactive/i });
    expect(surface.getAttribute('data-center')).toMatch(/^-?\d+\.\d{4},-?\d+\.\d{4}$/);
    expect(surface.getAttribute('data-zoom')).toBeTruthy();

    const beforeCenter = surface.getAttribute('data-center');
    const beforeZoom = surface.getAttribute('data-zoom');
    surface.focus();
    await fireEvent.keyDown(surface, { key: 'ArrowRight' });
    expect(surface.getAttribute('data-center')).not.toBe(beforeCenter);
    expect(onViewChange.mock.calls.length).toBeGreaterThan(0);

    await fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(Number(surface.getAttribute('data-zoom'))).toBeGreaterThan(Number(beforeZoom));
    const last = onViewChange.mock.calls.at(-1)?.[0] as {
      center: { lat: number; lng: number };
      zoom: number;
    };
    expect(Number.isFinite(last.center.lat)).toBe(true);
    expect(Number.isFinite(last.zoom)).toBe(true);
  });

  it('keeps the empty place row out of the set bookkeeping', () => {
    render(MapView, { props: { markers: [] } });
    const empty = screen.getByText('No locations');
    expect(empty.getAttribute('role')).toBe('listitem');
    // "1 of 0" is nonsense bookkeeping for a row that is not a real entry.
    expect(empty.getAttribute('aria-posinset')).toBeNull();
    expect(empty.getAttribute('aria-setsize')).toBeNull();
  });

  it('packs the header at the top when the host container is taller than the content', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(
      resolve(process.cwd(), 'packages/data/src/map/MapView.svelte'),
      'utf8'
    );
    expect(source).toMatch(/align-content:\s*start/);

    const host = document.createElement('div');
    host.style.display = 'grid';
    host.style.blockSize = '900px';
    host.style.inlineSize = '640px';
    host.style.alignItems = 'stretch';
    document.body.appendChild(host);

    const { container } = render(MapView, {
      target: host,
      props: { markers: [markers[0]!], label: 'Tall host' },
    });
    const root = container.querySelector('[data-map-view]') as HTMLElement;
    const header = root.querySelector('header, .map-header') as HTMLElement;
    expect(root).toBeTruthy();
    expect(header).toBeTruthy();
    expect(root.getAttribute('data-align-content')).toBe('start');

    // No empty band above the header inside a stretched host.
    expect(header.offsetTop).toBeLessThanOrEqual(8);
    expect(header.getBoundingClientRect().top - root.getBoundingClientRect().top).toBeLessThan(16);

    host.remove();
  });
});

describe('MapView location panel name (T-87 F9, axe landmark-unique)', () => {
  it('names the panel from the map label, so two maps on a page stay distinct', () => {
    render(MapView, { props: { markers, label: 'Harbor coverage' } });
    render(MapView, { props: { markers, label: 'Depot coverage' } });
    const panels = screen.getAllByRole('complementary');
    expect(panels.map((panel) => panel.getAttribute('aria-label'))).toEqual([
      'Harbor coverage locations',
      'Depot coverage locations',
    ]);
  });

  it('falls back to the basemap name when no label is given', () => {
    render(MapView, { props: { markers } });
    expect(
      screen.getByRole('complementary', { name: `${PORT_MERIDIAN.name} locations` })
    ).toBeTruthy();
  });
});
