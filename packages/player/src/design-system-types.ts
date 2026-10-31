/**
 * The host seam for blueprint design systems (spec 0.10.0, ADR-024). Types
 * only: the step itself (`design-system.ts`) loads lazily.
 */

/**
 * What the host's resolver may return for a `ref`: a design-system document
 * (`texuli/design-system` JSON), a compiled design system
 * (`compileDesignSystem`'s result, or a cached JSON copy of one), or
 * `undefined` when it knows no such design system.
 */
export type PlayerDesignSystemSource = Readonly<Record<string, unknown>> | undefined;

export interface PlayerDesignSystems {
  /**
   * Resolve `id@x.y.z` (and `texuli:<theme>`, which falls back to the
   * built-in theme library when this returns `undefined`). It may return a
   * promise; it must never be a network fetch the blueprint controls. The
   * player never fetches. Also resolves `extends` bases.
   */
  resolve?: (ref: string) => PlayerDesignSystemSource | Promise<PlayerDesignSystemSource>;
  /** The compiled mode applied to the player root. Default `light`. */
  mode?: 'light' | 'dark';
}

/** What the player reports through `onDesignSystem` (and shows on its root). */
export type PlayerDesignSystemEvent =
  | { status: 'applied'; id: string; source: 'ref' | 'inline' }
  | { status: 'refused'; code: string; path: string; message: string };
