import type { TexuliDocument } from '../src/model/types.ts';

/** A document with every block type (fictional data only). */
export function everyBlock(): TexuliDocument {
  return {
    format: 'texuli-document',
    formatVersion: 1,
    meta: { title: 'Field notes', locale: 'en', authors: ['Ada Example'], tags: ['demo'] },
    page: {
      size: 'a4',
      orientation: 'portrait',
      margins: { top: 20, bottom: 20, inlineStart: 18, inlineEnd: 18 },
    },
    blocks: [
      {
        id: 'h1',
        type: 'heading',
        level: 1,
        content: [{ type: 'text', text: 'Field notes', marks: [] }],
      },
      {
        id: 'p1',
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Read the ', marks: [] },
          {
            type: 'text',
            text: 'guide',
            marks: [{ type: 'link', href: 'https://example.com/guide' }],
          },
          { type: 'text', text: ' and ', marks: [] },
          { type: 'text', text: 'ship', marks: [{ type: 'strong' }, { type: 'em' }] },
          { type: 'break' },
          { type: 'text', text: 'today.', marks: [] },
        ],
      },
      { id: 'c1', type: 'code', lang: 'ts', text: 'const x = 1;\nexport { x };' },
      {
        id: 'l1',
        type: 'list',
        kind: 'todo',
        items: [
          {
            id: 'i1',
            checked: true,
            blocks: [
              {
                id: 'i1p',
                type: 'paragraph',
                content: [{ type: 'text', text: 'Draft', marks: [] }],
              },
            ],
          },
          {
            id: 'i2',
            checked: false,
            blocks: [
              {
                id: 'i2p',
                type: 'paragraph',
                content: [{ type: 'text', text: 'Review', marks: [] }],
              },
            ],
          },
        ],
      },
      {
        id: 'q1',
        type: 'quote',
        blocks: [
          {
            id: 'q1p',
            type: 'paragraph',
            content: [{ type: 'text', text: 'Small pieces.', marks: [] }],
          },
        ],
      },
      { id: 'd1', type: 'divider' },
      { id: 'm1', type: 'media', ref: 'https://example.com/cover.png', alt: 'A cover' },
      {
        id: 'co1',
        type: 'callout',
        tone: 'info',
        title: 'Heads up',
        blocks: [
          {
            id: 'co1p',
            type: 'paragraph',
            content: [{ type: 'text', text: 'Mind the gap.', marks: [] }],
          },
        ],
      },
      {
        id: 't1',
        type: 'toggle',
        summary: [{ type: 'text', text: 'Details', marks: [] }],
        open: false,
        blocks: [
          {
            id: 't1p',
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hidden text', marks: [] }],
          },
        ],
      },
      {
        id: 'cols',
        type: 'columns',
        columns: [
          {
            id: 'col1',
            type: 'column',
            width: 6,
            blocks: [{ id: 'col1p', type: 'paragraph', content: [] }],
          },
          {
            id: 'col2',
            type: 'column',
            width: 6,
            blocks: [{ id: 'col2p', type: 'paragraph', content: [] }],
          },
        ],
      },
      { id: 'pl1', type: 'page-link', ref: 'pages/roadmap', title: 'Roadmap' },
      {
        id: 'b1',
        type: 'block',
        family: 'data',
        block: 'stat',
        props: { label: 'Uptime', value: '99.9%' },
      },
      {
        id: 'e1',
        type: 'embed',
        kind: 'component',
        inline: { id: 'badge', props: { label: 'Beta' } },
        title: 'Status',
      },
      { id: 'e2', type: 'embed', kind: 'sheet', ref: 'sheets/budget-2026', title: 'Budget' },
    ],
    annotations: {
      comments: [
        {
          id: 'th1',
          anchor: { block: 'p1', start: 0, end: 4 },
          quote: 'Read',
          status: 'open',
          messages: [{ id: 'msg1', author: 'Ada Example', body: 'Shorter?' }],
        },
      ],
    },
  };
}

/** A small deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Milliseconds `run` takes. */
export function time(run: () => void): number {
  const start = performance.now();
  run();
  return performance.now() - start;
}
