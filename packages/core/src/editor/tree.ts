import { markKey, normalizeInline, sortMarks } from './inline.ts';
import { type EditorLoadOptions, LoadBudget } from './load.ts';
import type { EditorInline, EditorIssue, EditorMark } from './types.ts';

/**
 * The nested inline shape the sink-free renderers walk. Catalog rich text and
 * blocks Markdown trees map to it one to one (`em`/`strong`/`link` nest;
 * blocks call strike `del`, the catalog stores text in `value`).
 */
export type EditorInlineNode =
  | { type: 'text'; text: string }
  | { type: 'code'; text: string }
  | { type: 'break' }
  | { type: 'strong' | 'em' | 'strike'; children: EditorInlineNode[] }
  | { type: 'link'; href: string; children: EditorInlineNode[] };

type Container = Extract<EditorInlineNode, { children: EditorInlineNode[] }>;

/** Fold runs into nested nodes, outermost mark first (`link`, `strong`, `em`, `strike`). */
export function inlineToTree(content: readonly EditorInline[]): EditorInlineNode[] {
  const root: EditorInlineNode[] = [];
  const stack: { mark: EditorMark; node: Container }[] = [];
  const children = () => stack.at(-1)?.node.children ?? root;
  for (const run of content) {
    if (run.type === 'break') {
      stack.length = 0;
      root.push({ type: 'break' });
      continue;
    }
    const wanted = run.marks.filter((mark) => mark.type !== 'code');
    let common = 0;
    while (
      common < stack.length &&
      common < wanted.length &&
      markKey((stack[common] as { mark: EditorMark }).mark) ===
        markKey(wanted[common] as EditorMark)
    )
      common += 1;
    stack.length = common;
    for (const mark of wanted.slice(common)) {
      const node: Container =
        mark.type === 'link'
          ? { type: 'link', href: mark.href, children: [] }
          : { type: mark.type as 'strong' | 'em' | 'strike', children: [] };
      children().push(node);
      stack.push({ mark, node });
    }
    const code = run.marks.some((mark) => mark.type === 'code');
    children().push({ type: code ? 'code' : 'text', text: run.text });
  }
  return root;
}

const TREE_DEPTH = 6;

/** Plain text of a node, at most 64 levels down (deeper text is dropped). */
function textOf(node: unknown, depth = 0): string {
  if (depth > 64 || typeof node !== 'object' || node === null) return '';
  const { text, value, children } = node as { text?: unknown; value?: unknown; children?: unknown };
  if (typeof text === 'string') return text;
  if (typeof value === 'string') return value;
  return Array.isArray(children)
    ? children
        .slice(0, 4_096)
        .map((child) => textOf(child, depth + 1))
        .join('')
    : '';
}

/**
 * Flatten a nested inline tree (this shape, the catalog's or the blocks
 * Markdown tree) into runs. Untrusted by default: every href passes
 * `safeHref` at `trust` (a refused link keeps its text), nesting past 6
 * levels becomes text, and unknown nodes keep their text. Never throws.
 */
export function inlineFromTree(
  nodes: unknown,
  options: EditorLoadOptions = {}
): { content: readonly EditorInline[]; diagnostics: readonly EditorIssue[] } {
  const budget = new LoadBudget(options);
  const out: EditorInline[] = [];
  const visit = (list: unknown, marks: readonly EditorMark[], depth: number) => {
    if (!Array.isArray(list)) return;
    for (const raw of list) {
      if (typeof raw !== 'object' || raw === null) continue;
      const node = raw as {
        type?: unknown;
        text?: unknown;
        value?: unknown;
        href?: unknown;
        children?: unknown;
      };
      const text =
        typeof node.text === 'string'
          ? node.text
          : typeof node.value === 'string'
            ? node.value
            : undefined;
      if (node.type === 'break') {
        out.push({ type: 'break' });
        continue;
      }
      if ((node.type === 'text' || node.type === 'code') && text !== undefined) {
        out.push(
          ...budget.inline(
            text,
            node.type === 'code' ? sortMarks([...marks, { type: 'code' }]) : marks
          )
        );
        continue;
      }
      if (depth >= TREE_DEPTH) {
        budget.report('depth-capped', 'Inline nesting deeper than 6 levels became text.');
        out.push(...budget.inline(textOf(node), marks));
        continue;
      }
      const type = node.type === 'del' ? 'strike' : node.type;
      if (type === 'strong' || type === 'em' || type === 'strike') {
        visit(node.children, sortMarks([...marks, { type }]), depth + 1);
      } else if (type === 'link') {
        const href = budget.href(node.href);
        visit(
          node.children,
          href ? sortMarks([...marks, { type: 'link', href }]) : marks,
          depth + 1
        );
      } else {
        budget.report('unknown-node', 'Unknown inline nodes kept only their text.');
        if (text !== undefined) out.push(...budget.inline(text, marks));
        visit(node.children, marks, depth + 1);
      }
    }
  };
  visit(nodes, [], 0);
  return { content: normalizeInline(out), diagnostics: budget.diagnostics };
}
