<script lang="ts">
// `@texuli/pages` is not a fixture-app dependency (adding one needs the
// lockfile owner): vite.config.ts aliases its export map.
import type { DocumentBlock, TexuliDocument } from '@texuli/document/model';
import type { PagedLayout } from '@texuli/document/paged';
import { PagedView } from '@texuli/pages/paged';

let { size = 'a4' }: { size?: 'a4' | 'letter' } = $props();
// The page size is chosen once, at mount, from the URL.
const pageSize = (() => size)();

const text = (value: string) => [{ type: 'text' as const, text: value, marks: [] }];
const sentence =
  'Harbor teams ship small changes every day, and each change is reviewed, tested and released behind a flag before it reaches everyone. ';

const blocks: DocumentBlock[] = [
  { id: 'title', type: 'heading', level: 1, content: text('Quarterly field report') },
  {
    id: 'intro',
    type: 'paragraph',
    content: [
      { type: 'text', text: 'A fictional report for the paged view. Read the ', marks: [] },
      { type: 'text', text: 'guide', marks: [{ type: 'link', href: 'https://example.com/guide' }] },
      { type: 'text', text: ' for details.', marks: [] },
    ],
  },
];
for (let section = 1; section <= 4; section += 1) {
  blocks.push({
    id: `h${section}`,
    type: 'heading',
    level: 2,
    content: text(`Section ${section}`),
  });
  for (let p = 1; p <= 4; p += 1) {
    blocks.push({
      id: `s${section}p${p}`,
      type: 'paragraph',
      content: text(sentence.repeat(3 + ((section + p) % 4))),
    });
  }
  // A paragraph longer than the room left on any page: it always splits.
  if (section === 3)
    blocks.push({ id: 'long', type: 'paragraph', content: text(sentence.repeat(30)) });
  blocks.push({
    id: `l${section}`,
    type: 'list',
    kind: 'bullet',
    items: [1, 2, 3].map((n) => ({
      id: `l${section}i${n}`,
      blocks: [
        {
          id: `l${section}i${n}p`,
          type: 'paragraph' as const,
          content: text(`Checklist item ${n}`),
        },
      ],
    })),
  });
}
blocks.push({
  id: 'note',
  type: 'callout',
  tone: 'info',
  title: 'Appendix',
  blocks: [
    { id: 'notep', type: 'paragraph', content: text('The appendix starts on its own page.') },
  ],
});
blocks.push({
  id: 'code',
  type: 'code',
  lang: 'ts',
  text: 'export const pages = layoutDocument(doc, measure);',
});

const report: TexuliDocument = {
  format: 'texuli-document',
  formatVersion: 1,
  meta: { title: 'Quarterly field report', locale: 'en' },
  page: {
    size: pageSize,
    orientation: 'portrait',
    margins: { top: 20, bottom: 20, inlineStart: 20, inlineEnd: 20 },
    header: { start: '{title}', end: 'Fictional' },
    footer: { center: 'Page {page} of {pages}' },
    breaks: ['note'],
  },
  blocks,
};

let layout = $state.raw<PagedLayout | null>(null);
(window as unknown as { txPaged: unknown }).txPaged = {
  pages: () => layout?.pages.length ?? 0,
  pageOf: (id: string) => layout?.pages.find((p) => p.slices.some((s) => s.id === id))?.number ?? 0,
  split: () => layout?.pages.some((p) => p.slices.some((s) => s.continues)) ?? false,
};
</script>

<PagedView document={report} onLayout={(next) => (layout = next)} />
