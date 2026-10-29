<script lang="ts">
/**
 * /documents-page/ documents as agent data: the real `<Player>` at the
 * untrusted tier paints an agent's `document` blueprint (spec 0.7.0)
 * through the document host of `@texuli/pages/host`. "Apply the patch"
 * runs the agent's bounded `patchDocument` op through `applyEditOps` with
 * the host's patcher (validated at the untrusted tier), and the player
 * paints the result; "Undo" applies the exact inverse. The hostile patch is
 * refused and nothing changes. The player, the host and the catalog edit
 * ops load after the island hydrates.
 */
import type { EditOp } from '@texuli/catalog/edit';
import { onMount } from 'svelte';
import {
  DOCUMENT_PATCH,
  DOCUMENT_TREE,
  documentEnvelope,
  HOSTILE_PATCH,
  patchDocumentHost,
} from './blueprint.ts';

type PlayerModule = typeof import('@texuli/player');
type HostModule = typeof import('@texuli/pages/host');
type EditModule = typeof import('@texuli/catalog/edit');

let player = $state.raw<PlayerModule | null>(null);
let host = $state.raw<ReturnType<HostModule['createDocumentPlayerHost']> | null>(null);
let edit: EditModule | null = null;
let failed = $state(false);

let tree = $state.raw<unknown>(DOCUMENT_TREE);
let undo = $state.raw<readonly EditOp[] | null>(null);
let outcome = $state('The agent’s document, as written.');
let refused = $state('');
const blueprint = $derived(documentEnvelope(tree));

onMount(() => {
  let live = true;
  Promise.all([
    import('@texuli/player'),
    import('@texuli/pages/host'),
    import('@texuli/catalog/edit'),
  ]).then(
    ([playerModule, hostModule, editModule]) => {
      if (!live) return;
      edit = editModule;
      host = hostModule.createDocumentPlayerHost();
      player = playerModule;
    },
    () => {
      failed = true;
    }
  );
  return () => {
    live = false;
  };
});

/** Applies `ops` all or none; returns their inverse, or `null` when refused. */
function run(ops: readonly EditOp[], done: string): readonly EditOp[] | null {
  if (!edit) return null;
  const result = edit.applyEditOps(tree as never, ops, { patchDocument: patchDocumentHost });
  if (!result.ok) {
    refused = `Refused (${result.error.code}): ${result.error.message} Nothing changed.`;
    return null;
  }
  refused = '';
  tree = result.tree;
  outcome = done;
  return result.inverse;
}

function applyPatch(): void {
  if (undo) return;
  undo = run([DOCUMENT_PATCH], 'Patched: five operations applied, all or none.');
}

function undoPatch(): void {
  if (undo && run(undo, 'Undone: the inverse patch restored the document exactly.')) undo = null;
}

function tryHostile(): void {
  run([HOSTILE_PATCH], outcome);
}
</script>

<div class="agent-doc" data-documents-agent="">
  <div class="agent-doc__bar" role="group" aria-label="Patch the agent document">
    <button
      type="button"
      class="agent-doc__button"
      aria-disabled={player === null || undo !== null}
      onclick={applyPatch}
    >
      Apply the patch
    </button>
    <button
      type="button"
      class="agent-doc__button"
      aria-disabled={undo === null}
      onclick={undoPatch}
    >
      Undo the patch
    </button>
    <button
      type="button"
      class="agent-doc__button"
      aria-disabled={player === null}
      onclick={tryHostile}
    >
      Send a hostile patch
    </button>
  </div>
  <div class="agent-doc__status" role="status" data-documents-agent-status="">
    <p>{outcome}</p>
    {#if refused}
      <p class="agent-doc__refused" data-documents-agent-refused="">{refused}</p>
    {/if}
  </div>
  <div class="agent-doc__stage" data-documents-agent-stage="">
    {#if failed}
      <p role="alert">The player could not load. Reload the page to try again.</p>
    {:else if player && host}
      <player.Player
        {blueprint}
        tier="untrusted"
        status="draft"
        label="Agent document (untrusted)"
        landmarks={false}
        loadTimeoutMs={8000}
        documentHost={host}
      />
    {:else}
      <p data-documents-loading="">Loading the player…</p>
    {/if}
  </div>
</div>

<style>
  .agent-doc {
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
  .agent-doc__bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .agent-doc__button {
    min-block-size: 2.25rem;
    padding-inline: 0.8rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: var(--tx-background, ButtonFace);
    color: var(--tx-foreground, ButtonText);
    font: inherit;
    cursor: pointer;
  }
  .agent-doc__button:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .agent-doc__button[aria-disabled='true'] {
    cursor: not-allowed;
    opacity: 0.7;
  }
  .agent-doc__status {
    font-size: 0.875rem;
  }
  .agent-doc__status p {
    margin: 0;
  }
  .agent-doc__refused {
    margin-block-start: 0.35rem;
    padding: 0.5rem 0.75rem;
    border-inline-start: 4px solid var(--tx-danger, CanvasText);
    border-radius: 0.4rem;
    background: var(--tx-danger-soft, Canvas);
    color: var(--tx-danger-soft-foreground, CanvasText);
    overflow-wrap: anywhere;
  }
  .agent-doc__stage {
    min-block-size: 18rem;
    min-inline-size: 0;
    padding: 0.75rem;
    border: 1px dashed var(--tx-border, CanvasText);
    border-radius: 0.75rem;
    background: var(--tx-background, Canvas);
  }
  @media (forced-colors: active) {
    .agent-doc__button {
      border-color: ButtonText;
    }
    .agent-doc__button[aria-disabled='true'] {
      color: GrayText;
    }
  }
</style>
