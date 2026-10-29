import { type Block, forEachBlock, toJsonPath } from './schema/blocks.ts';

/**
 * Pure text helpers over block trees (no DOM). Used by docs (TOC), decks
 * (notes) and authoring (word counts). Markdown is stripped lightly without a
 * full parser — later tasks may plug a shared markdown texel.
 */

export interface WalkedBlock {
  block: Block;
  path: readonly (string | number)[];
  jsonPath: string;
  depth: number;
}

/** Depth-first walk of every block, including nested columns. */
export function walkBlocks(blocks: readonly Block[]): WalkedBlock[] {
  const out: WalkedBlock[] = [];
  forEachBlock(blocks, (block, path) => {
    out.push({
      block,
      path,
      jsonPath: toJsonPath(path),
      depth: path.filter((segment) => typeof segment === 'string').length,
    });
  });
  return out;
}

/** Stable slug for a heading label. */
export function slugifyHeading(label: string): string {
  return (
    label
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'section'
  );
}

/** Unique slug among `used`, appending `-2`, `-3`, … when needed. */
export function uniqueSlug(label: string, used: ReadonlySet<string>): string {
  const base = slugifyHeading(label);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

function joinParts(parts: readonly string[]): string {
  return parts
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

/**
 * A `[label](target)` link: the label stops at the next bracket and the
 * target allows one level of parentheses, so every attempt ends at the next
 * bracket or parenthesis and a run of unclosed `[` or `(` stays linear.
 */
const LIGHT_LINK = /\[([^[\]]+)\]\((?:[^()]|\([^()]*\))+\)/g;

/** Strip a few markdown markers for plain-text summaries (not a full parser). */
export function stripLightMarkdown(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(LIGHT_LINK, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Plain text of one block (no children of containers). */
export function blockText(block: Block): string {
  switch (block.type) {
    case 'heading':
      return joinParts([block.eyebrow ?? '', block.text, block.subtitle ?? '']);
    case 'text':
      return stripLightMarkdown(block.markdown);
    case 'list':
      return block.items.map((item) => stripLightMarkdown(item.text)).join('\n');
    case 'quote':
      return joinParts([stripLightMarkdown(block.quote), block.cite ?? '']);
    case 'callout':
      return joinParts([block.title ?? '', stripLightMarkdown(block.body)]);
    case 'code':
      return block.caption ? `${block.caption.trim()}\n${block.code}` : block.code;
    case 'cta':
      return block.actions.map((action) => action.label).join(' ');
    case 'divider':
      return '';
    case 'columns':
      return '';
    case 'tabs':
      return joinParts([block.label, ...block.panels.map((panel) => panel.label)]);
    case 'accordion':
      return joinParts([
        block.label ?? '',
        ...block.items.map((item) => joinParts([item.title, item.body ?? ''])),
      ]);
    case 'cards':
      return joinParts([
        block.title ?? '',
        ...block.items.map((item) => joinParts([item.eyebrow ?? '', item.title, item.body ?? ''])),
      ]);
    case 'grid':
      return joinParts([
        block.title ?? '',
        ...block.cells.map((cell) => joinParts([cell.title ?? '', cell.body ?? ''])),
      ]);
    case 'image':
      return joinParts([
        block.decorative ? '' : (block.alt ?? ''),
        block.caption ?? '',
        block.credit ?? '',
      ]);
    case 'figure':
      return joinParts([
        block.decorative ? '' : (block.alt ?? ''),
        block.caption,
        block.credit ?? '',
      ]);
    case 'video':
      return joinParts([block.label, block.caption ?? '']);
    case 'gallery':
      return joinParts([
        block.title ?? '',
        ...block.items.map((item) =>
          joinParts([item.decorative ? '' : (item.alt ?? ''), item.caption ?? ''])
        ),
      ]);
    default:
      return '';
  }
}

/** Concatenated plain text of a block list (depth-first). */
export function documentText(blocks: readonly Block[]): string {
  return walkBlocks(blocks)
    .map((entry) => blockText(entry.block))
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

/** Heading TOC entries from a block list. */
export function headingOutline(
  blocks: readonly Block[]
): { level: number; text: string; id: string; path: readonly (string | number)[] }[] {
  const used = new Set<string>();
  const out: { level: number; text: string; id: string; path: readonly (string | number)[] }[] = [];
  for (const entry of walkBlocks(blocks)) {
    if (entry.block.type !== 'heading') continue;
    const id = entry.block.id ?? uniqueSlug(entry.block.text, used);
    used.add(id);
    out.push({
      level: entry.block.level,
      text: entry.block.text,
      id,
      path: entry.path,
    });
  }
  return out;
}
