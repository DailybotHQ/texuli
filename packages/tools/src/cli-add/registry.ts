/**
 * Styled components `texuli add` may copy. Paths are under the owning package
 * root and never under `packages/primitives`.
 */
import type { AddableComponent } from './types.ts';

const TEXULI = 'texuli';

function texuliComponent(id: string, folder = id, peers?: readonly string[]): AddableComponent {
  return {
    id,
    package: TEXULI,
    directory: `src/components/${folder}`,
    ...(peers ? { peers } : {}),
  };
}

/**
 * Built-in addable set: styled `texuli` components only.
 * Primitives, tokens and engines are intentionally absent.
 */
export const DEFAULT_ADD_REGISTRY: readonly AddableComponent[] = Object.freeze([
  texuliComponent('alert'),
  texuliComponent('badge'),
  texuliComponent('button', 'button', ['texuli/cx']),
  texuliComponent('card', 'card', ['texuli/cx']),
  texuliComponent('empty'),
  texuliComponent('field'),
  texuliComponent('input'),
  texuliComponent('kbd-code', 'kbd-code'),
  texuliComponent('stat'),
  texuliComponent('stepper', 'stepper', ['texuli/cx', 'texuli/button']),
  texuliComponent('table', 'table', ['texuli/cx']),
  texuliComponent('tabs-accordion', 'tabs-accordion', ['texuli/cx']),
  texuliComponent('toast', 'toast', ['texuli/cx']),
  texuliComponent('dialog', 'dialog', ['texuli/cx', 'texuli/button', 'texuli/icons']),
]);

const BY_ID = new Map(DEFAULT_ADD_REGISTRY.map((entry) => [entry.id, entry]));

/** Look up a styled component by id, or `undefined` when unknown / not addable. */
export function getAddable(
  id: string,
  registry: readonly AddableComponent[] = DEFAULT_ADD_REGISTRY
): AddableComponent | undefined {
  if (registry === DEFAULT_ADD_REGISTRY) return BY_ID.get(id);
  return registry.find((entry) => entry.id === id);
}

/** Every addable id (sorted). */
export function listAddableIds(
  registry: readonly AddableComponent[] = DEFAULT_ADD_REGISTRY
): string[] {
  return registry.map((entry) => entry.id).sort();
}

/**
 * True when a path segment would pull primitives (forbidden for add).
 * Used as a belt-and-braces check on resolved source paths.
 */
export function isPrimitivesPath(absolutePath: string): boolean {
  const normalized = absolutePath.replace(/\\/g, '/');
  return (
    /\/packages\/primitives(\/|$)/.test(normalized) ||
    /\/@texuli\/primitives(\/|$)/.test(normalized) ||
    /\/primitives\/src\//.test(normalized)
  );
}
