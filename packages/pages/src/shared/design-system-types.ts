/**
 * The host seam for a document's design system (spec 0.10.0, ADR-024).
 * Types only: the step (`design-system.ts`) loads lazily.
 */

export interface PagesDesignSystems {
  /**
   * Resolve `id@x.y.z` (and `texuli:<theme>`, which falls back to the theme
   * library) to a design-system document or a compiled design system; may
   * return a promise. The reader never fetches.
   */
  resolve?: (
    ref: string
  ) =>
    | Readonly<Record<string, unknown>>
    | undefined
    | Promise<Readonly<Record<string, unknown>> | undefined>;
  /** The compiled mode applied to the reader. Default `light`. */
  mode?: 'light' | 'dark';
  /** The level an inline document is validated at. Default `untrusted`. */
  trust?: 'developer' | 'untrusted';
}

export type PagesDesignSystemEvent =
  | { status: 'applied'; id: string; source: 'ref' | 'inline' }
  | { status: 'refused'; code: string; path: string; message: string };
