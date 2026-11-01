/**
 * The site's native numbers, read from the generated parity matrix
 * (`native/docs/parity.json`, written by `scripts/native-parity.ts` from the
 * spec catalog and `NativeRegistry`). Every native count on texuli.com comes
 * from here, so the pages cannot drift from the renderer.
 */

// Inlined at build time (a glob, not an import: the layer guard keeps
// imports inside the package; the site reads repository files this way).
const RAW = import.meta.glob<string>('../../../../../../native/docs/parity.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const source = Object.values(RAW)[0];
if (!source) throw new Error('native/docs/parity.json not found: run scripts/native-parity.ts');
const parity = JSON.parse(source) as {
  totals: { painted: number; catalog: number; goldenTraces: number };
  components: ParityComponent[];
};

interface ParityComponent {
  id: string;
  group: string;
  native: 'painted' | 'placeholder';
}

const components: readonly ParityComponent[] = parity.components;

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
