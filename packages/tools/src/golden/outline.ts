import type { RenderNode } from '@texuli/catalog/render/renderer';
import { CHART_TITLE_LEVELS, GOLDEN_FRAME_IDS, GOLDEN_HEADING_ID } from './catalog.ts';

/**
 * The heading outline of a golden interface. The grammar check and the DOM
 * paint both use these rules, so the checked outline is the painted one:
 *
 * - a page, doc or deck `title` is the `h1`;
 * - a card `title` is one rank below the nearest titled frame around it;
 * - a heading text block keeps its own `level`;
 * - a chart `title` renders at the chart's fixed rank (`CHART_TITLE_LEVELS`).
 */

export function isFrame(id: string): boolean {
  return (GOLDEN_FRAME_IDS as readonly string[]).includes(id);
}

/** The rank a titled card renders its heading at, under `parentLevel`. */
export function cardHeadingLevel(parentLevel: number): number {
  return Math.min(parentLevel + 1, 6);
}

export function titleOf(node: RenderNode): string | undefined {
  if (node.kind !== 'component') return undefined;
  const title = node.props.title;
  return typeof title === 'string' && title.trim() !== '' ? title : undefined;
}

/** A heading text block's level, or `undefined` for any other node. */
export function textHeadingLevel(node: RenderNode): number | undefined {
  if (node.kind !== 'component' || node.id !== 'blocks-text') return undefined;
  const block = node.props.block as { type?: unknown; level?: unknown } | undefined;
  return block?.type === 'heading' && typeof block.level === 'number' ? block.level : undefined;
}

function heading(level: number): RenderNode {
  return { kind: 'component', id: GOLDEN_HEADING_ID, props: { level }, children: [] };
}

/**
 * Rewrites a render tree so every outline entry is a `golden-heading` node
 * with its rank, in document order, for `checkCompositionGrammar`.
 */
export function projectOutline(roots: readonly RenderNode[], parentLevel = 0): RenderNode[] {
  return roots.map((node) => {
    if (node.kind !== 'component') return node;
    const textLevel = textHeadingLevel(node);
    if (textLevel !== undefined) return heading(textLevel);
    const title = titleOf(node);
    let level = parentLevel;
    const lead: RenderNode[] = [];
    if (isFrame(node.id)) {
      if (title) {
        level = 1;
        lead.push(heading(1));
      }
    } else if (node.id === 'layout-card') {
      if (title) {
        level = cardHeadingLevel(parentLevel);
        lead.push(heading(level));
      }
    } else if (title && CHART_TITLE_LEVELS[node.id]) {
      lead.push(heading(CHART_TITLE_LEVELS[node.id] as number));
    }
    return {
      ...node,
      children: [...lead, ...projectOutline(node.children, level)],
    };
  });
}
