<script lang="ts">
/**
 * /documents-page/ collaboration: Ada's and Lin's editors side by side, two
 * replicas of the owned CRDT (`@texuli/document/collab`, ADR-010) synced
 * through the in-memory hub of `@texuli/document/sync`. Both modules load
 * after the island hydrates. "Start over" closes both sessions and
 * opens two new ones on the original draft. Each editor's panels carry the
 * person's name, so the two sets of landmarks stay unique on one page.
 */
import { onMount } from 'svelte';
import { REVIEW_DRAFT } from './sample.ts';

type CollabModule = typeof import('@texuli/pages/collab');
type SyncModule = typeof import('@texuli/document/sync');
type Session = import('@texuli/pages/collab').CollabSession;

const PEOPLE = [
  { replica: 'ada', name: 'Ada', color: 0 },
  { replica: 'lin', name: 'Lin', color: 3 },
] as const;

let collab = $state.raw<CollabModule | null>(null);
let sync: SyncModule | null = null;
let sessions = $state.raw<Session[]>([]);
let round = $state(0);
let failed = $state(false);

function open(module: CollabModule): void {
  if (!sync) return;
  for (const session of sessions) session.close();
  const hub = sync.createMemorySyncHub();
  round += 1;
  sessions = PEOPLE.map((person) =>
    module.createCollabSession({
      replica: `${person.replica}${round}`,
      document: REVIEW_DRAFT,
      author: { name: person.name, color: person.color },
      adapter: hub.adapter(),
    })
  );
}

onMount(() => {
  let live = true;
  Promise.all([import('@texuli/pages/collab'), import('@texuli/document/sync')]).then(
    ([module, syncModule]) => {
      if (!live) return;
      sync = syncModule;
      collab = module;
      open(module);
    },
    () => {
      failed = true;
    }
  );
  return () => {
    live = false;
    for (const session of sessions) session.close();
  };
});
</script>

<div class="collab" data-documents-collab="">
  <div class="collab__bar">
    <p class="collab__hint">
      Both editors are live. Select text and press Comment, or switch on Suggesting and type.
    </p>
    <button
      type="button"
      class="collab__button"
      aria-disabled={collab === null}
      onclick={() => {
        if (collab) open(collab);
      }}
    >
      Start over
    </button>
  </div>
  {#if failed}
    <p role="alert">The collaboration demo could not load. Reload the page to try again.</p>
  {:else if collab && sessions.length === 2}
    <div class="collab__panes">
      {#each sessions as session, index (session.replica)}
        {@const person = PEOPLE[index] as (typeof PEOPLE)[number]}
        <section
          class="collab__pane"
          data-documents-pane={person.replica}
          aria-label={`${person.name}’s editor`}
        >
          <h3 class="collab__name">{person.name}</h3>
          <collab.CollabEditor
            {session}
            label={`${person.name}’s copy of the draft`}
          />
        </section>
      {/each}
    </div>
  {:else}
    <p class="collab__note" data-documents-loading="">Loading the two editors…</p>
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
  .collab__hint,
  .collab__note {
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
  .collab__panes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 30rem), 1fr));
    gap: 1rem;
    align-items: start;
  }
  .collab__pane {
    display: grid;
    gap: 0.5rem;
    min-inline-size: 0;
    padding: 0.75rem;
    border: 1px dashed var(--tx-border, CanvasText);
    border-radius: 0.75rem;
    background: var(--tx-background, Canvas);
  }
  .collab__name {
    margin: 0;
    font-size: 1rem;
  }
  @media (forced-colors: active) {
    .collab__button {
      border-color: ButtonText;
    }
  }
</style>
