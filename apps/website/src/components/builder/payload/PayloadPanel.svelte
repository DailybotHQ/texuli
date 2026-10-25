<script lang="ts">
import type { CatalogTreeInput } from '@texuli/catalog/render/renderer';
import { untrack } from 'svelte';
import {
  checkPayloadText,
  describeIssue,
  type PayloadIssue,
  prettyBlueprintJson,
} from './model.ts';

/**
 * The payload panel (builder design §6): the draft as pretty canonical JSON,
 * edited as text and committed explicitly. A commit applies all of the text
 * or none of it; a refusal lists every issue with its line and column and
 * keeps the person's text.
 */
let {
  tree,
  oncommit,
}: {
  tree: CatalogTreeInput;
  /** Apply an accepted tree as one replaceAll entry; return an error message, or `null`. */
  oncommit: (next: CatalogTreeInput) => string | null;
} = $props();

// The text the draft serializes to, and the person's buffer.
let source = $state(untrack(() => prettyBlueprintJson(tree)));
let buffer = $state(untrack(() => source));
let issues = $state<readonly PayloadIssue[]>([]);
let note = $state('');
let textarea = $state<HTMLTextAreaElement | undefined>();
let dirty = $derived(buffer !== source);

// A structured edit (inspector, outline, undo) updates the text, unless the
// person has uncommitted JSON edits: those are kept, never overwritten.
$effect(() => {
  const next = prettyBlueprintJson(tree);
  untrack(() => {
    if (next === source) return;
    const clean = buffer === source;
    source = next;
    if (clean) {
      buffer = next;
      return;
    }
    note =
      'The draft changed while this JSON had uncommitted edits. Your text is kept: commit it to replace the draft, or reload the draft.';
  });
});

function commit(): void {
  issues = [];
  note = '';
  const result = checkPayloadText(buffer);
  if (!result.ok) {
    issues = result.issues;
    return;
  }
  const error = oncommit(result.tree);
  if (error) {
    issues = [{ message: error }];
    return;
  }
  const next = prettyBlueprintJson(result.tree);
  source = next;
  buffer = next;
}

function reload(): void {
  buffer = source;
  issues = [];
  note = '';
}

/** Put the caret on an issue's place in the text. */
function jump(issue: PayloadIssue): void {
  if (!issue.at || !textarea) return;
  textarea.focus();
  textarea.setSelectionRange(issue.at.offset, issue.at.offset);
}
</script>

<section class="payload" aria-labelledby="payload-heading" data-builder-payload data-builder-pane>
  <div class="payload__heading">
    <div>
      <h2 id="payload-heading">Blueprint JSON</h2>
      <p>Text edits commit explicitly, all or nothing. Refused text stays here with each issue's line.</p>
    </div>
    <div class="payload__actions">
      {#if dirty}
        <button type="button" onclick={reload}>Reload draft</button>
      {/if}
      <button type="button" onclick={commit}>Commit JSON</button>
    </div>
  </div>
  <textarea
    bind:this={textarea}
    aria-label="Blueprint JSON"
    aria-describedby={issues.length ? 'payload-issues' : undefined}
    bind:value={buffer}
    spellcheck="false"
    data-dirty={dirty || undefined}
    onkeydown={(event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        commit();
      }
    }}
  ></textarea>
  <p class="payload__status" role="status">
    {#if issues.length}
      Commit refused: {issues.length === 1 ? '1 issue' : `${issues.length} issues`}. The draft was not changed.
    {:else if note}
      {note}
    {/if}
  </p>
  {#if issues.length}
    <ul id="payload-issues" class="payload__issues" aria-label="Commit issues">
      {#each issues as issue, index (index)}
        <li>
          {#if issue.at}
            <button type="button" onclick={() => jump(issue)}>{describeIssue(issue)}</button>
          {:else}
            {describeIssue(issue)}
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .payload { min-inline-size: 0; border: 1px solid var(--tx-border, ButtonBorder); border-radius: .65rem; padding: 1rem; background: var(--tx-surface, Canvas); }
  .payload__heading { display: flex; align-items: center; justify-content: space-between; gap: .75rem; flex-wrap: wrap; }
  .payload__heading h2 { margin: 0 0 .75rem; font-size: 1.1rem; }
  .payload__heading p { margin: 0; color: var(--tx-muted-foreground, GrayText); font-size: .875rem; }
  .payload__actions { display: flex; flex-wrap: wrap; gap: .5rem; }
  .payload button, .payload textarea { font: inherit; }
  .payload button { border: 1px solid var(--tx-border, ButtonBorder); border-radius: .45rem; padding: .45rem .7rem; color: inherit; background: var(--tx-surface, Canvas); cursor: pointer; }
  .payload button:focus-visible, .payload textarea:focus-visible { outline: 3px solid var(--tx-ring, Highlight); outline-offset: 2px; }
  .payload textarea { display: block; box-sizing: border-box; inline-size: 100%; min-block-size: 18rem; margin-block-start: .8rem; border: 1px solid var(--tx-border, ButtonBorder); border-radius: .4rem; padding: .55rem; color: inherit; background: var(--tx-background, Canvas); font-family: var(--tx-font-mono, monospace); font-size: .85rem; resize: vertical; }
  .payload__status:empty { display: none; }
  .payload__status, .payload__issues { margin-block: .6rem 0; padding: .6rem; border-inline-start: .25rem solid var(--tx-warning, #9a6700); background: var(--tx-surface, Canvas); font-size: .875rem; }
  .payload__issues { display: grid; gap: .35rem; list-style: none; }
  .payload__issues button { inline-size: 100%; text-align: start; }
</style>
