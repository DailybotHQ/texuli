/// <reference types="vite/client" />
import type { Component } from 'svelte';

/**
 * Every behavior scenario component, found by convention:
 * `tests/behavior/scenarios/<primitive>/scenario.svelte`, plus the harness's
 * own `sample` (and `sample-broken`, used only by the self test). Each loads
 * lazily, so a page pulls only the primitive it renders.
 */
type Loader = () => Promise<{ default: Component }>;

const modules = import.meta.glob<{ default: Component }>(
  '../../behavior/scenarios/*/scenario.svelte'
);

const scenarios = new Map<string, Loader>([
  ['sample', () => import('../../behavior/harness/sample/scenario.svelte')],
  ['sample-broken', () => import('../../behavior/harness/sample/broken.svelte')],
]);
for (const [path, load] of Object.entries(modules)) {
  const primitive = /\/scenarios\/([a-z0-9-]+)\/scenario\.svelte$/.exec(path)?.[1];
  if (primitive) scenarios.set(primitive, load as Loader);
}

/** The loader for one primitive's scenario, or undefined when it does not exist. */
export function scenarioLoader(primitive: string): Loader | undefined {
  return scenarios.get(primitive);
}

/** Every registered scenario, sorted. */
export function listScenarios(): string[] {
  return [...scenarios.keys()].sort();
}
