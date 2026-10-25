import { safeHref } from '@texuli/core/url-policy';
import {
  type ChartBlock,
  type KpiBlock,
  parseDataBlock,
  type StatBlock,
  type TableBlock,
} from '../../data/schema.ts';
import {
  type CalculatorBlock,
  type ChecklistBlock,
  type PollBlock,
  parseInteractiveBlock,
  type QuizBlock,
} from '../../interactive/schema.ts';
import {
  type AccordionBlock,
  type CardsBlock,
  type GridBlock,
  parseStructureBlock,
  type TabsBlock,
} from '../../structure/schema.ts';
import { parseCodeFamilyBlock } from './code-family.ts';
import { parseMediaFamilyBlock } from './media-family.ts';
import { plainObject } from './parse-family.ts';
import {
  BLOCK_CONTENT_LIMITS,
  type BlockBase,
  fail,
  failMany,
  ok,
  type ParseResult,
  parseBlockBase,
  parsePlainText,
  toJsonPath,
} from './primitives.ts';
import { parseTextFamilyBlock } from './text-family.ts';

/**
 * Closed core vocabulary for the untrusted guard and catalog (T-blocks-core).
 * Family-specific blocks (charts, diagrams, interactive) land in later tasks.
 */

export type HeadingBlock = BlockBase & {
  type: 'heading';
  level: 1 | 2 | 3 | 4;
  text: string;
  eyebrow?: string;
  subtitle?: string;
};

export type TextBlock = BlockBase & {
  type: 'text';
  markdown: string;
};

export type ListItem = { text: string };
export type ListBlock = BlockBase & {
  type: 'list';
  ordered?: boolean;
  items: ListItem[];
};

export type QuoteBlock = BlockBase & {
  type: 'quote';
  quote: string;
  cite?: string;
};

export type CalloutBlock = BlockBase & {
  type: 'callout';
  title?: string;
  body: string;
};

export type DividerBlock = BlockBase & { type: 'divider' };

export type CodeBlock = BlockBase & {
  type: 'code';
  lang?: string;
  code: string;
  filename?: string;
  /** Plain text shown under the code. */
  caption?: string;
  /** Show line numbers (drawn by the renderer, never part of the code text). */
  lineNumbers?: boolean;
  /**
   * Stepped line highlights, one line spec per step (`["1-2", "4,6-8"]`).
   * In a deck, the block's `step` is where they start: deck step `step + i`
   * shows `highlights[i]`. Elsewhere the first step shows.
   */
  highlights?: string[];
};

export type CtaAction = { label: string; href: string };
export type CtaBlock = BlockBase & {
  type: 'cta';
  actions: CtaAction[];
};

export type ColumnsBlock = BlockBase & {
  type: 'columns';
  columns: Block[][];
};

export type ImageFit = 'contain' | 'cover';

/** Single image (optional caption). */
export type ImageBlock = BlockBase & {
  type: 'image';
  src: string;
  /** Required unless decorative. */
  alt?: string;
  decorative?: boolean;
  width: number;
  height: number;
  caption?: string;
  credit?: string;
  fit?: ImageFit;
};

/** Figure with a required caption (and optional credit). */
export type FigureBlock = BlockBase & {
  type: 'figure';
  src: string;
  alt?: string;
  decorative?: boolean;
  width: number;
  height: number;
  caption: string;
  credit?: string;
  fit?: ImageFit;
};

export type VideoBlock = BlockBase & {
  type: 'video';
  src: string;
  /** Accessible name of the video. */
  label: string;
  poster?: string;
  width: number;
  height: number;
  caption?: string;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
};

export type GalleryItem = {
  src: string;
  alt?: string;
  decorative?: boolean;
  width: number;
  height: number;
  caption?: string;
};

export type GalleryBlock = BlockBase & {
  type: 'gallery';
  title?: string;
  /** Preferred column count on wide viewports (2–4). */
  columns?: 2 | 3 | 4;
  items: GalleryItem[];
};

export type Block =
  | HeadingBlock
  | TextBlock
  | ListBlock
  | QuoteBlock
  | CalloutBlock
  | DividerBlock
  | CodeBlock
  | CtaBlock
  | ColumnsBlock
  | TabsBlock
  | AccordionBlock
  | CardsBlock
  | GridBlock
  | ImageBlock
  | FigureBlock
  | VideoBlock
  | GalleryBlock
  | TableBlock
  | StatBlock
  | KpiBlock
  | ChartBlock
  | PollBlock
  | QuizBlock
  | CalculatorBlock
  | ChecklistBlock;

export type BlockType = Block['type'];

export const BLOCK_TYPES = [
  'heading',
  'text',
  'list',
  'quote',
  'callout',
  'divider',
  'code',
  'cta',
  'columns',
  'tabs',
  'accordion',
  'cards',
  'grid',
  'image',
  'figure',
  'video',
  'gallery',
  'table',
  'stat',
  'kpi',
  'chart',
  'poll',
  'quiz',
  'calculator',
  'checklist',
] as const satisfies readonly BlockType[];

export type { AccordionBlock, CardsBlock, GridBlock, TabsBlock };

export type BlockParseResult<T> = ParseResult<T>;

function parseCta(
  record: Record<string, unknown>,
  path: (string | number)[],
  base: BlockBase
): ParseResult<CtaBlock> {
  if (!Array.isArray(record.actions) || record.actions.length === 0) {
    return fail([...path, 'actions'], 'cta needs at least one action');
  }
  if (record.actions.length > BLOCK_CONTENT_LIMITS.ctaActions) {
    return fail(
      [...path, 'actions'],
      `cta may have at most ${BLOCK_CONTENT_LIMITS.ctaActions} actions`
    );
  }
  const actions: CtaAction[] = [];
  for (let i = 0; i < record.actions.length; i += 1) {
    const actionPath = [...path, 'actions', i];
    const action = plainObject(record.actions[i], actionPath);
    if (!action.success) return action;
    const label = parsePlainText(
      action.data.label,
      [...actionPath, 'label'],
      BLOCK_CONTENT_LIMITS.plain
    );
    if (!label.success) return label;
    if (typeof action.data.href !== 'string') {
      return fail([...actionPath, 'href'], 'href must be a string');
    }
    if (action.data.href.length > BLOCK_CONTENT_LIMITS.href) {
      return fail(
        [...actionPath, 'href'],
        `href must be at most ${BLOCK_CONTENT_LIMITS.href} characters`
      );
    }
    const href = safeHref(action.data.href, 'untrusted');
    if (!href) {
      return fail(
        [...actionPath, 'href'],
        'href must be an https, mailto or same-document link (untrusted tier)'
      );
    }
    actions.push({ label: label.data, href });
  }
  return ok({ ...base, type: 'cta', actions });
}

function parseColumns(
  record: Record<string, unknown>,
  path: (string | number)[],
  base: BlockBase,
  containerDepth: number
): ParseResult<ColumnsBlock> {
  if (containerDepth >= BLOCK_CONTENT_LIMITS.containerDepth) {
    return fail(path, `containers nest at most ${BLOCK_CONTENT_LIMITS.containerDepth} deep`);
  }
  if (!Array.isArray(record.columns) || record.columns.length < 2) {
    return fail([...path, 'columns'], 'columns needs at least two columns');
  }
  if (record.columns.length > BLOCK_CONTENT_LIMITS.columns) {
    return fail([...path, 'columns'], `at most ${BLOCK_CONTENT_LIMITS.columns} columns`);
  }
  const columns: Block[][] = [];
  for (let c = 0; c < record.columns.length; c += 1) {
    const column = record.columns[c];
    if (!Array.isArray(column)) {
      return fail([...path, 'columns', c], 'each column must be a block array');
    }
    if (column.length > BLOCK_CONTENT_LIMITS.blocksPerColumn) {
      return fail(
        [...path, 'columns', c],
        `at most ${BLOCK_CONTENT_LIMITS.blocksPerColumn} blocks per column`
      );
    }
    const parsed = parseBlockList(column, [...path, 'columns', c], containerDepth + 1);
    if (!parsed.success) return parsed;
    columns.push(parsed.data);
  }
  return ok({ ...base, type: 'columns', columns });
}

function parseOneBlock(
  value: unknown,
  path: (string | number)[],
  containerDepth: number
): ParseResult<Block> {
  const object = plainObject(value, path);
  if (!object.success) return object;
  const record = object.data;
  if (typeof record.type !== 'string') return fail([...path, 'type'], 'block type is required');
  const base = parseBlockBase(record, path);
  if (!base.success) return base;

  switch (record.type) {
    case 'divider':
      return ok({ ...base.data, type: 'divider' });
    case 'cta':
      return parseCta(record, path, base.data);
    case 'columns':
      return parseColumns(record, path, base.data, containerDepth);
    default: {
      const family =
        parseTextFamilyBlock(record.type, record, path, base.data) ??
        parseCodeFamilyBlock(record.type, record, path, base.data) ??
        parseMediaFamilyBlock(record.type, record, path, base.data);
      if (family) return family as ParseResult<Block>;
      const structure = parseStructureBlock(
        record.type,
        record,
        path,
        base.data,
        containerDepth,
        parseBlockList
      );
      if (structure) return structure;
      const data = parseDataBlock(record.type, record, path, base.data);
      if (data) return data;
      const interactive = parseInteractiveBlock(record.type, record, path, base.data);
      if (interactive) return interactive;
      return fail([...path, 'type'], `Unknown block type "${record.type}"`);
    }
  }
}

export function parseBlockList(
  value: unknown,
  path: (string | number)[] = [],
  containerDepth = 0
): ParseResult<Block[]> {
  if (!Array.isArray(value)) return fail(path, 'Expected a block array');
  const blocks: Block[] = [];
  const issues: { path: (string | number)[]; message: string }[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const parsed = parseOneBlock(value[i], [...path, i], containerDepth);
    if (!parsed.success) {
      issues.push(...parsed.issues);
      continue;
    }
    blocks.push(parsed.data);
  }
  if (issues.length > 0) return failMany(issues);
  return ok(blocks);
}

export function safeParseBlocks(value: unknown): BlockParseResult<Block[]> {
  return parseBlockList(value, []);
}

export function safeParseBlock(value: unknown): BlockParseResult<Block> {
  return parseOneBlock(value, [], 0);
}

/**
 * Depth-first walk of every block, including nested columns.
 * Callback receives the block and its path from the root list.
 */
export function forEachBlock(
  blocks: readonly Block[],
  visit: (block: Block, path: readonly (string | number)[]) => void,
  path: readonly (string | number)[] = []
): void {
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    if (!block) continue;
    const blockPath = [...path, i];
    visit(block, blockPath);
    if (block.type === 'columns') {
      for (let c = 0; c < block.columns.length; c += 1) {
        const column = block.columns[c];
        if (!column) continue;
        forEachBlock(column, visit, [...blockPath, 'columns', c]);
      }
    } else if (block.type === 'tabs') {
      for (let p = 0; p < block.panels.length; p += 1) {
        const panel = block.panels[p];
        if (!panel) continue;
        forEachBlock(panel.blocks, visit, [...blockPath, 'panels', p, 'blocks']);
      }
    }
  }
}

export type {
  ChartBlock,
  ChartKind,
  ChartSeries,
  DataBlock,
  KpiBlock,
  StatBlock,
  TableBlock,
  TableCellValue,
  TableColumn,
  TableRow,
} from '../../data/schema.ts';
export { toJsonPath };
