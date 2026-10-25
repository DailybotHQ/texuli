/**
 * `@texuli/charts` public barrel. Chart math lives under `./math` and is also
 * re-exported here so `import { linearScale } from '@texuli/charts'` works.
 * Svelte chart families are added by later PLAN_001 tasks.
 */

// Keep SVG components lazy; callers load them from `@texuli/charts/flow`.
export type {
  FlowChartLabels,
  NetworkLinkInput,
  NetworkNodeInput,
} from './flow/index.ts';
export * from './math/index.ts';
