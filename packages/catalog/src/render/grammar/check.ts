import type { RenderNode } from '../renderer/types.ts';
import { isContainerRole, isInteractiveRole, resolveMeta, resolveNestedRole } from './roles.ts';
import type {
  GrammarComponentMeta,
  GrammarIssue,
  GrammarIssueCode,
  GrammarLandmark,
  GrammarOptions,
  GrammarResult,
  GrammarRoleCatalog,
} from './types.ts';

/**
 * Check (and optionally repair) a sink-free render tree against the composition
 * grammar: heading outline, interactive nesting, one primary action per
 * container, landmarks, and DOM order = visual order.
 *
 * Operates only on plain {@link RenderNode} data — no DOM, no HTML.
 */
export function checkCompositionGrammar(
  roots: readonly RenderNode[],
  options: GrammarOptions
): GrammarResult {
  const mode = options.mode ?? 'report';
  const roles = options.roles;
  const baseLevel = clampLevel(options.baseHeadingLevel ?? 0);
  const issues: GrammarIssue[] = [];

  const ctx: WalkContext = {
    roles,
    mode,
    issues,
    lastHeadingLevel: baseLevel,
    h1Count: 0,
    landmarkCounts: new Map(),
    interactiveDepth: 0,
    ancestorIds: [],
    sectionLevel: 0,
  };

  const nextRoots: RenderNode[] = [];
  roots.forEach((node, index) => {
    const walked = walk(node, String(index), null, ctx);
    if (walked) nextRoots.push(walked);
    else if (mode === 'report') nextRoots.push(node);
  });

  const hard = issues.filter((i) => grammarIssueSeverity(i.code) === 'error');
  return {
    roots: Object.freeze(mode === 'repair' ? nextRoots : roots),
    issues: Object.freeze(issues.slice()),
    ok: hard.length === 0,
  };
}

type WalkContext = {
  roles: GrammarRoleCatalog;
  mode: 'report' | 'repair';
  issues: GrammarIssue[];
  lastHeadingLevel: number;
  h1Count: number;
  landmarkCounts: Map<string, number>;
  interactiveDepth: number;
  /** Enclosing component ids, outermost first. */
  ancestorIds: string[];
  /** Rank of the nearest titled frame or card around the node (0: none). */
  sectionLevel: number;
};

function walk(
  node: RenderNode,
  path: string,
  parentContainer: GrammarComponentMeta | null,
  ctx: WalkContext
): RenderNode | null {
  if (node.kind === 'placeholder') {
    return node;
  }

  const meta = resolveNestedRole(resolveMeta(ctx.roles, node.id), ctx.ancestorIds);
  const props: Record<string, unknown> = { ...node.props };
  const children = node.children.slice();

  // ── Heading outline ──────────────────────────────────────────
  const heading = headingOf(meta, props, ctx.sectionLevel);
  let sectionLevel = ctx.sectionLevel;
  if (heading) {
    const write = (next: number) => heading.write?.(props, next);
    let level = heading.level;
    if (level === null) {
      push(ctx, 'heading-level-invalid', path, node.id, 'Heading level is missing or not 1–6.');
      if (ctx.mode === 'repair') {
        level = Math.min(6, Math.max(1, (ctx.lastHeadingLevel || 0) + 1));
        write(level);
      }
    }
    if (level !== null) {
      if (level < 1 || level > 6) {
        push(ctx, 'heading-level-invalid', path, node.id, `Heading level ${level} is outside 1–6.`);
        if (ctx.mode === 'repair') {
          level = Math.min(6, Math.max(1, level));
          write(level);
        }
      }
      if (level >= 1 && level <= 6) {
        if (level === 1) {
          ctx.h1Count += 1;
          if (ctx.h1Count > 1) {
            push(
              ctx,
              'heading-multiple-h1',
              path,
              node.id,
              'More than one level-1 heading in the tree.'
            );
            if (ctx.mode === 'repair') {
              level = 2;
              write(level);
            }
          }
        }
        if (ctx.lastHeadingLevel > 0 && level > ctx.lastHeadingLevel + 1) {
          push(
            ctx,
            'heading-skip',
            path,
            node.id,
            `Heading level jumps from h${ctx.lastHeadingLevel} to h${level}.`
          );
          if (ctx.mode === 'repair') {
            level = ctx.lastHeadingLevel + 1;
            write(level);
          }
        }
        ctx.lastHeadingLevel = level;
        if (heading.section) sectionLevel = level;
      }
    }
  }

  // ── Interactive nesting ──────────────────────────────────────
  const interactive = isInteractiveRole(meta.role);
  if (interactive && ctx.interactiveDepth > 0) {
    push(
      ctx,
      'interactive-nesting',
      path,
      node.id,
      `Interactive component "${node.id}" is nested inside another interactive control.`
    );
    if (ctx.mode === 'repair') {
      return Object.freeze({
        kind: 'placeholder' as const,
        id: node.id,
        label: `Nested control “${node.id}” removed`,
        reason: 'tier-denied' as const,
      });
    }
  }

  // ── Landmarks ────────────────────────────────────────────────
  if (meta.landmark) {
    checkLandmark(ctx, meta.landmark, path, node.id);
  }

  // ── Visual order ─────────────────────────────────────────────
  if (meta.orderBreakingProps) {
    for (const prop of meta.orderBreakingProps) {
      const value = props[prop];
      if (value !== undefined && value !== null && value !== 'static' && value !== 0) {
        push(
          ctx,
          'visual-order',
          path,
          node.id,
          `Prop "${prop}" can break DOM order equals visual order.`
        );
        if (ctx.mode === 'repair') {
          delete props[prop];
        }
      }
    }
  }

  const childCtx: WalkContext = {
    ...ctx,
    interactiveDepth: interactive ? ctx.interactiveDepth + 1 : ctx.interactiveDepth,
    ancestorIds: [...ctx.ancestorIds, node.id],
    sectionLevel,
    // share mutable maps
    landmarkCounts: ctx.landmarkCounts,
    issues: ctx.issues,
  };

  const container = isContainerRole(meta.role) ? meta : parentContainer;
  let primaryCount = 0;
  const nextChildren: RenderNode[] = [];

  children.forEach((child, index) => {
    const childPath = `${path}.children.${index}`;
    let candidate = child;

    if (child.kind === 'component' && container) {
      const childMeta = resolveNestedRole(resolveMeta(ctx.roles, child.id), childCtx.ancestorIds);
      if (isPrimaryAction(childMeta, child.props as Record<string, unknown>)) {
        primaryCount += 1;
        if (primaryCount > 1) {
          push(
            ctx,
            'primary-action-multiple',
            childPath,
            child.id,
            `Container has more than one primary action (found "${child.id}").`
          );
          if (ctx.mode === 'repair') {
            candidate = Object.freeze({
              kind: 'component' as const,
              id: child.id,
              props: Object.freeze(demotePrimary(childMeta, { ...child.props })),
              children: child.children,
              ...(child.slot !== undefined ? { slot: child.slot } : {}),
            });
          }
        }
      }
    }

    const walked = walk(candidate, childPath, container, childCtx);
    if (walked) nextChildren.push(walked);
    else if (ctx.mode === 'report') nextChildren.push(child);
  });

  // Propagate heading progress from children
  ctx.lastHeadingLevel = childCtx.lastHeadingLevel;
  ctx.h1Count = childCtx.h1Count;

  if (ctx.mode === 'report') {
    return node;
  }

  return Object.freeze({
    kind: 'component' as const,
    id: node.id,
    props: Object.freeze(props),
    children: Object.freeze(nextChildren),
    ...(node.slot !== undefined ? { slot: node.slot } : {}),
  });
}

function checkLandmark(
  ctx: WalkContext,
  landmark: GrammarLandmark,
  path: string,
  id: string
): void {
  const key = landmark === 'region' ? `region:${path}` : landmark;
  const count = (ctx.landmarkCounts.get(key) ?? 0) + 1;
  ctx.landmarkCounts.set(key, count);
  if (landmark === 'main' && count > 1) {
    push(ctx, 'landmark-multiple-main', path, id, 'More than one main landmark in the tree.');
  } else if (landmark !== 'region' && count > 1) {
    push(
      ctx,
      'landmark-duplicate',
      path,
      id,
      `Duplicate "${landmark}" landmark (prefer unique landmarks).`
    );
  }
}

type NodeHeading = {
  /** The rank read from the node, or `null` when it is missing or not a number. */
  level: number | null;
  /** Writes a repaired rank back into props; absent when the rank is fixed. */
  write?: (props: Record<string, unknown>, level: number) => void;
  /** The heading titles a section: nested headings rank below it. */
  section: boolean;
};

/** The heading a node renders, or `null` when it renders none. */
function headingOf(
  meta: GrammarComponentMeta,
  props: Record<string, unknown>,
  sectionLevel: number
): NodeHeading | null {
  if (meta.role === 'heading' || meta.headingLevelProp || meta.fixedHeadingLevel) {
    return {
      level: readHeadingLevel(meta, props),
      write: (target, level) => writeHeadingLevel(meta, target, level),
      section: false,
    };
  }
  if (meta.headingBlockProp) {
    const key = meta.headingBlockProp;
    const block = props[key];
    if (block === null || typeof block !== 'object' || Array.isArray(block)) return null;
    const record = block as Record<string, unknown>;
    if (record.type !== 'heading') return null;
    return {
      level: parseLevel(record.level),
      write: (target, level) => {
        target[key] = Object.freeze({ ...record, level });
      },
      section: false,
    };
  }
  if (meta.titleHeading !== undefined) {
    const title = props.title;
    if (typeof title !== 'string' || title.trim() === '') return null;
    const nested = meta.titleHeading === 'nested';
    return {
      level: nested ? Math.min(sectionLevel + 1, 6) : (meta.titleHeading as number),
      section: nested || meta.titleHeading === 1,
    };
  }
  return null;
}

function parseLevel(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return Number(value);
  return null;
}

function readHeadingLevel(
  meta: GrammarComponentMeta,
  props: Record<string, unknown>
): number | null {
  if (meta.fixedHeadingLevel) return meta.fixedHeadingLevel;
  const prop = meta.headingLevelProp ?? 'headingLevel';
  return parseLevel(props[prop] ?? props.level);
}

function writeHeadingLevel(
  meta: GrammarComponentMeta,
  props: Record<string, unknown>,
  level: number
): void {
  const prop = meta.headingLevelProp ?? 'headingLevel';
  props[prop] = level;
}

function isPrimaryAction(meta: GrammarComponentMeta, props: Record<string, unknown>): boolean {
  if (meta.role === 'primary-action') return true;
  if (!isInteractiveRole(meta.role)) return false;
  if (props.primary === true) return true;
  const prop = meta.primaryProp ?? 'variant';
  const value = props[prop];
  const allowed = meta.primaryValues ?? ['default', 'primary'];
  return typeof value === 'string' && allowed.includes(value);
}

function demotePrimary(
  meta: GrammarComponentMeta,
  props: Record<string, unknown>
): Record<string, unknown> {
  const prop = meta.primaryProp ?? 'variant';
  if (prop in props) props[prop] = 'secondary';
  if ('primary' in props) props.primary = false;
  return props;
}

function push(
  ctx: WalkContext,
  code: GrammarIssueCode,
  path: string,
  id: string | undefined,
  message: string
): void {
  ctx.issues.push({ code, path, id, message });
}

function clampLevel(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(6, Math.floor(value));
}

/** Landmark duplicates are warnings; everything else is an error for `ok`. */
export function grammarIssueSeverity(code: GrammarIssueCode): 'error' | 'warning' {
  if (code === 'landmark-duplicate' || code === 'unknown-role') return 'warning';
  return 'error';
}
