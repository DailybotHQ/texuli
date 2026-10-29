<script lang="ts">
// Two collaborative editors on one in-memory hub. `@texuli/pages` and
// `@texuli/document` are not fixture-app dependencies (adding one needs the
// lockfile owner): vite.config.ts aliases their export maps.
import type { TexuliDocument } from '@texuli/document/model';
import { createMemorySyncHub } from '@texuli/document/sync';
import { onMount } from 'svelte';

const text = (value: string) => [{ type: 'text' as const, text: value, marks: [] }];

const initial: TexuliDocument = {
  format: 'texuli-document',
  formatVersion: 1,
  meta: { title: 'Field notes', locale: 'en' },
  blocks: [
    { id: 'h1', type: 'heading', level: 1, content: text('Field notes') },
    { id: 'p1', type: 'paragraph', content: text('Alpha paragraph') },
    { id: 'p2', type: 'paragraph', content: text('Beta paragraph') },
    {
      id: 'l1',
      type: 'list',
      kind: 'bullet',
      items: [
        { id: 'i1', blocks: [{ id: 'ip1', type: 'paragraph', content: text('First item') }] },
      ],
    },
  ],
};

const collab = import('@texuli/pages/collab');
const hub = createMemorySyncHub();
type Session = import('@texuli/pages/collab').CollabSession;
let sessions = $state.raw<Session[]>([]);

onMount(() => {
  let live = true;
  collab.then(({ createCollabSession }) => {
    if (!live) return;
    sessions = [
      createCollabSession({
        replica: 'ada',
        document: initial,
        author: { name: 'Ada', color: 0 },
        adapter: hub.adapter(),
      }),
      createCollabSession({
        replica: 'lin',
        document: initial,
        author: { name: 'Lin', color: 3 },
        adapter: hub.adapter(),
      }),
    ];
    const plain = (i: number, id: string) => {
      const stack = [...(sessions[i]?.document.blocks ?? [])] as unknown as Record<
        string,
        unknown
      >[];
      while (stack.length > 0) {
        const node = stack.pop() as Record<string, unknown>;
        if (node.id === id)
          return ((node.content ?? []) as { type: string; text?: string }[])
            .map((part) => (part.type === 'break' ? '\n' : part.text))
            .join('');
        for (const key of ['blocks', 'items', 'columns'])
          if (Array.isArray(node[key])) stack.push(...(node[key] as Record<string, unknown>[]));
      }
      return null;
    };
    // Read by tests/e2e/pages-collab.spec.ts.
    (window as unknown as { txCollab: object }).txCollab = {
      doc: (i: number) => JSON.stringify(sessions[i]?.document),
      plain,
      threads: (i: number) => sessions[i]?.threads.length ?? 0,
      suggestions: (i: number) => sessions[i]?.suggestions.length ?? 0,
      versions: (i: number) => sessions[i]?.versions.length ?? 0,
      highlights: (name: string) =>
        (globalThis as { CSS?: { highlights?: Map<string, Set<unknown>> } }).CSS?.highlights?.get(
          name
        )?.size ?? 0,
    };
    const status = document.getElementById('pages-status');
    if (status) status.textContent = 'Ready';
  });
  return () => {
    live = false;
    for (const session of sessions) session.close();
  };
});
</script>

{#await collab then { CollabEditor }}
  <div class="fixture-collab">
    {#each sessions as session, i (session.replica)}
      <section class="fixture-collab__pane" data-pane={session.replica} aria-label={i === 0 ? 'Ada’s editor' : 'Lin’s editor'}>
        <CollabEditor
          {session}
          label={i === 0 ? 'Ada’s document' : 'Lin’s document'}
          collabLabels={{ region: i === 0 ? 'Ada’s review' : 'Lin’s review' }}
          motion={false}
        />
      </section>
    {/each}
  </div>
{/await}

<style>
  .fixture-collab {
    display: grid;
    gap: 2rem;
  }
</style>
