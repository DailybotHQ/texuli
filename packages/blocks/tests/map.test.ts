import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { checkMapBlock, loadMapFamily, MAP_LIMITS, parseMapBlock } from '../src/index.ts';
import { formatMapLabel, resolveMapBlockLabels } from '../src/map/index.ts';
import { MapBlockView } from '../src/map/renderers.ts';
import {
  applyMapAction,
  basemapFor,
  clearFeatureLabels,
  fitPoints,
  MAP_BLOCK_SIZE,
  mapKeyAction,
  mapSizeFor,
  markerLabelFlips,
  placePoints,
  routeMeters,
  routePath,
  routeStops,
} from '../src/map/view-model.ts';

const RLO = '\u202e';

const harbor = {
  type: 'map',
  id: 'harbor-route',
  label: 'Delivery route across Port Meridian',
  title: 'Morning delivery route',
  basemap: 'port-meridian',
  points: [
    {
      id: 'depot',
      label: 'North Pier depot',
      lng: -18.6,
      lat: -30.4,
      description: 'Vans leave at 07:00.',
      tone: 'info',
    },
    { id: 'market', label: 'Meridian Center market', lng: -19.1, lat: -30.72, tone: 'success' },
    { id: 'mill', label: 'Old Mill bakery', lng: -19.2, lat: -31.1, tone: 'warning' },
  ],
  route: ['depot', 'market', 'mill'],
};

function points(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `p-${index}`,
    label: `Place ${index}`,
    lng: -19.5 + index * 0.04,
    lat: -30.9,
  }));
}

describe('parseMapBlock', () => {
  it('accepts a full and a minimal map; rejects hostile and malformed input; reports every bad point with its path; checkMapBlock is the renderer guard', () => {
    {
      // accepts a full and a minimal map
      const full = parseMapBlock(harbor);
      expect(full.success).toBe(true);
      if (full.success) {
        expect(full.data.points).toHaveLength(3);
        expect(full.data.route).toEqual(['depot', 'market', 'mill']);
      }
      expect(
        parseMapBlock({
          type: 'map',
          label: 'One place',
          points: [{ id: 'a', label: 'A', lng: 0, lat: 0 }],
        }).success
      ).toBe(true);
      expect(
        parseMapBlock({ ...harbor, points: points(MAP_LIMITS.points), route: undefined }).success
      ).toBe(true);
    }
    cleanup();
    {
      // rejects hostile and malformed input
      const point = harbor.points[0];
      const cases: [string, unknown][] = [
        ['null', null],
        ['array', [harbor]],
        ['other type', { ...harbor, type: 'image' }],
        ['non-plain object', Object.assign(Object.create({ polluted: true }), harbor)],
        ['unknown block key', { ...harbor, html: '<script>alert(1)</script>' }],
        ['unknown point key', { ...harbor, points: [{ ...point, href: 'javascript:alert(1)' }] }],
        ['missing label', { ...harbor, label: undefined }],
        ['bidi label', { ...harbor, label: `Route ${RLO}evil` }],
        ['multiline title', { ...harbor, title: 'a\nb' }],
        ['long label', { ...harbor, label: 'x'.repeat(MAP_LIMITS.label + 1) }],
        ['no points', { ...harbor, points: [], route: undefined }],
        ['too many points', { ...harbor, points: points(MAP_LIMITS.points + 1), route: undefined }],
        ['NaN longitude', { ...harbor, points: [{ ...point, lng: Number.NaN }], route: undefined }],
        [
          'infinite latitude',
          { ...harbor, points: [{ ...point, lat: Number.POSITIVE_INFINITY }], route: undefined },
        ],
        ['string latitude', { ...harbor, points: [{ ...point, lat: '40.7' }], route: undefined }],
        ['polar latitude', { ...harbor, points: [{ ...point, lat: 89 }], route: undefined }],
        [
          'longitude out of range',
          { ...harbor, points: [{ ...point, lng: 181 }], route: undefined },
        ],
        ['bad point id', { ...harbor, points: [{ ...point, id: 'Depot 1' }], route: undefined }],
        [
          'missing point id',
          { ...harbor, points: [{ ...point, id: undefined }], route: undefined },
        ],
        ['repeated point id', { ...harbor, points: [point, point], route: undefined }],
        ['unknown tone', { ...harbor, points: [{ ...point, tone: 'neon' }], route: undefined }],
        ['unknown basemap', { ...harbor, basemap: 'https://tiles.example.com/{z}/{x}/{y}.png' }],
        ['route to a missing point', { ...harbor, route: ['depot', 'nowhere'] }],
        ['one-stop route', { ...harbor, route: ['depot'] }],
        ['repeated stop', { ...harbor, route: ['depot', 'depot', 'market'] }],
        ['route not an array', { ...harbor, route: 'depot,market' }],
        [
          'route too long',
          {
            ...harbor,
            route: Array.from({ length: MAP_LIMITS.route + 1 }, (_, i) =>
              i % 2 ? 'depot' : 'market'
            ),
          },
        ],
      ];
      for (const [name, value] of cases) {
        const result = parseMapBlock(value);
        expect(result.success, name).toBe(false);
        if (!result.success) expect(result.issues.length, name).toBeGreaterThan(0);
      }
    }
    cleanup();
    {
      // reports every bad point with its path
      const result = parseMapBlock({
        ...harbor,
        route: undefined,
        points: [
          harbor.points[0],
          { id: 'x', label: 'X', lng: 500, lat: 0 },
          { id: 'y', label: '', lng: 0, lat: 0 },
        ],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.issues.map((issue) => issue.path.join('.'))).toEqual([
          'points.1.lng',
          'points.2.label',
        ]);
      }
    }
    cleanup();
    // checkMapBlock is the renderer guard
    expect(checkMapBlock(harbor).ok).toBe(true);
    expect(checkMapBlock({ type: 'map' }).ok).toBe(false);
  });
});

describe('view model', () => {
  const parsed = parseMapBlock(harbor);
  if (!parsed.success) throw new Error('fixture must parse');
  const block = parsed.data;
  const basemap = basemapFor(block);
  const home = fitPoints(block.points, basemap);
  it('frames every point inside the map, and 6 related cases', () => {
    {
      // frames every point inside the map
      const placed = placePoints(block.points, home);
      expect(placed.every((point) => point.visible)).toBe(true);
      for (const point of placed) {
        expect(point.x).toBeGreaterThan(0);
        expect(point.x).toBeLessThan(MAP_BLOCK_SIZE.width);
        expect(point.y).toBeGreaterThan(0);
        expect(point.y).toBeLessThan(MAP_BLOCK_SIZE.height);
      }
    }
    cleanup();
    {
      // does not zoom a lone point to a dot
      const lone = fitPoints([block.points[0] as (typeof block.points)[number]], basemap);
      const whole = fitPoints([], basemap);
      expect(lone.zoom).toBeLessThanOrEqual(whole.zoom + 2.5);
    }
    cleanup();
    {
      // draws the route as numbers and M/L commands only and measures it
      const stops = routeStops(block);
      expect(stops.map((stop) => stop.id)).toEqual(['depot', 'market', 'mill']);
      const d = routePath(stops, home);
      expect(d).toMatch(/^M-?\d+(\.\d)? -?\d+(\.\d)?( L-?\d+(\.\d)? -?\d+(\.\d)?)+$/);
      expect(routeMeters(stops)).toBeGreaterThan(1000);
      expect(routePath(stops.slice(0, 1), home)).toBeUndefined();
      expect(routeMeters([])).toBe(0);
    }
    cleanup();
    {
      // drops basemap labels that would print over a marker label
      const features = [
        {
          id: 'near',
          kind: 'district' as const,
          closed: true,
          d: 'M0 0',
          label: { x: 140, y: 102, text: 'North Pier' },
        },
        {
          id: 'far',
          kind: 'park' as const,
          closed: true,
          d: 'M0 0',
          label: { x: 600, y: 300, text: 'Highland Park' },
        },
        { id: 'plain', kind: 'road' as const, closed: false, d: 'M0 0' },
      ];
      const kept = clearFeatureLabels(features, [
        { x: 100, y: 100, visible: true, label: 'North Pier depot' },
      ]);
      expect(kept.map((feature) => feature.label?.text)).toEqual([
        undefined,
        'Highland Park',
        undefined,
      ]);
      expect(
        clearFeatureLabels(features, [{ x: 100, y: 100, visible: false, label: 'Hidden' }])[0]
          ?.label
      ).toBeDefined();
      // Near the inline end the label flips to the other side, and so does its box.
      const edge = { x: 760, y: 100, visible: true, label: 'Lantern Point lighthouse' };
      expect(markerLabelFlips(edge)).toBe(true);
      expect(markerLabelFlips({ x: 100, label: 'Depot' })).toBe(false);
      const lake = [
        {
          id: 'lake',
          kind: 'water' as const,
          closed: true,
          d: 'M0 0',
          label: { x: 640, y: 104, text: 'Mill Lake' },
        },
      ];
      expect(clearFeatureLabels(lake, [edge])[0]?.label).toBeUndefined();
    }
    cleanup();
    // draws at the measured width, 16:9 with a phone minimum
    expect(mapSizeFor(0)).toBe(MAP_BLOCK_SIZE);
    expect(mapSizeFor(Number.NaN)).toBe(MAP_BLOCK_SIZE);
    expect(mapSizeFor(960)).toEqual({ width: 960, height: 540 });
    expect(mapSizeFor(340)).toEqual({ width: 340, height: 240 });
    expect(mapSizeFor(9_999).width).toBe(2_000);
    cleanup();
    {
      // maps keys to actions and applies them
      expect(
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', '+', '-', '0', 'Home', 'x'].map(
          mapKeyAction
        )
      ).toEqual([
        'pan-up',
        'pan-down',
        'pan-left',
        'pan-right',
        'zoom-in',
        'zoom-out',
        'reset',
        'reset',
        undefined,
      ]);
      const east = applyMapAction(home, 'pan-right', home);
      expect(east.center.lng).toBeGreaterThan(home.center.lng);
      const north = applyMapAction(home, 'pan-up', home);
      expect(north.center.lat).toBeGreaterThan(home.center.lat);
      expect(applyMapAction(home, 'zoom-in', home).zoom).toBe(home.zoom + 1);
      expect(applyMapAction(east, 'reset', home)).toBe(home);
    }
    cleanup();
    // formats translatable labels
    expect(formatMapLabel('{count} stops · {distance}', { count: 3, distance: '2 km' })).toBe(
      '3 stops · 2 km'
    );
    expect(formatMapLabel('Hi {unknown}', {})).toBe('Hi {unknown}');
    expect(resolveMapBlockLabels({ zoomIn: 'Acercar' }).zoomIn).toBe('Acercar');
  });
});

describe('MapBlockView', () => {
  it('renders an accessible map, markers, places and the route, and 6 related cases', async () => {
    {
      // renders an accessible map, markers, places and the route
      const { container, getByRole } = render(MapBlockView, { block: harbor, locale: 'en' });
      const canvas = getByRole('application', { name: harbor.label });
      expect(canvas.getAttribute('tabindex')).toBe('0');
      expect(canvas.getAttribute('aria-roledescription')).toBe('map');
      expect(container.querySelector('h3')?.textContent).toBe('Morning delivery route');
      expect(container.querySelectorAll('[data-tx-map-marker]')).toHaveLength(3);
      expect(container.querySelectorAll('[data-tx-map-place]')).toHaveLength(3);
      const placeList = container.querySelector('[data-tx-map-place-list]');
      expect(placeList?.getAttribute('role')).toBe('list');
      const placeItems = placeList?.querySelectorAll('[role="listitem"]') ?? [];
      expect(placeItems).toHaveLength(3);
      expect(placeItems[0]?.getAttribute('aria-setsize')).toBe('3');
      expect(placeItems[0]?.getAttribute('aria-posinset')).toBe('1');
      expect(container.querySelector('[data-tx-map-route]')?.getAttribute('d')).toMatch(/^M/);
      expect(container.querySelector('[data-tx-map-route-summary]')?.textContent?.trim()).toMatch(
        /^3 stops · [\d.]+ km$/
      );
      expect([...container.querySelectorAll('ol li')].map((li) => li.textContent)).toEqual([
        'North Pier depot',
        'Meridian Center market',
        'Old Mill bakery',
      ]);
      expect(container.textContent).toContain('Port Meridian is fictional');
      expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    }
    cleanup();
    // selects a place from the list or a marker
    await (async () => {
      const onselect = vi.fn();
      const { container } = render(MapBlockView, { block: harbor, onselect });
      const depot = container.querySelector('[data-tx-map-place="depot"]') as HTMLButtonElement;
      await fireEvent.click(depot);
      expect(depot.getAttribute('aria-pressed')).toBe('true');
      expect(container.querySelector('[aria-live]')?.textContent).toContain(
        'Selected: North Pier depot. Vans leave at 07:00.'
      );
      expect(
        container.querySelector('[data-tx-map-marker="depot"]')?.classList.contains('selected')
      ).toBe(true);
      await fireEvent.click(container.querySelector('[data-tx-map-marker="mill"]') as Element);
      expect(onselect.mock.calls).toEqual([['depot'], ['mill']]);
      expect(depot.getAttribute('aria-pressed')).toBe('false');
    })();
    cleanup();
    // pans and zooms from the keyboard and the controls, and resets
    await (async () => {
      const { container, getByRole } = render(MapBlockView, { block: harbor });
      const canvas = getByRole('application');
      const marker = () =>
        container.querySelector('[data-tx-map-marker="market"] circle') as SVGCircleElement;
      const start = { x: marker().getAttribute('cx'), y: marker().getAttribute('cy') };

      const arrow = new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        cancelable: true,
      });
      canvas.dispatchEvent(arrow);
      await Promise.resolve();
      expect(arrow.defaultPrevented).toBe(true);
      expect(Number(marker().getAttribute('cx'))).toBeLessThan(Number(start.x));

      await fireEvent.keyDown(canvas, { key: '0' });
      expect(marker().getAttribute('cx')).toBe(start.x);

      await fireEvent.click(getByRole('button', { name: 'Zoom in' }));
      expect(marker().getAttribute('cx')).not.toBe(start.x);
      await fireEvent.click(getByRole('button', { name: 'Reset view' }));
      expect(marker().getAttribute('cy')).toBe(start.y);

      const ignored = new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      canvas.dispatchEvent(ignored);
      expect(ignored.defaultPrevented).toBe(false);
    })();
    cleanup();
    {
      // translates every built-in string and honors the heading level
      const { container, getByRole } = render(MapBlockView, {
        block: harbor,
        headingLevel: 2,
        labels: {
          zoomIn: 'Acercar',
          zoomOut: 'Alejar',
          reset: 'Restablecer',
          places: 'Lugares',
          routeSummary: '{count} paradas',
          roleDescription: 'mapa',
        },
      });
      expect(container.querySelector('h2')).not.toBeNull();
      expect(getByRole('button', { name: 'Acercar' })).toBeTruthy();
      expect(getByRole('button', { name: 'Alejar' })).toBeTruthy();
      expect(getByRole('button', { name: 'Restablecer' })).toBeTruthy();
      expect(container.textContent).toContain('Lugares');
      expect(container.querySelector('[data-tx-map-route-summary]')?.textContent?.trim()).toBe(
        '3 paradas'
      );
      expect(getByRole('application').getAttribute('aria-roledescription')).toBe('mapa');
    }
    cleanup();
    {
      // renders hostile text inertly and rejects invalid blocks
      const hostile = {
        ...harbor,
        label: '<img src=x onerror=alert(1)>',
        points: [
          {
            ...harbor.points[0],
            label: '<script>alert(1)</script>',
            description: '"><svg onload=alert(1)>',
          },
        ],
        route: undefined,
      };
      const { container } = render(MapBlockView, { block: hostile });
      expect(container.querySelector('img, script, foreignObject, [onerror], [onload]')).toBeNull();
      expect(container.textContent).toContain('<script>alert(1)</script>');

      const oninvalid = vi.fn();
      const bad = render(MapBlockView, {
        block: { ...harbor, route: ['depot', 'nowhere'] },
        labels: { invalid: 'Bloque no válido.' },
        oninvalid,
      });
      expect(bad.container.querySelector('[data-tx-block="invalid"]')?.textContent).toBe(
        'Bloque no válido.'
      );
      expect(bad.container.querySelector('svg')).toBeNull();
      expect(oninvalid).toHaveBeenCalledWith([expect.objectContaining({ path: ['route', 1] })]);
    }
    cleanup();
    {
      // omits the route section for a map without a route
      const { container } = render(MapBlockView, {
        block: { ...harbor, route: undefined, title: undefined },
      });
      expect(container.querySelector('[data-tx-map-route]')).toBeNull();
      expect(container.querySelector('ol')).toBeNull();
      expect(container.querySelector('h3')).toBeNull();
    }
    cleanup();
    // loads lazily
    await (async () => {
      const family = await loadMapFamily();
      const { container } = render(family.default, { block: harbor });
      expect(container.querySelector('[data-tx-block="map"]')).not.toBeNull();
    })();
  });
});
