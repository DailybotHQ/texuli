import { migrateBlueprint } from '@texuli/spec/migrate';
import { isEnvelopeLike, parseEnvelope } from '../envelope/parse.ts';
import type { BlueprintEnvelope } from '../envelope/types.ts';
import { checkCompositionGrammar, grammarIssueSeverity } from '../render/grammar/check.ts';
import { defaultGrammarRoles } from '../render/grammar/roles.ts';
import type { GrammarRoleCatalog } from '../render/grammar/types.ts';
import { utf8ByteLength } from '../render/limits/measure.ts';
import { DEFAULT_TREE_LIMITS, type TreeLimits } from '../render/limits/types.ts';
import { validateCatalogTreeLimits } from '../render/limits/validate.ts';
import { renderCatalogTree } from '../render/renderer/render.ts';
import { resolveTier } from '../render/renderer/tier.ts';
import type {
  CatalogTreeInput,
  RenderCatalog,
  RenderNode,
  RenderOptions,
  RenderTier,
} from '../render/renderer/types.ts';
import { resolveInteraction } from './interaction.ts';
import { scanSinks } from './sinks.ts';

/** The checks `validateDraft` runs, in order. */
export const DRAFT_CHECKS = [
  'input',
  'envelope',
  'spec',
  'structure',
  'interaction',
  'sinks',
  'limits',
  'render',
  'blocks',
  'grammar',
  'root',
] as const;
export type DraftCheck = (typeof DRAFT_CHECKS)[number];

/** Layouts a draft may start from when the host asks for a frame root. */
export const DRAFT_FRAME_IDS: readonly string[] = Object.freeze([
  'layout-page',
  'layout-doc',
  'layout-deck',
]);

/** Whitespace headroom for text input on top of the tree's `maxBytes`. */
export const DRAFT_TEXT_ALLOWANCE = 8 * 1024;

export interface DraftDiagnostic {
  check: DraftCheck;
  /** Stable code: a renderer, limits or grammar code, or one of this module's. */
  code: string;
  severity: 'error' | 'warning';
  /** Node path from the root (`0.children.1`), or the JSON path of a value. */
  path: string;
  message: string;
  id?: string;
}

/**
 * What a host's block schema returns. `safeParseBlock` from
 * `@texuli/blocks/core` has this shape and can be passed as is.
 */
export type DraftBlockCheck =
  | { success: true }
  | {
      success: false;
      issues: readonly { path?: readonly (string | number)[]; message: string }[];
    };

export interface ValidateDraftOptions {
  /** The catalog ids and prop schemas (`renderCatalogFromBuild(build)` or test specs). */
  catalog: RenderCatalog;
  /** Who authored the draft. Chosen by the host, never by the draft. Default `untrusted`. */
  tier?: RenderTier;
  /**
   * The catalog build hash the host pinned. An envelope written for another
   * catalog fails with `catalog-mismatch`.
   */
  catalogHash?: string;
  /** Tree limits; tighter is fine. Default `DEFAULT_TREE_LIMITS`. */
  limits?: Partial<TreeLimits>;
  /** Cap on text input before `JSON.parse`. Default `maxBytes` + {@link DRAFT_TEXT_ALLOWANCE}. */
  maxTextBytes?: number;
  /** Grammar roles. Default `defaultGrammarRoles`. */
  roles?: GrammarRoleCatalog;
  /**
   * Ids the single root must have. Default {@link DRAFT_FRAME_IDS}; `false`
   * accepts any roots (a fragment, or an array of nodes).
   */
  frameRoots?: readonly string[] | false;
  /**
   * Deep schema for the `block` of every `blocks-*` node. Without it the
   * `blocks` check is `skipped` (the renderer still checks the block family).
   * Kept as an option so this module stays small and free of the block parsers.
   */
  checkBlock?: (block: unknown, id: string) => DraftBlockCheck;
  /**
   * The condition runtime for `when` (audit G07), usually `formulaConditions`
   * from `@texuli/catalog/render/conditions`. Without it a node with `when`
   * is an error (`invalid-condition`). Injected like `checkBlock`, so this
   * module stays free of the formula parser.
   */
  conditions?: RenderOptions['conditions'];
  /** Values the `when` conditions read (audit G07). Default: none, so conditions are unknown. */
  conditionInputs?: RenderOptions['conditionInputs'];
  /**
   * The full spec 0.3.0 check of an envelope, usually `validateBlueprint`
   * from `@texuli/spec` with the host's spec documents (state and flow
   * declarations, binding types, writability, action rules, workflow
   * graphs). Injected like `checkBlock`, so this module stays small. Without
   * it the `spec` check is `skipped`; the catalog-local interaction check
   * (declared names, events, bindable props, closed action ops) always runs.
   */
  checkSpec?: (envelope: unknown) => {
    ok: boolean;
    diagnostics: readonly { code: string; path: string; message: string }[];
  };
}

export type DraftStatus = 'valid' | 'invalid' | 'parse' | 'over-limits';
export type DraftCheckStatus = 'pass' | 'fail' | 'skipped';

export interface DraftValidation {
  /** True only with zero error diagnostics. */
  ok: boolean;
  status: DraftStatus;
  tier: RenderTier;
  /**
   * The draft with only `id`, `props`, `children`, `slot`, `when`, `bind` and `on` on each node, or `null`
   * when it could not be read (bad JSON, not a tree, over the limits).
   */
  draft: CatalogTreeInput | readonly CatalogTreeInput[] | null;
  /** The sink-free render tree a host paints. */
  roots: readonly RenderNode[];
  /**
   * For envelope input: the envelope with the status validation earned
   * (`validated` when `ok`, otherwise `draft`) and no activation. The status
   * and activation the input declared are never trusted.
   */
  envelope: BlueprintEnvelope | null;
  diagnostics: readonly DraftDiagnostic[];
  /** What ran: a host's receipt names these. */
  checks: Readonly<Record<DraftCheck, DraftCheckStatus>>;
}

const NODE_KEYS = new Set(['id', 'props', 'children', 'slot', 'when', 'bind', 'on']);
const PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
/** Values nested deeper than this are refused, not walked (depth bombs). */
const MAX_VALUE_DEPTH = 128;

/**
 * The single validation entry for untrusted blueprint JSON. Runs, in order:
 * input (byte cap, `JSON.parse`), structure (node fields, prototype keys,
 * depth), the raw sink scan, tree limits, the sink-free renderer at the
 * host's tier (ids, tiers, prop schemas, block family), block schemas,
 * composition grammar and the root rule. Runtime-neutral: no DOM and no
 * Node APIs. Never throws; anything unexpected fails closed.
 */
export function validateDraft(input: unknown, options: ValidateDraftOptions): DraftValidation {
  const tier: RenderTier = resolveTier(options.tier);
  const diagnostics: DraftDiagnostic[] = [];
  const checks = Object.fromEntries(DRAFT_CHECKS.map((check) => [check, 'skipped'])) as Record<
    DraftCheck,
    DraftCheckStatus
  >;
  let envelope: BlueprintEnvelope | null = null;
  const finish = (
    status: DraftStatus,
    draft: DraftValidation['draft'],
    roots: readonly RenderNode[] = []
  ): DraftValidation => {
    for (const check of DRAFT_CHECKS) {
      if (diagnostics.some((d) => d.check === check && d.severity === 'error')) {
        checks[check] = 'fail';
      }
    }
    const ok = status === 'valid' && !diagnostics.some((d) => d.severity === 'error');
    let earned: BlueprintEnvelope | null = null;
    if (envelope) {
      const { activatedBy: _untrusted, ...rest } = envelope;
      earned = { ...rest, status: ok ? 'validated' : 'draft' };
    }
    return Object.freeze({
      ok,
      status: status === 'valid' && !ok ? 'invalid' : status,
      tier,
      draft,
      roots,
      envelope: earned,
      diagnostics: Object.freeze(diagnostics),
      checks: Object.freeze(checks),
    });
  };
  const error = (check: DraftCheck, code: string, path: string, message: string, id?: string) => {
    diagnostics.push({ check, code, severity: 'error', path, message, ...(id ? { id } : {}) });
  };

  try {
    // ── Input ────────────────────────────────────────────────
    const limits = { ...DEFAULT_TREE_LIMITS, ...options.limits };
    let value = input;
    if (typeof input === 'string') {
      const cap = options.maxTextBytes ?? limits.maxBytes + DRAFT_TEXT_ALLOWANCE;
      const bytes = utf8ByteLength(input);
      if (bytes > cap) {
        error('input', 'too-large', '', `The draft is ${bytes} bytes; the limit is ${cap}.`);
        return finish('parse', null);
      }
      try {
        value = JSON.parse(input);
      } catch (cause) {
        const detail = cause instanceof Error ? cause.message : 'invalid JSON';
        error('input', 'bad-json', '', `The draft is not valid JSON: ${detail}`);
        return finish('parse', null);
      }
    }
    if (value === null || typeof value !== 'object') {
      error('input', 'not-a-tree', '', 'The draft must be a catalog node or an array of nodes.');
      return finish('parse', null);
    }
    checks.input = 'pass';

    // ── Envelope ─────────────────────────────────────────────
    if (isEnvelopeLike(value)) {
      // Older envelopes are migrated first (spec 0.2.0 → current); only `spec` changes.
      const migrated = migrateBlueprint(value);
      const blueprint = migrated.blueprint as Record<string, unknown>;
      value = blueprint;
      const parsed = parseEnvelope(blueprint, { catalogHash: options.catalogHash });
      for (const issue of parsed.issues) {
        diagnostics.push({ check: 'envelope', ...issue });
      }
      if (!parsed.envelope) return finish('parse', null);
      envelope = parsed.envelope;
      const warn = (code: string, path: string, message: string) => {
        diagnostics.push({ check: 'envelope', code, severity: 'warning', path, message });
      };
      if (envelope.status !== 'draft') {
        warn(
          'status-ignored',
          '$.status',
          `The declared "${envelope.status}" status is not trusted.`
        );
      }
      if (envelope.activatedBy !== undefined) {
        warn('activation-ignored', '$.activatedBy', 'Activation records come from the host.');
      }
      if (envelope.tier !== undefined && envelope.tier !== tier) {
        warn('tier-ignored', '$.tier', `Validated at the host's "${tier}" tier.`);
      }
      const spec = options.checkSpec?.(blueprint);
      if (spec) {
        for (const d of spec.diagnostics) error('spec', d.code, d.path, d.message);
        if (!spec.ok && !diagnostics.some((d) => d.check === 'spec')) {
          error('spec', 'spec', '$', 'The spec check refused the envelope.');
        }
        checks.spec = 'pass';
      }
      value = envelope.tree;
      checks.envelope = 'pass';
    }

    // ── Structure ────────────────────────────────────────────
    const draft = normalize(value as object, diagnostics);
    checks.structure = 'pass';
    // The byte measure walks values recursively: refuse a depth bomb first.
    if (diagnostics.some((d) => d.code === 'too-deep')) return finish('over-limits', null);

    // ── Interaction (spec 0.3.0) ─────────────────────────────
    // Bindings paint their first values; bind and on name closed sets.
    const interaction = resolveInteraction(draft, envelope?.state, options.catalog, envelope);
    for (const issue of interaction.issues) {
      error('interaction', issue.code, issue.path, issue.message, issue.id);
    }
    checks.interaction = 'pass';

    // ── Raw sink scan ────────────────────────────────────────
    for (const finding of scanSinks(value, tier)) {
      error('sinks', 'sink', finding.path, finding.message);
    }
    checks.sinks = 'pass';

    // ── Limits ───────────────────────────────────────────────
    const limited = validateCatalogTreeLimits(value, options.limits);
    for (const d of limited.diagnostics) error('limits', d.code, d.path, d.message);
    if (!limited.ok) return finish('over-limits', null);
    checks.limits = 'pass';

    // ── Renderer ─────────────────────────────────────────────
    const rendered = renderCatalogTree(interaction.tree, {
      catalog: options.catalog,
      tier,
      conditions: options.conditions,
      conditionInputs: options.conditionInputs,
    });
    for (const d of rendered.diagnostics) error('render', d.code, d.path, d.message, d.id);
    checks.render = 'pass';
    const roots = rendered.roots;

    // ── Block schemas ────────────────────────────────────────
    if (options.checkBlock) {
      checkBlocks(roots, '', options.checkBlock, diagnostics);
      checks.blocks = 'pass';
    }

    // ── Grammar ──────────────────────────────────────────────
    if (roots.length > 0) {
      const grammar = checkCompositionGrammar(roots, {
        roles: options.roles ?? defaultGrammarRoles,
        mode: 'report',
      });
      for (const issue of grammar.issues) {
        diagnostics.push({
          check: 'grammar',
          code: issue.code,
          severity: grammarIssueSeverity(issue.code),
          path: issue.path,
          message: issue.message,
          ...(issue.id ? { id: issue.id } : {}),
        });
      }
      checks.grammar = 'pass';
    }

    // ── Root rule ────────────────────────────────────────────
    const frames = options.frameRoots ?? DRAFT_FRAME_IDS;
    if (frames !== false) {
      const root = roots[0];
      if (roots.length !== 1 || root?.kind !== 'component') {
        error('root', 'root-count', '', 'the tree must render to one component root');
      } else if (!frames.includes(root.id)) {
        error(
          'root',
          'frame-root',
          '0',
          `the root must be one of ${frames.join(', ')} (got ${root.id})`,
          root.id
        );
      }
      checks.root = 'pass';
    }

    return finish('valid', draft, roots);
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    error('input', 'internal-error', '', `Validation stopped: ${detail}`);
    return finish('invalid', null);
  }
}

/**
 * A copy of the tree with only node fields. One iterative pass over the
 * whole value reports prototype keys and values nested past
 * {@link MAX_VALUE_DEPTH} (paths from `$`); the copy reports unknown node
 * fields. The renderer and limits judge everything else.
 */
function normalize(
  value: object,
  diagnostics: DraftDiagnostic[]
): CatalogTreeInput | CatalogTreeInput[] {
  const report = (code: string, path: string, message: string) => {
    diagnostics.push({ check: 'structure', code, severity: 'error', path, message });
  };
  // Iterative, so a deeply nested value cannot exhaust the stack.
  const stack: { value: unknown; path: string; depth: number }[] = [{ value, path: '$', depth: 0 }];
  let tooDeep = false;
  while (stack.length > 0) {
    const current = stack.pop() as (typeof stack)[number];
    if (current.value === null || typeof current.value !== 'object') continue;
    if (current.depth >= MAX_VALUE_DEPTH) {
      if (!tooDeep) {
        report('too-deep', current.path, `Values nest deeper than ${MAX_VALUE_DEPTH} levels.`);
      }
      tooDeep = true;
      continue;
    }
    for (const key of Object.keys(current.value)) {
      const path = Array.isArray(current.value)
        ? `${current.path}[${key}]`
        : `${current.path}.${key}`;
      if (PROTOTYPE_KEYS.has(key)) {
        report('prototype-key', path, `The key "${key}" is not allowed.`);
        continue;
      }
      stack.push({
        value: (current.value as Record<string, unknown>)[key],
        path,
        depth: current.depth + 1,
      });
    }
  }
  if (tooDeep) return [];

  const node = (raw: unknown, path: string): CatalogTreeInput => {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      // The renderer reports the bad node; keep the shape it expects.
      return raw as CatalogTreeInput;
    }
    const record = raw as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (!NODE_KEYS.has(key) && !PROTOTYPE_KEYS.has(key)) {
        report(
          'unknown-field',
          `${path}.${key}`,
          'Catalog nodes take only id, props, children, slot, when, bind and on.'
        );
      }
    }
    const out: Record<string, unknown> = { id: record.id };
    if (record.props !== undefined) out.props = record.props;
    if (record.slot !== undefined) out.slot = record.slot;
    if (record.when !== undefined) out.when = record.when;
    if (record.bind !== undefined) out.bind = record.bind;
    if (record.on !== undefined) out.on = record.on;
    if (Array.isArray(record.children)) {
      out.children = record.children.map((child, index) =>
        node(child, `${path}.children.${index}`)
      );
    } else if (record.children !== undefined) {
      out.children = record.children;
    }
    return out as unknown as CatalogTreeInput;
  };
  return Array.isArray(value)
    ? value.map((root, index) => node(root, String(index)))
    : node(value, '0');
}

function checkBlocks(
  roots: readonly RenderNode[],
  path: string,
  checkBlock: NonNullable<ValidateDraftOptions['checkBlock']>,
  diagnostics: DraftDiagnostic[]
): void {
  roots.forEach((node, index) => {
    if (node.kind !== 'component') return;
    const here = path ? `${path}.children.${index}` : String(index);
    if (node.id.startsWith('blocks-')) {
      const result = checkBlock(node.props.block, node.id);
      if (!result.success) {
        for (const issue of result.issues) {
          diagnostics.push({
            check: 'blocks',
            code: 'block-schema',
            severity: 'error',
            path: here,
            id: node.id,
            message: `block ${(issue.path ?? []).join('.') || '(root)'}: ${issue.message}`,
          });
        }
      }
    }
    checkBlocks(node.children, here, checkBlock, diagnostics);
  });
}
