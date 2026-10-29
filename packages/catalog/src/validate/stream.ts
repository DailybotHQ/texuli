import { DEFAULT_TREE_LIMITS, type TreeLimits } from '../render/limits/types.ts';
import {
  type DraftCheck,
  type DraftDiagnostic,
  type DraftValidation,
  type ValidateDraftOptions,
  validateDraft,
} from './draft.ts';

/**
 * Node-level validation for streamed blueprints (ADR-014). A streamed node
 * paints only once its shell is final (every member but `children`
 * arrived) and the shell passes every rule `validateDraft` applies to a
 * node: the envelope header it sits under, structure, interaction, the
 * sink scan, limits, the renderer at the host's tier (closed id, props and
 * prop schemas, URL policy) and block schemas. It runs the real
 * `validateDraft`, with the same options, on the node's **chain**: the
 * header, each ancestor's shell and the node itself as the only leaf. Only
 * the checks that need the whole tree are left to the final verdict:
 * composition grammar and the root rule. Nothing here makes a draft valid;
 * the full `validateDraft` on the complete value stays the only path to a
 * valid draft.
 */

/** Checks that need the whole tree: they run only in the final `validateDraft`. */
export const STREAM_WHOLE_TREE_CHECKS: readonly DraftCheck[] = Object.freeze(['grammar', 'root']);

export interface StreamNodeInput {
  /**
   * The envelope members before the tree (`format`, `id`, `catalog`, `state`,
   * `flow`, …), or `null` for a bare tree. The chain is checked under it.
   */
  header: Readonly<Record<string, unknown>> | null;
  /** The member of `header` that holds the tree. Default `tree`. */
  treeMember?: string;
  /** Each ancestor's shell, root first (already admitted). */
  ancestors: readonly Readonly<Record<string, unknown>>[];
  /** The node's shell: every member but `children`. */
  shell: Readonly<Record<string, unknown>>;
  /** The node's index among its siblings (or among the roots). */
  index: number;
  /** `true` for a root of an array of roots. */
  root?: boolean;
  /** Nodes already admitted in this stream (for the node total). */
  admitted: number;
  /**
   * Keys of the nodes already admitted (spec 0.7.0): a key is unique in the
   * tree, so a node repeating one is refused (`duplicate-key`). The final
   * `validateDraft` checks the whole tree again.
   */
  admittedKeys?: ReadonlySet<string>;
}

export interface StreamNodeValidation {
  /** `true` when the node may paint now. */
  ok: boolean;
  /** Error diagnostics of the node-level checks (empty when `ok`). */
  diagnostics: readonly DraftDiagnostic[];
  /** The chain's validation, for hosts that paint from its render tree. */
  validation: DraftValidation | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** The header, ancestors and node as one draft whose only leaf is the node. */
export function streamNodeChain(input: StreamNodeInput): unknown {
  let tree: Record<string, unknown> = { ...input.shell };
  for (let i = input.ancestors.length - 1; i >= 0; i -= 1) {
    tree = { ...input.ancestors[i], children: [tree] };
  }
  if (input.header === null) return tree;
  return { ...input.header, [input.treeMember ?? 'tree']: tree };
}

/**
 * The totals measured so far (nodes, roots, branching) against the limits,
 * or `null` when the node fits. The final `validateDraft` measures the
 * whole tree again.
 */
export function checkStreamTotals(
  input: Pick<StreamNodeInput, 'index' | 'root' | 'admitted' | 'ancestors'>,
  limits: Partial<TreeLimits> = {}
): DraftDiagnostic | null {
  const max = { ...DEFAULT_TREE_LIMITS, ...limits };
  const issue = (code: string, message: string): DraftDiagnostic => ({
    check: 'limits',
    code,
    severity: 'error',
    path: '',
    message,
  });
  if (input.admitted + 1 > max.maxNodes) {
    return issue('nodes-exceeded', `The tree has more than ${max.maxNodes} nodes.`);
  }
  if (input.root === true && input.index + 1 > max.maxRoots) {
    return issue('roots-exceeded', `The tree has more than ${max.maxRoots} roots.`);
  }
  if (input.ancestors.length > 0 && input.index + 1 > max.maxBranching) {
    return issue('branching-exceeded', `A node has more than ${max.maxBranching} children.`);
  }
  return null;
}

/**
 * `validateDraft` on a prepared chain (see {@link streamNodeChain}) with the
 * host's options and no root rule: every error outside
 * {@link STREAM_WHOLE_TREE_CHECKS} refuses the node. Hosts with their own
 * state layer (the player resolves `$state` bindings first) call this on
 * the chain they resolved. Never throws.
 */
export function validateStreamChain(
  chain: unknown,
  options: ValidateDraftOptions
): StreamNodeValidation {
  const validation = validateDraft(chain, { ...options, frameRoots: false });
  const diagnostics = validation.diagnostics.filter(
    (d) => d.severity === 'error' && !STREAM_WHOLE_TREE_CHECKS.includes(d.check)
  );
  // A run that stopped early (parse, limits) never reached the renderer: refuse it.
  const reached = validation.status === 'valid' || validation.status === 'invalid';
  return {
    ok: reached && diagnostics.length === 0 && validation.draft !== null,
    diagnostics: Object.freeze(diagnostics),
    validation,
  };
}

/**
 * Whether one streamed node may paint: {@link checkStreamTotals}, a key
 * already admitted, then {@link validateStreamChain} on the node's chain.
 * Never throws.
 */
export function validateStreamNode(
  input: StreamNodeInput,
  options: ValidateDraftOptions
): StreamNodeValidation {
  if (!isRecord(input.shell)) {
    return {
      ok: false,
      diagnostics: Object.freeze([
        {
          check: 'structure' as const,
          code: 'not-a-node',
          severity: 'error' as const,
          path: '',
          message: 'A streamed node must be an object.',
        },
      ]),
      validation: null,
    };
  }
  const totals = checkStreamTotals(input, options.limits);
  if (totals) return { ok: false, diagnostics: Object.freeze([totals]), validation: null };
  const key = input.shell.key;
  if (typeof key === 'string' && input.admittedKeys?.has(key)) {
    return {
      ok: false,
      diagnostics: Object.freeze([
        {
          check: 'structure' as const,
          code: 'duplicate-key',
          severity: 'error' as const,
          path: '',
          message: `The key "${key}" is already used in this tree.`,
        },
      ]),
      validation: null,
    };
  }
  return validateStreamChain(streamNodeChain(input), options);
}
