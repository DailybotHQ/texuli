import { renderCatalogTree } from '../render/renderer/render.ts';
import type {
  CatalogTreeInput,
  RenderCatalog,
  RenderNode,
  RenderTier,
} from '../render/renderer/types.ts';

/**
 * Documents in blueprints (spec 0.7.0, ADR-011). A `document` node carries a
 * Texuli document in its `doc` prop. `validateDraft` checks it in two steps:
 *
 * 1. The host's {@link DraftDocumentCheck} validates the document itself at
 *    the draft's tier: the closed block vocabulary, text safety, the URL
 *    policy and the caps (`validateDocument` from `@texuli/document/schema`,
 *    injected like `checkBlock` so this module stays free of the engine).
 *    Without it a `document` node is refused (`document-unchecked`): a
 *    document never passes on structure alone.
 * 2. This module checks what the document borrows from the catalog, at the
 *    same tier: a `block` node is a `@texuli/blocks` block, checked as the
 *    `blocks-<family>` catalog id (and by `checkBlock` when the host passes
 *    it); an inline `component` embed is a one-node catalog blueprint,
 *    checked as that catalog id. A document cannot embed another document.
 */

/** The catalog id whose `doc` prop holds a Texuli document. */
export const DOCUMENT_ID = 'document';

/** One issue the host's document validator reports. */
export interface DraftDocumentIssue {
  code: string;
  /** Where in the document (a JSON path or RFC 6901 pointer). */
  path: string;
  message: string;
  severity?: 'error' | 'warning';
}

/**
 * The host's document validator: `validateDocument` from
 * `@texuli/document/schema` at the given tier, for example
 *
 * ```ts
 * const checkDocument: DraftDocumentCheck = (doc, tier) => {
 *   const result = validateDocument(doc, { trust: tier });
 *   const issues = result.issues.map((d) => ({ ...d, path: d.jsonPath }));
 *   return result.ok ? { ok: true, document: result.document, issues } : { ok: false, issues };
 * };
 * ```
 *
 * `document` is the validated copy (used for the catalog checks of step 2).
 */
export type DraftDocumentCheck = (
  doc: unknown,
  tier: RenderTier
) => { ok: boolean; document?: unknown; issues: readonly DraftDocumentIssue[] };

/** A finding of the document check, reported by `validateDraft` under `documents`. */
export interface DocumentFinding {
  code:
    | 'document-unchecked'
    | 'document-schema'
    | 'document-block'
    | 'document-embed'
    | 'document-nested';
  path: string;
  message: string;
}

export interface DocumentCheckOptions {
  catalog: RenderCatalog;
  tier: RenderTier;
  checkDocument?: DraftDocumentCheck;
  checkBlock?: (
    block: unknown,
    id: string
  ) =>
    | { success: true }
    | {
        success: false;
        issues: readonly { path?: readonly (string | number)[]; message: string }[];
      };
}

/** Issues reported per document, so a hostile document cannot flood the receipt. */
export const MAX_DOCUMENT_FINDINGS = 20;

type Bag = Record<string, unknown>;
const isBag = (value: unknown): value is Bag =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Every `document` node in a render tree with its node path. */
export function documentNodes(
  roots: readonly RenderNode[]
): { node: Extract<RenderNode, { kind: 'component' }>; path: string }[] {
  const out: { node: Extract<RenderNode, { kind: 'component' }>; path: string }[] = [];
  const stack: { node: RenderNode; path: string }[] = roots
    .map((node, index) => ({ node, path: String(index) }))
    .reverse();
  while (stack.length > 0) {
    const { node, path } = stack.pop() as { node: RenderNode; path: string };
    if (node.kind !== 'component') continue;
    if (node.id === DOCUMENT_ID) out.push({ node, path });
    for (let i = node.children.length - 1; i >= 0; i -= 1) {
      stack.push({ node: node.children[i] as RenderNode, path: `${path}.children.${i}` });
    }
  }
  return out;
}

/** The containers a document node's children live in (blocks, list items, columns). */
const CHILD_KEYS = ['blocks', 'items', 'columns'] as const;

/**
 * Check every `document` node of a validated render tree. Pure; never
 * throws (a throwing host check is reported as `document-schema`).
 */
export function checkDocuments(
  roots: readonly RenderNode[],
  options: DocumentCheckOptions
): DocumentFinding[] {
  const findings: DocumentFinding[] = [];
  for (const { node, path } of documentNodes(roots)) {
    findings.push(...checkOneDocument(node.props.doc, `${path}`, options));
  }
  return findings;
}

function checkOneDocument(
  doc: unknown,
  path: string,
  options: DocumentCheckOptions
): DocumentFinding[] {
  const out: DocumentFinding[] = [];
  const add = (finding: DocumentFinding): boolean => {
    if (out.length < MAX_DOCUMENT_FINDINGS) out.push(finding);
    return out.length < MAX_DOCUMENT_FINDINGS;
  };
  if (!options.checkDocument) {
    add({
      code: 'document-unchecked',
      path,
      message:
        'A document node needs the host document validator (checkDocument); it is refused without it.',
    });
    return out;
  }
  let result: ReturnType<DraftDocumentCheck>;
  try {
    result = options.checkDocument(doc, options.tier);
  } catch (cause) {
    add({
      code: 'document-schema',
      path,
      message: `The document validator failed: ${cause instanceof Error ? cause.message : String(cause)}`,
    });
    return out;
  }
  const errors = result.issues.filter((issue) => issue.severity !== 'warning');
  if (!result.ok || errors.length > 0) {
    for (const issue of errors) {
      if (
        !add({
          code: 'document-schema',
          path,
          message: `doc ${issue.path}: ${issue.code}: ${issue.message}`,
        })
      )
        break;
    }
    if (out.length === 0)
      add({ code: 'document-schema', path, message: 'The document is invalid.' });
    return out;
  }

  // Step 2: what the validated document borrows from the catalog.
  const document = isBag(result.document) ? result.document : isBag(doc) ? doc : {};
  const blocks = Array.isArray(document.blocks) ? document.blocks : [];
  const stack: { value: unknown; at: string }[] = [];
  for (let i = blocks.length - 1; i >= 0; i -= 1)
    stack.push({ value: blocks[i], at: `blocks[${i}]` });
  while (stack.length > 0) {
    const { value, at } = stack.pop() as { value: unknown; at: string };
    if (!isBag(value)) continue;
    if (value.type === 'block') {
      const id = `blocks-${String(value.family)}`;
      const block = { ...(isBag(value.props) ? value.props : {}), type: value.block };
      if (!checkCatalogNode({ id, props: { block } }, at, 'document-block', options, add)) break;
    } else if (value.type === 'embed' && value.kind === 'component' && isBag(value.inline)) {
      const inline = value.inline;
      if (inline.id === DOCUMENT_ID) {
        if (
          !add({
            code: 'document-nested',
            path,
            message: `doc ${at}: a document cannot embed a document.`,
          })
        )
          break;
        continue;
      }
      const node: CatalogTreeInput = {
        id: typeof inline.id === 'string' ? inline.id : '',
        ...(isBag(inline.props) ? { props: inline.props } : {}),
      };
      if (!checkCatalogNode(node, at, 'document-embed', options, add)) break;
    }
    for (const key of CHILD_KEYS) {
      const children = value[key];
      if (!Array.isArray(children)) continue;
      for (let i = children.length - 1; i >= 0; i -= 1) {
        stack.push({ value: children[i], at: `${at}.${key}[${i}]` });
      }
    }
  }
  return out;

  function checkCatalogNode(
    node: CatalogTreeInput,
    at: string,
    code: 'document-block' | 'document-embed',
    opts: DocumentCheckOptions,
    report: (finding: DocumentFinding) => boolean
  ): boolean {
    const rendered = renderCatalogTree(node, { catalog: opts.catalog, tier: opts.tier });
    for (const d of rendered.diagnostics) {
      if (
        !report({
          code,
          path,
          message: `doc ${at} (${node.id || 'no id'}): ${d.code}: ${d.message}`,
        })
      )
        return false;
    }
    const root = rendered.roots[0];
    if (rendered.diagnostics.length === 0 && root?.kind !== 'component') {
      if (
        !report({
          code,
          path,
          message: `doc ${at}: "${node.id}" does not paint as a catalog node.`,
        })
      )
        return false;
    }
    if (opts.checkBlock && root?.kind === 'component' && root.id.startsWith('blocks-')) {
      const checked = opts.checkBlock(root.props.block, root.id);
      if (!checked.success) {
        for (const issue of checked.issues) {
          const where = (issue.path ?? []).join('.') || '(root)';
          if (
            !report({
              code,
              path,
              message: `doc ${at} (${root.id}): block ${where}: ${issue.message}`,
            })
          )
            return false;
        }
      }
    }
    return true;
  }
}
