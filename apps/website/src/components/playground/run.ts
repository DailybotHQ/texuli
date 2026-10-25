/**
 * Parse JSON, enforce tree limits, run the sink-free renderer.
 * Pure data — no DOM, no network. Host URL policy is applied on href/src
 * so the preview matches what a safe host would keep.
 */
import {
  DEFAULT_TREE_LIMITS,
  renderCatalogTreeWithLimits,
  utf8ByteLength,
} from '@texuli/catalog/render/limits';
import type {
  CatalogTreeInput,
  RenderCatalog,
  RenderDiagnostic,
  RenderNode,
  RenderTier,
} from '@texuli/catalog/render/renderer';
import { safeHref, safeImageSrc, safeMediaSrc } from '@texuli/core/url-policy';
import { playgroundCatalog } from './catalog.ts';

/**
 * Pretty-print whitespace headroom on top of the tree snapshot `maxBytes`.
 * The editor is refused before `JSON.parse` when UTF-8 length exceeds this.
 */
export const PLAYGROUND_EDITOR_BYTE_ALLOWANCE = 8 * 1024;

/** Max UTF-8 bytes accepted from the editor (tree maxBytes + whitespace allowance). */
export const PLAYGROUND_EDITOR_MAX_BYTES =
  DEFAULT_TREE_LIMITS.maxBytes + PLAYGROUND_EDITOR_BYTE_ALLOWANCE;

export type PlaygroundParseError = {
  kind: 'parse';
  message: string;
};

export type PlaygroundRunOk = {
  ok: true;
  roots: readonly RenderNode[];
  diagnostics: readonly RenderDiagnostic[];
  /** True when the tree failed depth/nodes/bytes/branching limits. */
  overLimits: boolean;
  limitMessages: readonly string[];
};

export type PlaygroundRunFail = {
  ok: false;
  error: PlaygroundParseError;
};

export type PlaygroundRunResult = PlaygroundRunOk | PlaygroundRunFail;

export type PlaygroundRunOptions = {
  catalog?: RenderCatalog;
  tier?: RenderTier;
};

/** Parse a JSON string into a catalog tree input. */
export function parseCatalogJson(
  text: string
):
  | { ok: true; tree: CatalogTreeInput | CatalogTreeInput[] }
  | { ok: false; error: PlaygroundParseError } {
  // Refuse oversized editor text before JSON.parse (DoS / memory guard).
  const bytes = utf8ByteLength(text);
  if (bytes > PLAYGROUND_EDITOR_MAX_BYTES) {
    return {
      ok: false,
      error: {
        kind: 'parse',
        message: `Editor input is too large (${bytes} bytes). Maximum is ${PLAYGROUND_EDITOR_MAX_BYTES} bytes (tree limit ${DEFAULT_TREE_LIMITS.maxBytes} plus ${PLAYGROUND_EDITOR_BYTE_ALLOWANCE} for whitespace).`,
      },
    };
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      ok: false,
      error: { kind: 'parse', message: 'Editor is empty. Paste a catalog tree JSON.' },
    };
  }
  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Invalid JSON';
    return { ok: false, error: { kind: 'parse', message: `JSON parse failed: ${message}` } };
  }
  if (value === null || (typeof value !== 'object' && !Array.isArray(value))) {
    return {
      ok: false,
      error: {
        kind: 'parse',
        message: 'Root value must be a catalog node object or an array of nodes.',
      },
    };
  }
  return { ok: true, tree: value as CatalogTreeInput | CatalogTreeInput[] };
}

/** Apply core URL policy to href/src props on every component node. */
function applyHostUrlPolicy(
  nodes: readonly RenderNode[],
  diagnostics: RenderDiagnostic[]
): readonly RenderNode[] {
  return nodes.map((node) => {
    if (node.kind === 'placeholder') return node;
    const nextProps: Record<string, unknown> = { ...node.props };
    let changed = false;
    for (const key of ['href', 'src'] as const) {
      if (!(key in nextProps)) continue;
      const raw = nextProps[key];
      const safe =
        key === 'href'
          ? safeHref(raw, 'untrusted')
          : (safeImageSrc(raw, 'untrusted') ?? safeMediaSrc(raw, 'untrusted'));
      if (safe === undefined) {
        diagnostics.push({
          code: 'invalid-prop',
          path: node.id,
          id: node.id,
          message: `Prop "${key}" failed the host URL policy and was dropped.`,
        });
        delete nextProps[key];
        changed = true;
      } else if (safe !== raw) {
        nextProps[key] = safe;
        changed = true;
      }
    }
    const children = applyHostUrlPolicy(node.children, diagnostics);
    if (!changed && children === node.children) return node;
    return {
      kind: 'component' as const,
      id: node.id,
      props: Object.freeze(nextProps),
      children,
    };
  });
}

/**
 * Full playground pipeline: parse → limits → sink-free render → host URL policy.
 */
export function runPlaygroundTree(
  text: string,
  options: PlaygroundRunOptions = {}
): PlaygroundRunResult {
  const parsed = parseCatalogJson(text);
  if (!parsed.ok) return parsed;

  const catalog = options.catalog ?? playgroundCatalog();
  const tier = options.tier ?? 'untrusted';
  const limited = renderCatalogTreeWithLimits(parsed.tree, {
    catalog,
    tier,
  });

  const diagnostics = [...limited.diagnostics];
  const roots = applyHostUrlPolicy(limited.roots, diagnostics);
  const limitMessages = limited.limitDiagnostics.map((d) => d.message);
  return {
    ok: true,
    roots,
    diagnostics: Object.freeze(diagnostics),
    overLimits: !limited.withinLimits,
    limitMessages,
  };
}

/** Flatten diagnostics for the UI list. */
export function formatDiagnostics(result: PlaygroundRunOk): string[] {
  const lines: string[] = [];
  if (result.overLimits) {
    lines.push(...result.limitMessages.map((m) => `limit: ${m}`));
  }
  for (const d of result.diagnostics) {
    const where = d.path ? ` @ ${d.path}` : '';
    const id = d.id ? ` (${d.id})` : '';
    lines.push(`${d.code}${id}${where}: ${d.message}`);
  }
  return lines;
}
