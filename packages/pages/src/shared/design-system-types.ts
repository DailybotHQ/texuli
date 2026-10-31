/**
 * The host seam for a document's design system (spec 0.10.0, ADR-024).
 * Types only: the step (`design-system.ts`) loads lazily.
 */

/**
 * Loads a document design system's `texuli:<theme>` reference or `extends`
 * base that `resolve` leaves `undefined`: a design-system document (or a
 * token `Theme`), or `undefined` when it knows no such theme (G127).
 * `loadPagesLibraryBase` is the token theme library's.
 */
export type PagesLibraryBaseLoader = (ref: string) => Promise<unknown>;

export interface PagesDesignSystems {
  /**
   * Resolve `id@x.y.z` (and `texuli:<theme>`, which falls back to the
   * reader's `loadLibraryBase`: the theme library on the default entries,
   * the host's loader or none on the core entries) to a design-system
   * document or a compiled design system; may return a promise. The reader
   * never fetches.
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
