<script lang="ts">
/**
 * /canvas-page/ collaboration: Ada's and Lin's editors side by side, two
 * replicas of one canvas on the owned CRDT (`@texuli/canvas/sync` on
 * `@texuli/document/sync`, ADR-010), connected through the in-memory hub,
 * so nothing leaves the page. Moves, resizes, text and connectors merge;
 * undo is selective (it never rewinds the other person's edits). Each
 * editor publishes its selection as presence, and the list under it shows
 * who is here and what they selected (painting remote cursors inside the
 * editor is planned). Every module loads after the island hydrates.
 */
import { onMount } from 'svelte';
import { SHARED_BOARD } from './board.ts';

type EditorModule = typeof import('@texuli/canvas/editor');
type Session = import('@texuli/canvas/sync').CanvasSync;
type Connection = import('@texuli/canvas/sync').CanvasConnection;
type Controller = import('@texuli/canvas/editor').CanvasController;
type SyncModules = [typeof import('@texuli/canvas/sync'), typeof import('@texuli/document/sync')];

const PEOPLE = [
  { replica: 'ada', name: 'Ada', color: 1 },
  { replica: 'lin', name: 'Lin', color: 4 },
] as const;

interface Peer {
  session: Session;
  connection: Connection;
}

let editor = $state.raw<EditorModule | null>(null);
let modules: SyncModules | null = null;
let peers = $state.raw<Peer[]>([]);
let controllers = $state<(Controller | undefined)[]>([undefined, undefined]);
let presence = $state.raw<string[]>(['', '']);
let round = $state(0);
let failed = $state(false);

function open(): void {
  if (!modules) return;
  const [canvasSync, documentSync] = modules;
  for (const peer of peers) {
    peer.connection.close();
    peer.session.destroy();
  }
  const hub = documentSync.createMemorySyncHub();
  round += 1;
  peers = PEOPLE.map((person) => {
    const session = canvasSync.createCanvasSync({
      replica: `${person.replica}${round}`,
      canvas: SHARED_BOARD,
    });
    const connection = session.connect(hub.adapter(), { name: person.name, color: person.color });
    return { session, connection };
  });
  controllers = [undefined, undefined];
}

function describePresence(): void {
  presence = peers.map((peer) => {
    const others = peer.session.peers();
    if (others.length === 0) return 'Nobody else is here yet.';
    return others
      .map((entry) => {
        const ids = entry.selection ?? [];
        return `${entry.name} is here${ids.length > 0 ? `, selecting ${ids.join(', ')}` : ''}.`;
      })
      .join(' ');
  });
}

// Publish each editor's selection as presence.
$effect(() => {
  controllers.forEach((controller, index) => {
    const selection = controller ? [...controller.selection] : [];
    peers[index]?.connection.updatePresence({ selection });
  });
  describePresence();
});

onMount(() => {
  let live = true;
  Promise.all([
    import('@texuli/canvas/editor'),
    import('@texuli/canvas/sync'),
    import('@texuli/document/sync'),
  ]).then(
    ([editorModule, canvasSync, documentSync]) => {
      if (!live) return;
      modules = [canvasSync, documentSync];
      open();
      editor = editorModule;
    },
    () => {
      failed = true;
    }
  );
  const timer = setInterval(describePresence, 1000);
  return () => {
    live = false;
    clearInterval(timer);
    for (const peer of peers) {
      peer.connection.close();
      peer.session.destroy();
    }
  };
});
</script>

<div class="collab" data-canvas-collab="">
  <div class="collab__bar">
    <p class="collab__hint">
      Both canvases are live replicas. Move a note on one side and watch the other.
    </p>
    <button type="button" class="collab__button" onclick={open}>Start over</button>
  </div>
  {#if failed}
    <p role="alert">The collaboration demo could not load. Reload the page to try again.</p>
  {:else if editor && peers.length === PEOPLE.length}
    <div class="collab__pair">
      {#each PEOPLE as person, index (person.replica)}
        {@const peer = peers[index]}
        <div class="collab__side" data-canvas-peer={person.replica}>
          <h3 class="collab__name">{person.name}’s canvas</h3>
          {#if peer}
            {#key peer.session}
              <editor.CanvasEditor
                sync={peer.session}
                bind:controller={controllers[index]}
                minimap={false}
                labels={{
                  canvas: `${person.name}’s canvas`,
                  toolbar: `${person.name}’s canvas tools`,
                  shapeList: `${person.name}’s shapes`,
                }}
              />
            {/key}
          {/if}
          <p class="collab__presence" data-canvas-presence={person.replica}>{presence[index]}</p>
        </div>
      {/each}
    </div>
  {:else}
    <p data-canvas-collab-loading="">Loading the collaboration demo…</p>
  {/if}
</div>

<style>
  .collab {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.75rem;
    min-inline-size: 0;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 1rem;
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
  }
  .collab__bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem 1rem;
  }
  .collab__hint {
    margin: 0;
    font-size: 0.875rem;
  }
  .collab__button {
    min-block-size: 2.25rem;
    padding-inline: 0.8rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: var(--tx-background, ButtonFace);
    color: var(--tx-foreground, ButtonText);
    font: inherit;
    cursor: pointer;
  }
  .collab__button:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .collab__pair {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 26rem), 1fr));
    gap: 1rem;
  }
  .collab__side {
    display: grid;
    gap: 0.5rem;
    min-inline-size: 0;
  }
  .collab__name {
    margin: 0;
    font-size: 1rem;
  }
  .collab__presence {
    margin: 0;
    min-block-size: 1.25rem;
    font-size: 0.8125rem;
    color: var(--tx-muted-foreground, CanvasText);
  }
</style>
