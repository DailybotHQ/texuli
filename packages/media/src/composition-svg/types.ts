import type {
  Composition,
  CompositionIssue,
  ValidateCompositionOptions,
} from '../composition-model/types.ts';

/** A serializable SVG element tree (no raw HTML strings as structure). */
export type SvgChild = SvgElementNode | string;

export interface SvgElementNode {
  tag: string;
  attrs: Record<string, string>;
  children?: SvgChild[];
}

export type RenderCompositionSvgOptions = ValidateCompositionOptions & {
  /** Accessible name for the root SVG (`<title>` + aria-label). */
  title?: string;
  /** Longer description (`<desc>`). */
  description?: string;
  /**
   * When true (default), run {@link validateComposition} first.
   * Set false only when the caller already validated the document.
   */
  validate?: boolean;
  /** Optional class on the root `<svg>`. */
  className?: string;
  /** Make the SVG keyboard-focusable (default true). */
  focusable?: boolean;
};

export type CompositionSvgResult =
  | { ok: true; root: SvgElementNode; composition: Composition }
  | { ok: false; errors: readonly CompositionIssue[] };
