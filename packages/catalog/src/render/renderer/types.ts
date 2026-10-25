import type { FormulaInputs } from '@texuli/blocks/formula';
import type { CatalogPropSchema } from '../../manifest/types.ts';

/**
 * Untrusted / agent-authored catalog tree node (input).
 * Only plain data: id, props bag, optional children, an optional parent slot
 * name and an optional condition. No HTML, no functions.
 */
export interface CatalogTreeInput {
  /** Catalog component id (`kebab-case`). */
  id: string;
  /** Props bag. Forbidden keys (`class`, `style`, …) are stripped. */
  props?: Readonly<Record<string, unknown>>;
  /** Nested catalog nodes. */
  children?: readonly CatalogTreeInput[];
  /**
   * The parent's named slot this node fills (audit G04), e.g. `hero` in
   * `layout-marketing`. It must be a `slot` prop of the parent; omitted or
   * `children` means the default slot.
   */
  slot?: string;
  /**
   * A condition that shows this node (audit G07): the closed `Condition` AST
   * of `@texuli/blocks/formula`, evaluated against the host's
   * `conditionInputs`. False or unknown hides the node.
   */
  when?: unknown;
}

/** Who is allowed to emit component ids into the tree. */
export type RenderTier = 'developer' | 'untrusted';

/** Why a node became a placeholder or was dropped. */
export type RenderIssueCode =
  | 'unknown-id'
  | 'tier-denied'
  | 'invalid-node'
  | 'schema-failure'
  | 'forbidden-prop'
  | 'html-string'
  | 'invalid-prop'
  | 'missing-required'
  | 'block-family-mismatch'
  | 'invalid-slot'
  | 'invalid-condition';

export interface RenderDiagnostic {
  code: RenderIssueCode;
  /** Path from the root, e.g. `0.children.1`. */
  path: string;
  message: string;
  /** Component id when known. */
  id?: string;
}

/**
 * Safe output node the host may map to real components.
 * Never carries `class`, `style`, HTML strings or unknown ids as components.
 */
export type RenderNode =
  | {
      kind: 'component';
      id: string;
      props: Readonly<Record<string, unknown>>;
      children: readonly RenderNode[];
      /** The parent's named slot, when not the default one (audit G04). */
      slot?: string;
    }
  | {
      kind: 'placeholder';
      /** Requested id (may be unknown). */
      id: string;
      /** Accessible / visible label for the placeholder. */
      label: string;
      reason: 'unknown-id' | 'tier-denied';
      /** The parent's named slot, when not the default one (audit G04). */
      slot?: string;
    };

export interface RenderResult {
  /** Top-level safe nodes (dropped roots are omitted). */
  roots: readonly RenderNode[];
  diagnostics: readonly RenderDiagnostic[];
}

/** Prop schemas the renderer needs for one catalog id (no full manifest). */
export interface RenderComponentSpec {
  id: string;
  /** Human label for placeholders and diagnostics. */
  label: string;
  props: readonly CatalogPropSchema[];
  /** When false, only `developer` tier may use this id. Default true if omitted. */
  agentEmittable?: boolean;
  /** Emit tier membership from the built catalog. */
  emit?: readonly RenderTier[];
}

/** Lookup table the renderer uses (built catalog or a test double). */
export type RenderCatalog = {
  /** id → spec. Missing id → unknown. */
  get(id: string): RenderComponentSpec | undefined;
  /** Whether `id` may appear under this tier. */
  allows?(id: string, tier: RenderTier): boolean;
};

export interface RenderOptions {
  catalog: RenderCatalog;
  /** Default `untrusted` (stricter). */
  tier?: RenderTier;
  /**
   * Max children processed per node (DoS guard for this core task).
   * Full tree limits live in `render/limits` (later task). Default 256.
   */
  maxChildren?: number;
  /**
   * The condition runtime for `when` (audit G07), usually `formulaConditions`
   * from `@texuli/catalog/render/conditions`. Without it, a node with `when`
   * fails closed: it is dropped with `invalid-condition`.
   */
  conditions?: RenderConditions;
  /**
   * Numeric values a node's `when` condition reads by variable name (audit
   * G07). Missing, `null` and non-finite values are unknown, and an unknown
   * condition hides its node. Default: no inputs.
   */
  conditionInputs?: FormulaInputs;
}

/** What a condition runtime answers for one untrusted `when` value. */
export type WhenParse = { ok: true; condition: unknown } | { ok: false; message: string };

/** A condition runtime the host injects (audit G07). */
export interface RenderConditions {
  /** Validate an untrusted `when` value. Never throws, never evaluates. */
  parse(value: unknown): WhenParse;
  /** `true` shows the node; `false` or `null` (unknown) hides it. Never throws. */
  evaluate(condition: unknown, inputs: FormulaInputs): boolean | null;
}
