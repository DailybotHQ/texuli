/**
 * The site's native numbers, read from the generated parity matrix
 * (`native/docs/parity.json`, written by `scripts/native-parity.ts` from the
 * spec catalog and `NativeRegistry`). Every native count on texuli.com comes
 * from here, so the pages cannot drift from the renderer.
 */
import parity from '../../../../../../native/docs/parity.json';

interface ParityComponent {
  id: string;
  group: string;
  native: 'painted' | 'placeholder';
}

const components = parity.components as readonly ParityComponent[];

/** Catalog components the native renderer paints, of the whole catalog. */
export const NATIVE_SLICE = {
  painted: parity.totals.painted,
  total: parity.totals.catalog,
  goldenTraces: parity.totals.goldenTraces,
} as const;

/** Chart families painted natively, of every chart family in the catalog. */
export const NATIVE_CHARTS = (() => {
  const charts = components.filter((entry) => entry.id.startsWith('charts-'));
  return {
    painted: charts.filter((entry) => entry.native === 'painted').map((entry) => entry.id),
    total: charts.length,
  };
})();

/** Is this catalog id painted natively? */
export function paintsNatively(id: string): boolean {
  return components.some((entry) => entry.id === id && entry.native === 'painted');
}
