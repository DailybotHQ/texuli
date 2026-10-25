<script lang="ts">
import type { CatalogTreeInput } from '@texuli/catalog/render/renderer';
import {
  PLAYER_LOADERS,
  Player,
  type PlayerDiagnosticsEvent,
  type PlayerNodeError,
} from '@texuli/player';
import { tick } from 'svelte';
import { PREVIEW_LOAD_TIMEOUT_MS, previewIssues, previewSummary } from './model.ts';

let {
  tree,
  labelOf,
  onselect,
}: {
  tree: CatalogTreeInput;
  labelOf: (path: number[]) => string;
  onselect: (path: number[]) => void;
} = $props();

let lastDiagnostics = $state<PlayerDiagnosticsEvent | null>(null);
let nodeErrors = $state<PlayerNodeError[]>([]);
const issues = $derived(previewIssues(lastDiagnostics, nodeErrors));
const summary = $derived(previewSummary(lastDiagnostics, issues.length));

// Each validation starts a fresh issue list; painter errors arrive after it.
function onDiagnostics(event: PlayerDiagnosticsEvent) {
  lastDiagnostics = event;
  nodeErrors = [];
}

function onNodeError(error: PlayerNodeError) {
  nodeErrors = [...nodeErrors, error];
}

// Selecting from an issue moves focus to the node's structure row, so the inspector is one Tab away.
async function select(path: number[]) {
  onselect(path);
  await tick();
  document.querySelector<HTMLElement>(`[data-builder-row="${path.join('.')}"]`)?.focus();
}
</script>

<!-- The real player paints the working draft: every edit is a live update (R20)
     through the blueprint prop, so loaded painters and the reader's place stay. -->
<div class="builder-preview" data-builder-preview data-builder-pane>
  <h3 id="builder-preview-heading">Preview</h3>
  <div class="builder-preview__stage">
    <Player
      blueprint={tree}
      tier="untrusted"
      status="draft"
      invalidPolicy="preview"
      label="Untrusted draft preview"
      landmarks={false}
      loaders={PLAYER_LOADERS}
      loadTimeoutMs={PREVIEW_LOAD_TIMEOUT_MS}
      {onDiagnostics}
      {onNodeError}
    />
  </div>
  <section class="builder-preview__issues" aria-labelledby="builder-issues-heading" data-builder-issues>
    <h3 id="builder-issues-heading">Draft issues</h3>
    <p class="builder-preview__summary" role="status" aria-live="polite">{summary}</p>
    {#if issues.length}
      <ul>
        {#each issues as issue (issue.key)}
          {@const path = issue.path}
          <li class="builder-preview__issue" data-severity={issue.severity} data-issue-code={issue.code}>
            <span class="builder-preview__severity">{issue.severity === 'error' ? 'Error' : 'Warning'}</span>
            <span>{issue.message}</span>
            {#if path}
              <button type="button" onclick={() => void select(path)}>
                Select {labelOf(path)}
              </button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>

<style>
  .builder-preview { display: grid; gap: .75rem; margin-block-start: 1rem; }
  .builder-preview h3 { margin: 0; font-size: 1rem; }
  .builder-preview__issues h3 { font-size: .9rem; }
  .builder-preview__stage { overflow: auto; max-inline-size: 100%; contain: layout paint; }
  .builder-preview__issues { display: grid; gap: .4rem; border-block-start: 1px solid var(--tx-border, ButtonBorder); padding-block-start: .75rem; }
  .builder-preview__summary { margin: 0; color: var(--tx-muted-foreground, GrayText); font-size: .875rem; }
  .builder-preview__issues ul { display: grid; gap: .4rem; margin: 0; padding: 0; list-style: none; }
  .builder-preview__issue { display: flex; flex-wrap: wrap; align-items: baseline; gap: .4rem; padding: .45rem .6rem; border-inline-start: .25rem solid var(--tx-destructive, #b42318); font-size: .85rem; overflow-wrap: anywhere; }
  .builder-preview__issue[data-severity='warning'] { border-inline-start-color: var(--tx-warning, #9a6700); }
  .builder-preview__severity { font-weight: 600; }
  .builder-preview__issue button { margin-inline-start: auto; }
</style>
