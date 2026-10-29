<script lang="ts">
// `@texuli/pages` is not a fixture-app dependency (adding one needs the
// lockfile owner): vite.config.ts aliases its export map.
import type { TexuliDocument } from '@texuli/document/model';
import { DEFAULT_COMPONENT_EMBEDS, PageEditor, type PagesEditor } from '@texuli/pages/editor';

const text = (value: string) => [{ type: 'text' as const, text: value, marks: [] }];
const donut = DEFAULT_COMPONENT_EMBEDS.find((option) => option.id === 'charts-donut')?.props ?? {};

const initial: TexuliDocument = {
  format: 'texuli-document',
  formatVersion: 1,
  meta: { title: 'Field notes', locale: 'en' },
  blocks: [
    { id: 'h1', type: 'heading', level: 1, content: text('Field notes') },
    { id: 'p1', type: 'paragraph', content: text('Alpha paragraph') },
    { id: 'p2', type: 'paragraph', content: text('Beta paragraph') },
    { id: 'p3', type: 'paragraph', content: [] },
    {
      id: 'co1',
      type: 'callout',
      tone: 'info',
      title: 'Heads up',
      blocks: [{ id: 'co1p', type: 'paragraph', content: text('Inside the callout') }],
    },
    {
      id: 'cols',
      type: 'columns',
      columns: [
        {
          id: 'col1',
          type: 'column',
          width: 6,
          blocks: [{ id: 'c1p', type: 'paragraph', content: text('Left column') }],
        },
        {
          id: 'col2',
          type: 'column',
          width: 6,
          blocks: [{ id: 'c2p', type: 'paragraph', content: text('Right column') }],
        },
      ],
    },
    { id: 'pl1', type: 'page-link', ref: 'pages/roadmap', title: 'Roadmap' },
    {
      id: 'chart',
      type: 'embed',
      kind: 'component',
      title: 'Tickets',
      inline: { id: 'charts-donut', props: donut },
    },
    {
      id: 'bad',
      type: 'embed',
      kind: 'component',
      title: 'Unknown',
      inline: { id: 'no-such-component' },
    },
    { id: 'd1', type: 'divider' },
  ],
};

let doc = $state.raw(initial);
let editor = $state<PagesEditor>();
const navigated: string[] = [];

// Read by tests/e2e/pages-editor.spec.ts.
(window as unknown as { txPages: object }).txPages = {
  ids: () => doc.blocks.map((block) => block.id),
  doc: () => doc,
  log: () => editor?.log().length ?? 0,
  navigated: () => [...navigated],
};
</script>

<PageEditor
  document={doc}
  bind:editor
  onChange={(next) => (doc = next)}
  trail={[{ ref: 'pages/home', title: 'Home' }]}
  onNavigate={(ref) => navigated.push(ref)}
  createPage={() => ({ ref: 'pages/child', title: 'Child page' })}
/>
