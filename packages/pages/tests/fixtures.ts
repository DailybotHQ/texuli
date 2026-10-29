import type { DocumentBlock, TexuliDocument } from '@texuli/document/model';

export const text = (value: string) => [{ type: 'text' as const, text: value, marks: [] }];

export const para = (id: string, value = ''): DocumentBlock => ({
  id,
  type: 'paragraph',
  content: value ? text(value) : [],
});

export function doc(blocks: DocumentBlock[], title = 'Field notes'): TexuliDocument {
  return { format: 'texuli-document', formatVersion: 1, meta: { title }, blocks };
}

/** A small page with every kind of row (fictional data only). */
export function samplePage(): TexuliDocument {
  return doc([
    { id: 'h1', type: 'heading', level: 1, content: text('Field notes') },
    para('p1', 'First paragraph'),
    para('p2', 'Second paragraph'),
    {
      id: 'co1',
      type: 'callout',
      tone: 'info',
      title: 'Heads up',
      blocks: [para('co1p', 'Inside the callout')],
    },
    {
      id: 'cols',
      type: 'columns',
      columns: [
        { id: 'col1', type: 'column', width: 6, blocks: [para('col1p', 'Left')] },
        { id: 'col2', type: 'column', width: 6, blocks: [para('col2p', 'Right')] },
      ],
    },
    { id: 'pl1', type: 'page-link', ref: 'pages/roadmap', title: 'Roadmap' },
    { id: 'd1', type: 'divider' },
  ]);
}
