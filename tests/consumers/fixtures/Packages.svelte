<script lang="ts">
/**
 * One live component from every UI package Smoke.svelte does not already
 * render (Smoke covers primitives, texuli and data). Each sits in a
 * `[data-render="<package>"]` region the spec asserts after hydration, and
 * renders in the server pass too (SvelteKit prerender, the Astro island's
 * server render). Fictional data only.
 */
import { AppearanceSwitcher } from '@texuli/astro/appearance';
import { TextBlockView } from '@texuli/blocks/text/renderers';
import { LineChart } from '@texuli/charts/cartesian';
import { type ChatMessage, ChatThread } from '@texuli/chat';
import type { TexuliDocument } from '@texuli/document/model';
import { RichTextEditor } from '@texuli/editor/editor';
import { markdownToDocument } from '@texuli/editor/markdown';
import { Image } from '@texuli/media/image';
import { PageReader } from '@texuli/pages/reader';
import { Player } from '@texuli/player';
import '@texuli/player/styles.css';
import '@texuli/slides/styles.css';
import { DeckStage } from '@texuli/slides/stage';
import { applyWorkflowOps, createWorkflow, defineNodeTypes } from '@texuli/workflows/model';
import { WorkflowViewer } from '@texuli/workflows/viewer';

const series = [
  {
    id: 'signups',
    label: 'Sign-ups',
    points: [
      { x: 'Jan', y: 120 },
      { x: 'Feb', y: 180 },
    ],
  },
];
const messages: ChatMessage[] = [
  {
    id: 'm1',
    author: { id: 'agent', name: 'Helper' },
    body: 'Consumer chat message',
    at: '2026-01-05T09:00:00Z',
  },
];
const { doc } = markdownToDocument('Consumer editor text');
const page: TexuliDocument = {
  format: 'texuli-document',
  formatVersion: 1,
  meta: { title: 'Consumer page' },
  blocks: [
    {
      id: 'p1',
      type: 'paragraph',
      content: [{ type: 'text', text: 'Consumer page text', marks: [] }],
    },
  ],
};
const registry = defineNodeTypes([
  {
    type: 'request',
    label: 'Request',
    category: 'Start',
    ports: [{ id: 'out', direction: 'out', dataType: 'any' }],
  },
  {
    type: 'end',
    label: 'End',
    category: 'Done',
    ports: [{ id: 'in', direction: 'in', dataType: 'any' }],
  },
]);
const built = applyWorkflowOps(
  createWorkflow(),
  [
    {
      op: 'addNode',
      node: { id: 'ask', type: 'request', label: 'Consumer request', position: { x: 0, y: 0 } },
    },
    { op: 'addNode', node: { id: 'done', type: 'end', label: 'Done', position: { x: 240, y: 0 } } },
    {
      op: 'connect',
      edge: { id: 'e1', from: { node: 'ask', port: 'out' }, to: { node: 'done', port: 'in' } },
    },
  ],
  { registry }
);
const graph = built.ok ? built.graph : createWorkflow();
const blueprint = {
  id: 'layout-page',
  props: { title: 'Consumer player' },
  children: [
    {
      id: 'blocks-text',
      props: { block: { type: 'text', markdown: 'Consumer **player** text.' } },
    },
  ],
};
/** A 1×1 PNG: app-authored, so the developer tier accepts it, and nothing is fetched. */
const pixel =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const deck = {
  formatVersion: 2,
  meta: { title: 'Consumer deck', locale: 'en' },
  slides: [{ id: 'opening', layout: 'title-hero', props: { title: 'Consumer deck slide' } }],
};
</script>

<div class="packages" data-tx-consumer-packages>
  <section data-render="@texuli/astro">
    <AppearanceSwitcher namespace="consumer" label="Consumer appearance" />
  </section>
  <section data-render="@texuli/blocks">
    <TextBlockView block={{ type: 'heading', level: 2, text: 'Consumer block heading' }} />
  </section>
  <section data-render="@texuli/charts">
    <LineChart title="Consumer chart" description="Sign-ups rose in February." {series} />
  </section>
  <section data-render="@texuli/chat">
    <ChatThread {messages} currentUserId="u-1" label="Consumer chat" />
  </section>
  <section data-render="@texuli/editor">
    <RichTextEditor value={doc} label="Consumer editor" />
  </section>
  <section data-render="@texuli/media">
    <Image src={pixel} trust="developer" alt="Consumer image" width={160} height={90} />
  </section>
  <section data-render="@texuli/pages">
    <PageReader document={page} />
  </section>
  <section data-render="@texuli/player">
    <Player {blueprint} label="Consumer player" />
  </section>
  <section data-render="@texuli/slides">
    <DeckStage {deck} syncHash={false} />
  </section>
  <section data-render="@texuli/workflows">
    <WorkflowViewer {graph} {registry} label="Consumer workflow" />
  </section>
</div>

<style>
  .packages {
    display: grid;
    gap: 1rem;
    padding: 1rem;
  }
  .packages > section {
    min-block-size: 2rem;
  }
</style>
