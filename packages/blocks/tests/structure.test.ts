// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { BLOCK_CONTENT_LIMITS, type FieldIssue, safeParseBlock } from '../src/core/index.ts';
import { checkStructureBlock } from '../src/structure/check.ts';
import {
  isStructureFamilyBlock,
  loadStructureFamily,
  STRUCTURE_BLOCK_TYPES,
} from '../src/structure/family.ts';
import StructureFamily from '../src/structure/StructureFamily.svelte';

afterEach(() => cleanup());

const columns = {
  type: 'columns',
  columns: [
    [
      { type: 'heading', level: 3, text: 'Plan' },
      { type: 'text', markdown: 'Write the brief.' },
    ],
    [
      { type: 'heading', level: 3, text: 'Ship' },
      { type: 'text', markdown: 'Validate and release.' },
    ],
  ],
};

const grid = {
  type: 'grid',
  title: 'Harbor squads',
  columns: 2 as const,
  cells: [
    { title: 'Design', body: 'Tokens and themes.', tone: 'info' },
    { title: 'Build', body: 'Components and blocks.', tone: 'success' },
  ],
};

const tabs = {
  type: 'tabs',
  id: 'harbor-tabs',
  label: 'Harbor product areas',
  defaultPanel: 'design',
  panels: [
    {
      id: 'design',
      label: 'Design',
      blocks: [{ type: 'text', markdown: 'Tokens, themes and contrast.' }],
    },
    {
      id: 'build',
      label: 'Build',
      blocks: [{ type: 'text', markdown: 'Components and content blocks.' }],
    },
  ],
};

const accordion = {
  type: 'accordion',
  id: 'faq',
  label: 'Harbor FAQ',
  mode: 'single' as const,
  items: [
    { id: 'what', title: 'What is Harbor?', body: 'A fictional product lab.' },
    { id: 'who', title: 'Who is it for?', body: 'Design and build squads.' },
  ],
};

const cards = {
  type: 'cards',
  title: 'Harbor resources',
  columns: 2 as const,
  items: [
    {
      title: 'Docs',
      eyebrow: 'Guide',
      body: 'Read the overview.',
      href: 'https://example.com/docs',
      tone: 'info',
    },
    {
      title: 'Support',
      body: 'Ask the team.',
      href: 'mailto:hello@example.com',
    },
  ],
};

const divider = { type: 'divider' };
const cta = {
  type: 'cta',
  actions: [
    { label: 'Docs', href: 'https://example.com/docs' },
    { label: 'Contact', href: 'mailto:hello@example.com' },
  ],
};

describe('structure block schemas', () => {
  it('lists the structure family types', () => {
    expect(STRUCTURE_BLOCK_TYPES).toEqual([
      'columns',
      'grid',
      'tabs',
      'accordion',
      'cards',
      'divider',
      'cta',
    ]);
  });

  it('parses columns, grid, tabs, accordion, cards, divider and cta', () => {
    for (const sample of [columns, grid, tabs, accordion, cards, divider, cta]) {
      const parsed = safeParseBlock(sample);
      expect(parsed.success, JSON.stringify(sample)).toBe(true);
      if (parsed.success) expect(isStructureFamilyBlock(parsed.data)).toBe(true);
    }
  });

  it('rejects hostile text in accordion and grid bodies', () => {
    const badAccordion = safeParseBlock({
      type: 'accordion',
      items: [{ id: 'x', title: 'Ok', body: `bad${String.fromCharCode(0)}body` }],
    });
    expect(badAccordion.success).toBe(false);

    const badGrid = safeParseBlock({
      type: 'grid',
      cells: [{ title: `bad${String.fromCharCode(0x202e)}title` }],
    });
    expect(badGrid.success).toBe(false);
  });

  it('rejects hostile and disallowed card hrefs', () => {
    expect(
      safeParseBlock({
        type: 'cards',
        items: [{ title: 'X', href: 'javascript:alert(1)' }],
      }).success
    ).toBe(false);
    expect(
      safeParseBlock({
        type: 'cards',
        items: [{ title: 'X', href: 'https://evil.example/x' }],
      }).success
    ).toBe(true);
  });

  it('rejects oversized and invalid tabs', () => {
    expect(
      safeParseBlock({
        type: 'tabs',
        id: 't',
        label: 'T',
        panels: [{ id: 'a', label: 'A', blocks: [{ type: 'text', markdown: 'only' }] }],
      }).success
    ).toBe(false);

    const tooMany = safeParseBlock({
      type: 'tabs',
      id: 't',
      label: 'T',
      panels: Array.from({ length: BLOCK_CONTENT_LIMITS.tabPanels + 1 }, (_, i) => ({
        id: `p${i}`,
        label: `P${i}`,
        blocks: [{ type: 'text', markdown: 'x' }],
      })),
    });
    expect(tooMany.success).toBe(false);

    expect(
      safeParseBlock({
        type: 'tabs',
        id: 't',
        label: 'T',
        defaultPanel: 'missing',
        panels: [
          { id: 'a', label: 'A', blocks: [{ type: 'text', markdown: 'a' }] },
          { id: 'b', label: 'B', blocks: [{ type: 'text', markdown: 'b' }] },
        ],
      }).success
    ).toBe(false);

    expect(
      safeParseBlock({
        type: 'tabs',
        id: 't',
        label: 'T',
        panels: [
          { id: 'a', label: 'A', blocks: [{ type: 'text', markdown: 'a' }] },
          { id: 'a', label: 'B', blocks: [{ type: 'text', markdown: 'b' }] },
        ],
      }).success
    ).toBe(false);
  });

  it('rejects empty cards and grid cells without content', () => {
    expect(safeParseBlock({ type: 'cards', items: [] }).success).toBe(false);
    expect(safeParseBlock({ type: 'grid', cells: [{}] }).success).toBe(false);
    expect(safeParseBlock({ type: 'grid', cells: [] }).success).toBe(false);
  });

  it('checkStructureBlock accepts structure and rejects other families', () => {
    const ok = checkStructureBlock(columns);
    expect(ok.ok).toBe(true);
    const other = checkStructureBlock({
      type: 'table',
      columns: [{ id: 'a', label: 'A' }],
      rows: [],
    });
    expect(other.ok).toBe(false);
    const hostile = checkStructureBlock({
      type: 'accordion',
      items: [{ id: 'x', title: `bad${String.fromCharCode(0)}` }],
    });
    expect(hostile.ok).toBe(false);
  });
});

describe('structure family renderer', () => {
  it('renders columns, grid, cards, divider and cta', () => {
    const { container: col } = render(StructureFamily, { props: { block: columns } });
    expect(col.querySelector('[data-tx-block="columns"]')).toBeTruthy();

    const { container: g } = render(StructureFamily, { props: { block: grid } });
    expect(g.querySelector('[data-tx-block="grid"]')).toBeTruthy();
    expect(screen.getByText('Harbor squads')).toBeTruthy();
    expect(screen.getByText('Design')).toBeTruthy();

    const { container: c } = render(StructureFamily, { props: { block: cards } });
    expect(c.querySelector('[data-tx-block="cards"]')).toBeTruthy();
    expect(c.querySelector('a[href="https://example.com/docs"]')).toBeTruthy();

    const { container: d } = render(StructureFamily, { props: { block: divider } });
    expect(d.querySelector('[data-tx-block="divider"]')).toBeTruthy();

    const { container: a } = render(StructureFamily, { props: { block: cta } });
    expect(a.querySelector('[data-tx-block="cta"]')).toBeTruthy();
    expect(a.querySelector('a[href="mailto:hello@example.com"]')).toBeTruthy();
  });

  it('renders tabs and accordion on the texuli primitives', () => {
    const { container: t } = render(StructureFamily, { props: { block: tabs } });
    expect(t.querySelector('[data-tx-block="tabs"]')).toBeTruthy();
    expect(t.querySelector('[data-tx-tabs]')).toBeTruthy();

    const { container: acc } = render(StructureFamily, { props: { block: accordion } });
    expect(acc.querySelector('[data-tx-block="accordion"]')).toBeTruthy();
    expect(acc.querySelector('[data-tx-accordion]')).toBeTruthy();
    expect(screen.getByText('What is Harbor?')).toBeTruthy();
  });

  it('shows an inert notice for hostile input and calls oninvalid', () => {
    const issues: unknown[] = [];
    const { container } = render(StructureFamily, {
      props: {
        block: {
          type: 'cards',
          items: [{ title: `bad${String.fromCharCode(0)}`, href: 'javascript:alert(1)' }],
        },
        oninvalid: (list: FieldIssue[]) => {
          issues.push(...list);
        },
      },
    });
    expect(container.querySelector('[data-tx-block="invalid"]')).toBeTruthy();
    expect(issues.length).toBeGreaterThan(0);
  });

  it('loadStructureFamily resolves the lazy renderer', async () => {
    const mod = await loadStructureFamily();
    expect(typeof mod.default).toBe('function');
  });
});
