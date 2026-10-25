import type { PaintNode } from '@texuli/catalog/player';
import { resolveMeta, resolveNestedRole } from '@texuli/catalog/render/grammar';
import { PLAYER_GRAMMAR_ROLES } from '../layout-manifests.ts';

/** The agent-emittable content layouts the player paints (catalog `contentComposition`). */
export const CONTENT_LAYOUT_IDS = Object.freeze([
  'layout-page',
  'layout-doc',
  'layout-deck',
  'layout-card',
  'layout-grid',
  'deck-slide',
  'layout-stack',
  'layout-row',
  'layout-split',
  'layout-tile',
] as const);
export type ContentLayoutId = (typeof CONTENT_LAYOUT_IDS)[number];

export function isContentLayoutId(id: string): id is ContentLayoutId {
  return (CONTENT_LAYOUT_IDS as readonly string[]).includes(id);
}

/** One titled frame listed in a document's table of contents. */
export interface TocEntry {
  frameId: string;
  title: string;
  level: number;
}

/** What the player tells a layout painter; never read from the blueprint. */
export interface FrameInfo {
  /** The title's heading rank under the grammar's `titleHeading` rule, or `null` without a title. */
  headingLevel: number | null;
  /** A DOM id unique to this player and tree path. */
  frameId: string;
  /** The node's tree path (`0.children.1`), for host-facing selection. */
  path?: string;
  /** For `layout-doc`: its titled frames and heading blocks, in reading order. */
  toc: readonly TocEntry[];
  /**
   * `true` for a heading block listed in a document's contents: the player
   * wraps it in a focusable anchor with `frameId`, the target of its link.
   */
  anchor?: boolean;
}

/** The text and level of a `blocks-text` heading block, or `null`. */
function headingBlockOf(props: Readonly<Record<string, unknown>>): TocEntry | null {
  const block = props.block;
  if (block === null || typeof block !== 'object' || Array.isArray(block)) return null;
  const { type, text, level } = block as Record<string, unknown>;
  if (type !== 'heading' || typeof text !== 'string' || text.trim() === '') return null;
  if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > 6) return null;
  return { frameId: '', title: text.trim(), level };
}

function titleOf(props: Readonly<Record<string, unknown>>): string | null {
  const { title } = props;
  return typeof title === 'string' && title.trim() !== '' ? title.trim() : null;
}

/**
 * Walk the paint plan the way `checkCompositionGrammar` walks the tree, so a
 * painted title gets exactly the rank the grammar checked: a fixed
 * `titleHeading` (page, doc, deck: 1) or `nested`, one rank below the
 * nearest titled frame around it (card, slide), capped at 6. Placeholders
 * are skipped, as they paint no heading.
 */
export function planFrames(plan: readonly PaintNode[], idPrefix: string): Map<string, FrameInfo> {
  const frames = new Map<string, FrameInfo>();

  function visit(
    node: PaintNode,
    sectionLevel: number,
    ancestorIds: readonly string[],
    toc: TocEntry[] | null
  ): void {
    if (node.kind !== 'component') return;
    const meta = resolveNestedRole(resolveMeta(PLAYER_GRAMMAR_ROLES, node.id), ancestorIds);
    const title = titleOf(node.props);
    let level: number | null = null;
    let childSection = sectionLevel;
    if (meta.titleHeading !== undefined && title !== null) {
      const nested = meta.titleHeading === 'nested';
      const rank = nested ? Math.min(sectionLevel + 1, 6) : (meta.titleHeading as number);
      level = rank;
      if (nested || rank === 1) childSection = rank;
    }

    let childToc = toc;
    if (toc && node.id === 'blocks-text') {
      const heading = headingBlockOf(node.props);
      if (heading) {
        const frameId = `${idPrefix}-anchor-${node.path.replace(/[^A-Za-z0-9]/g, '-')}`;
        frames.set(node.path, { headingLevel: heading.level, frameId, toc: [], anchor: true });
        toc.push({ ...heading, frameId });
      }
    }
    if (isContentLayoutId(node.id)) {
      const frameId = `${idPrefix}-frame-${node.path.replace(/[^A-Za-z0-9]/g, '-')}`;
      const own: TocEntry[] = [];
      frames.set(node.path, { headingLevel: level, frameId, toc: own, path: node.path });
      if (toc && title !== null && level !== null) toc.push({ frameId, title, level });
      if (node.id === 'layout-doc') childToc = own;
    }
    const ancestors = [...ancestorIds, node.id];
    for (const child of node.children) visit(child, childSection, ancestors, childToc);
  }

  for (const node of plan) visit(node, 0, [], null);
  return frames;
}
