/**
 * Structure-family block shapes: tabs, accordion, cards and grid.
 * Columns, divider and cta live in core and join the family at render time.
 * Nested child lists (tabs panels) are parsed through a core-provided
 * `parseChildren` callback so this module stays free of a cycle with
 * `safeParseBlock`.
 */
import { safeHref } from '@texuli/core/url-policy';
import type { Block } from '../core/schema/blocks.ts';
import {
  BLOCK_CONTENT_LIMITS,
  type BlockBase,
  fail,
  ok,
  type ParseResult,
  parseBlockId,
  parseMultilineText,
  parseOptionalIconName,
  parsePlainText,
} from '../core/schema/primitives.ts';
import { type BlockTone, isBlockTone } from '../core/schema/vocabulary.ts';

export type StructureChildParser = (
  value: unknown,
  path: (string | number)[],
  containerDepth: number
) => ParseResult<Block[]>;

export type TabsPanel = {
  id: string;
  label: string;
  blocks: Block[];
};

export type TabsBlock = BlockBase & {
  type: 'tabs';
  /** Stable id for the tab list (deep links and state). */
  id: string;
  /** Accessible name of the tab list. */
  label: string;
  panels: TabsPanel[];
  defaultPanel?: string;
};

export type AccordionItem = {
  id: string;
  title: string;
  /** Markdown body (closed subset via RichText). */
  body?: string;
};

export type AccordionBlock = BlockBase & {
  type: 'accordion';
  id?: string;
  /** Accessible name for the accordion group. */
  label?: string;
  /** single (default) or multiple open items. */
  mode?: 'single' | 'multiple';
  items: AccordionItem[];
};

export type CardItem = {
  title: string;
  /** A decorative icon above the title (see `BLOCK_ICON_NAME`). */
  icon?: string;
  eyebrow?: string;
  body?: string;
  href?: string;
  tone?: BlockTone;
};

export type CardsBlock = BlockBase & {
  type: 'cards';
  title?: string;
  /** Preferred column count on wide viewports (2–4). */
  columns?: 2 | 3 | 4;
  items: CardItem[];
};

export type GridCell = {
  title?: string;
  body?: string;
  tone?: BlockTone;
};

export type GridBlock = BlockBase & {
  type: 'grid';
  title?: string;
  /** Preferred column count on wide viewports (2–4). */
  columns?: 2 | 3 | 4;
  cells: GridCell[];
};

export type StructureOwnedBlock = TabsBlock | AccordionBlock | CardsBlock | GridBlock;
export type StructureOwnedBlockType = StructureOwnedBlock['type'];

export const STRUCTURE_OWNED_TYPES = [
  'tabs',
  'accordion',
  'cards',
  'grid',
] as const satisfies readonly StructureOwnedBlockType[];

function plainObject(
  value: unknown,
  path: (string | number)[]
): ParseResult<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return fail(path, 'Expected a plain object');
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return fail(path, 'Objects must be plain JSON data');
  }
  return ok(value as Record<string, unknown>);
}

function parseTone(value: unknown, path: (string | number)[]): ParseResult<BlockTone | undefined> {
  if (value === undefined) return ok(undefined);
  if (!isBlockTone(value)) return fail(path, 'tone must be a known block tone');
  return ok(value);
}

function parseColumnsPref(
  value: unknown,
  path: (string | number)[]
): ParseResult<2 | 3 | 4 | undefined> {
  if (value === undefined) return ok(undefined);
  if (value !== 2 && value !== 3 && value !== 4) {
    return fail(path, 'columns must be 2, 3 or 4');
  }
  return ok(value);
}

function parsePanelId(value: unknown, path: (string | number)[]): ParseResult<string> {
  const id = parseBlockId(value, path);
  if (!id.success) return id;
  if (id.data === undefined) return fail(path, 'id is required');
  return ok(id.data);
}

export function parseTabsBlock(
  record: Record<string, unknown>,
  path: (string | number)[],
  base: BlockBase,
  containerDepth: number,
  parseChildren: StructureChildParser
): ParseResult<TabsBlock> {
  if (containerDepth >= BLOCK_CONTENT_LIMITS.containerDepth) {
    return fail(path, `containers nest at most ${BLOCK_CONTENT_LIMITS.containerDepth} deep`);
  }

  const id = parsePanelId(record.id, [...path, 'id']);
  if (!id.success) return id;

  const label = parsePlainText(record.label, [...path, 'label'], 80);
  if (!label.success) return label;

  if (!Array.isArray(record.panels) || record.panels.length < 2) {
    return fail([...path, 'panels'], 'tabs need at least two panels');
  }
  if (record.panels.length > BLOCK_CONTENT_LIMITS.tabPanels) {
    return fail(
      [...path, 'panels'],
      `tabs may have at most ${BLOCK_CONTENT_LIMITS.tabPanels} panels`
    );
  }

  const panels: TabsPanel[] = [];
  const ids = new Set<string>();
  for (let i = 0; i < record.panels.length; i += 1) {
    const panelPath = [...path, 'panels', i];
    const panel = plainObject(record.panels[i], panelPath);
    if (!panel.success) return panel;

    const panelId = parsePanelId(panel.data.id, [...panelPath, 'id']);
    if (!panelId.success) return panelId;
    if (ids.has(panelId.data)) {
      return fail([...panelPath, 'id'], `duplicate panel id "${panelId.data}"`);
    }
    ids.add(panelId.data);

    const panelLabel = parsePlainText(panel.data.label, [...panelPath, 'label'], 40);
    if (!panelLabel.success) return panelLabel;

    if (!Array.isArray(panel.data.blocks)) {
      return fail([...panelPath, 'blocks'], 'panel blocks must be an array');
    }
    if (panel.data.blocks.length === 0) {
      return fail([...panelPath, 'blocks'], 'panel needs at least one block');
    }
    if (panel.data.blocks.length > BLOCK_CONTENT_LIMITS.blocksPerColumn) {
      return fail(
        [...panelPath, 'blocks'],
        `at most ${BLOCK_CONTENT_LIMITS.blocksPerColumn} blocks per panel`
      );
    }
    const children = parseChildren(panel.data.blocks, [...panelPath, 'blocks'], containerDepth + 1);
    if (!children.success) return children;

    panels.push({ id: panelId.data, label: panelLabel.data, blocks: children.data });
  }

  let defaultPanel: string | undefined;
  if (record.defaultPanel !== undefined) {
    if (typeof record.defaultPanel !== 'string' || !ids.has(record.defaultPanel)) {
      return fail([...path, 'defaultPanel'], 'defaultPanel must name one of the panel ids');
    }
    defaultPanel = record.defaultPanel;
  }

  return ok({
    ...base,
    type: 'tabs',
    id: id.data,
    label: label.data,
    panels,
    ...(defaultPanel !== undefined ? { defaultPanel } : {}),
  });
}

export function parseAccordionBlock(
  record: Record<string, unknown>,
  path: (string | number)[],
  base: BlockBase
): ParseResult<AccordionBlock> {
  let id: string | undefined;
  if (record.id !== undefined) {
    const parsed = parsePanelId(record.id, [...path, 'id']);
    if (!parsed.success) return parsed;
    id = parsed.data;
  }

  let label: string | undefined;
  if (record.label !== undefined) {
    const parsed = parsePlainText(record.label, [...path, 'label'], 80);
    if (!parsed.success) return parsed;
    label = parsed.data;
  }

  let mode: 'single' | 'multiple' | undefined;
  if (record.mode !== undefined) {
    if (record.mode !== 'single' && record.mode !== 'multiple') {
      return fail([...path, 'mode'], 'mode must be single or multiple');
    }
    mode = record.mode;
  }

  if (!Array.isArray(record.items) || record.items.length < 1) {
    return fail([...path, 'items'], 'accordion needs at least one item');
  }
  if (record.items.length > BLOCK_CONTENT_LIMITS.tabPanels) {
    return fail(
      [...path, 'items'],
      `accordion may have at most ${BLOCK_CONTENT_LIMITS.tabPanels} items`
    );
  }

  const items: AccordionItem[] = [];
  const ids = new Set<string>();
  for (let i = 0; i < record.items.length; i += 1) {
    const itemPath = [...path, 'items', i];
    const item = plainObject(record.items[i], itemPath);
    if (!item.success) return item;

    const itemId = parsePanelId(item.data.id, [...itemPath, 'id']);
    if (!itemId.success) return itemId;
    if (ids.has(itemId.data)) {
      return fail([...itemPath, 'id'], `duplicate item id "${itemId.data}"`);
    }
    ids.add(itemId.data);

    const title = parsePlainText(item.data.title, [...itemPath, 'title'], 80);
    if (!title.success) return title;

    let body: string | undefined;
    if (item.data.body !== undefined) {
      const parsed = parseMultilineText(
        item.data.body,
        [...itemPath, 'body'],
        BLOCK_CONTENT_LIMITS.shortMarkdown
      );
      if (!parsed.success) return parsed;
      body = parsed.data;
    }

    items.push({
      id: itemId.data,
      title: title.data,
      ...(body !== undefined ? { body } : {}),
    });
  }

  return ok({
    ...base,
    type: 'accordion',
    items,
    ...(id !== undefined ? { id } : {}),
    ...(label !== undefined ? { label } : {}),
    ...(mode !== undefined ? { mode } : {}),
  });
}

export function parseCardsBlock(
  record: Record<string, unknown>,
  path: (string | number)[],
  base: BlockBase
): ParseResult<CardsBlock> {
  let title: string | undefined;
  if (record.title !== undefined) {
    const parsed = parsePlainText(record.title, [...path, 'title'], 120);
    if (!parsed.success) return parsed;
    title = parsed.data;
  }

  const columns = parseColumnsPref(record.columns, [...path, 'columns']);
  if (!columns.success) return columns;

  if (!Array.isArray(record.items) || record.items.length < 1) {
    return fail([...path, 'items'], 'cards need at least one item');
  }
  if (record.items.length > BLOCK_CONTENT_LIMITS.cards) {
    return fail([...path, 'items'], `cards may have at most ${BLOCK_CONTENT_LIMITS.cards} items`);
  }

  const items: CardItem[] = [];
  for (let i = 0; i < record.items.length; i += 1) {
    const itemPath = [...path, 'items', i];
    const item = plainObject(record.items[i], itemPath);
    if (!item.success) return item;

    const cardTitle = parsePlainText(item.data.title, [...itemPath, 'title'], 80);
    if (!cardTitle.success) return cardTitle;

    let eyebrow: string | undefined;
    if (item.data.eyebrow !== undefined) {
      const parsed = parsePlainText(item.data.eyebrow, [...itemPath, 'eyebrow'], 40);
      if (!parsed.success) return parsed;
      eyebrow = parsed.data;
    }

    let body: string | undefined;
    if (item.data.body !== undefined) {
      const parsed = parseMultilineText(
        item.data.body,
        [...itemPath, 'body'],
        BLOCK_CONTENT_LIMITS.shortMarkdown
      );
      if (!parsed.success) return parsed;
      body = parsed.data;
    }

    let href: string | undefined;
    if (item.data.href !== undefined) {
      if (typeof item.data.href !== 'string') {
        return fail([...itemPath, 'href'], 'href must be a string');
      }
      if (item.data.href.length > BLOCK_CONTENT_LIMITS.href) {
        return fail(
          [...itemPath, 'href'],
          `href must be at most ${BLOCK_CONTENT_LIMITS.href} characters`
        );
      }
      const safe = safeHref(item.data.href, 'untrusted');
      if (!safe) {
        return fail(
          [...itemPath, 'href'],
          'href must be an https, mailto or same-document link (untrusted tier)'
        );
      }
      href = safe;
    }

    const tone = parseTone(item.data.tone, [...itemPath, 'tone']);
    if (!tone.success) return tone;

    const icon = parseOptionalIconName(item.data.icon, [...itemPath, 'icon']);
    if (!icon.success) return icon;

    items.push({
      title: cardTitle.data,
      ...(icon.data !== undefined ? { icon: icon.data } : {}),
      ...(eyebrow !== undefined ? { eyebrow } : {}),
      ...(body !== undefined ? { body } : {}),
      ...(href !== undefined ? { href } : {}),
      ...(tone.data !== undefined ? { tone: tone.data } : {}),
    });
  }

  return ok({
    ...base,
    type: 'cards',
    items,
    ...(title !== undefined ? { title } : {}),
    ...(columns.data !== undefined ? { columns: columns.data } : {}),
  });
}

export function parseGridBlock(
  record: Record<string, unknown>,
  path: (string | number)[],
  base: BlockBase
): ParseResult<GridBlock> {
  let title: string | undefined;
  if (record.title !== undefined) {
    const parsed = parsePlainText(record.title, [...path, 'title'], 120);
    if (!parsed.success) return parsed;
    title = parsed.data;
  }

  const columns = parseColumnsPref(record.columns, [...path, 'columns']);
  if (!columns.success) return columns;

  if (!Array.isArray(record.cells) || record.cells.length < 1) {
    return fail([...path, 'cells'], 'grid needs at least one cell');
  }
  if (record.cells.length > BLOCK_CONTENT_LIMITS.cards) {
    return fail([...path, 'cells'], `grid may have at most ${BLOCK_CONTENT_LIMITS.cards} cells`);
  }

  const cells: GridCell[] = [];
  for (let i = 0; i < record.cells.length; i += 1) {
    const cellPath = [...path, 'cells', i];
    const cell = plainObject(record.cells[i], cellPath);
    if (!cell.success) return cell;

    let cellTitle: string | undefined;
    if (cell.data.title !== undefined) {
      const parsed = parsePlainText(cell.data.title, [...cellPath, 'title'], 80);
      if (!parsed.success) return parsed;
      cellTitle = parsed.data;
    }

    let body: string | undefined;
    if (cell.data.body !== undefined) {
      const parsed = parseMultilineText(
        cell.data.body,
        [...cellPath, 'body'],
        BLOCK_CONTENT_LIMITS.shortMarkdown
      );
      if (!parsed.success) return parsed;
      body = parsed.data;
    }

    if (cellTitle === undefined && body === undefined) {
      return fail(cellPath, 'grid cell needs a title or body');
    }

    const tone = parseTone(cell.data.tone, [...cellPath, 'tone']);
    if (!tone.success) return tone;

    cells.push({
      ...(cellTitle !== undefined ? { title: cellTitle } : {}),
      ...(body !== undefined ? { body } : {}),
      ...(tone.data !== undefined ? { tone: tone.data } : {}),
    });
  }

  return ok({
    ...base,
    type: 'grid',
    cells,
    ...(title !== undefined ? { title } : {}),
    ...(columns.data !== undefined ? { columns: columns.data } : {}),
  });
}

/**
 * Dispatch for structure-owned types. Returns null when `type` is not owned
 * here (core handles columns/divider/cta).
 */
export function parseStructureBlock(
  type: string,
  record: Record<string, unknown>,
  path: (string | number)[],
  base: BlockBase,
  containerDepth: number,
  parseChildren: StructureChildParser
): ParseResult<StructureOwnedBlock> | null {
  switch (type) {
    case 'tabs':
      return parseTabsBlock(record, path, base, containerDepth, parseChildren);
    case 'accordion':
      return parseAccordionBlock(record, path, base);
    case 'cards':
      return parseCardsBlock(record, path, base);
    case 'grid':
      return parseGridBlock(record, path, base);
    default:
      return null;
  }
}
