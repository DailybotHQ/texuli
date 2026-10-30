<!-- Lazily loaded: carry the styles with the component (Astro attaches lazily
     imported component CSS only to some pages). -->
<svelte:options css="injected" />

<script lang="ts">
/**
 * Content blocks through their lazy family renderers. The blocks are plain
 * JSON, validated by each family the way agent-written blocks are.
 */
import type { Component } from 'svelte';
import harbor from '../assets/harbor.png?inline';
import type { StageValues } from './values.ts';

type Props = { componentId: string; values: StageValues };

let { componentId }: Props = $props();

type Family = Component<{ block: unknown; mountEmbed?: unknown }>;

const LOADERS: Record<string, () => Promise<Family>> = {
  'blocks-text': async () =>
    (await (await import('@texuli/blocks/text')).loadTextFamily()).default as Family,
  'blocks-data': async () =>
    (await (await import('@texuli/blocks/data')).loadDataFamily()).default as Family,
  'blocks-diagram': async () =>
    (await (await import('@texuli/blocks/diagram')).loadDiagramFamily()).default as Family,
  'blocks-media': async () =>
    (await (await import('@texuli/blocks/media')).loadMediaFamily()).default as Family,
  'blocks-embed': async () =>
    (await (await import('@texuli/blocks/embed')).loadEmbedFamily()).default as Family,
  'blocks-structure': async () =>
    (await (await import('@texuli/blocks/structure')).loadStructureFamily()).default as Family,
  'blocks-code': async () =>
    (await (await import('@texuli/blocks/code')).loadCodeFamily()).default as Family,
  'blocks-interactive': async () =>
    (await (await import('@texuli/blocks/interactive')).loadInteractiveFamily()).default as Family,
  'blocks-map': async () =>
    (await (await import('@texuli/blocks/map')).loadMapFamily()).default as Family,
};

const BLOCKS: Record<string, readonly unknown[]> = {
  'blocks-text': [
    {
      type: 'heading',
      level: 2,
      eyebrow: 'Release 4.2',
      text: 'Quarterly update',
      subtitle: 'What changed for teams',
    },
    {
      type: 'text',
      markdown:
        'Harbor Notes now **syncs drafts** across devices. Read the [guide](https://example.com/docs/sync) or run `harbor sync`.',
    },
    {
      type: 'list',
      ordered: true,
      items: [{ text: 'Open **Settings → Sync**.' }, { text: 'Choose the devices.' }],
    },
    {
      type: 'callout',
      tone: 'info',
      title: 'Sync is on by default',
      body: 'Turn it off per workspace.',
    },
  ],
  'blocks-data': [
    {
      type: 'stat',
      items: [
        { label: 'Active seats', value: '128', delta: '+12%', tone: 'success' },
        { label: 'Median latency', value: '42 ms', tone: 'info' },
      ],
    },
    {
      type: 'table',
      caption: 'Squad scores (fictional)',
      columns: [
        { id: 'team', label: 'Team' },
        { id: 'score', label: 'Score' },
      ],
      rows: [
        { team: 'Design', score: 92 },
        { team: 'Build', score: 88 },
        { team: 'Review', score: 85 },
      ],
    },
  ],
  'blocks-diagram': [
    {
      type: 'flow',
      nodes: [
        { id: 'brief', label: 'Write brief' },
        { id: 'build', label: 'Build prototype', tone: 'info' },
        { id: 'review', label: 'Review with team', tone: 'success' },
      ],
      loopBack: true,
    },
    {
      type: 'tree',
      variant: 'org',
      nodes: [
        { id: 'lead', parentId: null, label: 'Product lead' },
        { id: 'design', parentId: 'lead', label: 'Design' },
        { id: 'eng', parentId: 'lead', label: 'Engineering' },
      ],
    },
  ],
  'blocks-media': [
    {
      type: 'figure',
      src: harbor,
      alt: 'A sailboat on a calm harbor at sunset, beside a wooden pier',
      width: 320,
      height: 180,
      caption: 'Harbor at dusk (fictional illustration).',
      credit: 'Harbor Notes design',
      fit: 'cover',
    },
  ],
  'blocks-embed': [
    {
      type: 'link-preview',
      title: 'Product guide',
      description: 'A safe preview that links out without fetching remote metadata.',
      site: 'docs.example.com',
      href: 'https://docs.example.com/guide',
    },
    {
      type: 'embed-app',
      title: 'Project status mini app',
      startLabel: 'Start preview',
      height: 'sm',
      app: { kind: 'app', name: 'status-mini', data: { status: 'On track', tasks: 12 } },
    },
  ],
  'blocks-structure': [
    {
      type: 'columns',
      columns: [
        [{ type: 'text', markdown: 'Drafts **sync** across devices.' }],
        [{ type: 'text', markdown: 'Turn sync off per workspace.' }],
      ],
    },
    {
      type: 'cta',
      actions: [{ label: 'Start a free trial', href: 'https://example.com/signup' }],
    },
  ],
  'blocks-code': [{ type: 'code', lang: 'ts', code: "const sync = await harbor.sync('drafts');" }],
  'blocks-interactive': [
    {
      type: 'checklist',
      title: 'Launch checklist',
      items: [
        { id: 'brief', label: 'Write the brief', done: true },
        { id: 'review', label: 'Review the draft' },
      ],
    },
  ],
  'blocks-map': [
    {
      type: 'map',
      label: 'North Pier depot on the Port Meridian basemap',
      basemap: 'port-meridian',
      points: [{ id: 'depot', label: 'North Pier depot', lng: -18.6, lat: -30.4 }],
    },
  ],
};

/** Host callback for embed-app blocks: builds DOM from text only. */
function mountEmbed(target: HTMLElement, app: Record<string, unknown>): () => void {
  const box = document.createElement('div');
  const title = document.createElement('p');
  title.textContent = `App: ${String(app.name ?? 'embedded app')}`;
  const data = app.data;
  const status = document.createElement('p');
  status.textContent =
    data !== null && typeof data === 'object' && 'status' in data
      ? `Status: ${String(data.status)}`
      : 'Status: ready';
  box.append(title, status);
  target.append(box);
  return () => box.remove();
}

let View = $state<Family | null>(null);
let failed = $state(false);

$effect(() => {
  const load = LOADERS[componentId];
  if (!load) return;
  let alive = true;
  load().then(
    (family) => {
      if (alive) View = family;
    },
    () => {
      if (alive) failed = true;
    }
  );
  return () => {
    alive = false;
  };
});
</script>

<div class="blocks" data-tx-blocks-stage={componentId}>
  {#if failed}
    <p role="alert">The block family failed to load.</p>
  {:else if View}
    {#each BLOCKS[componentId] ?? [] as block, index (index)}
      <View {block} {mountEmbed} />
    {/each}
  {:else}
    <p class="loading" role="status">Loading blocks…</p>
  {/if}
</div>

<style>
  .blocks {
    display: grid;
    gap: 0.75rem;
  }
  .loading {
    margin: 0;
    font-size: 0.875rem;
  }
</style>
