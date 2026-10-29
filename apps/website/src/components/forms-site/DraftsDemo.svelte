<script lang="ts">
/**
 * /forms-page/ drafts and autosave: `SchemaForm` with `drafts` over an
 * in-page storage adapter (a `FormDraftStorage` the demo can show; a host
 * would pass `createWebStorageDrafts(localStorage)` or its server). Every
 * change schedules a save; remounting the form restores the draft and
 * announces it; a tampered draft is coerced field by field, so a value of
 * the wrong type falls back, an unknown field is dropped and a choice
 * outside the options is refused by the `option` rule on submit.
 */
import { SchemaForm } from '@texuli/forms';
import { type FormDraft, type FormDraftStorage, validateFormSchema } from '@texuli/forms/model';
import { DRAFT_KEY, DRAFT_SCHEMA, TAMPERED_DRAFT } from './schemas.ts';

const result = validateFormSchema(DRAFT_SCHEMA);
let stored = $state.raw<unknown>(null);
let saves = $state(0);
let round = $state(0);
let status = $state('No draft yet.');

const storage: FormDraftStorage = {
  load: () => stored,
  save: (_key, draft: FormDraft) => {
    stored = draft;
    saves += 1;
  },
  remove: () => {
    stored = null;
  },
};
const drafts = { storage, key: DRAFT_KEY, debounceMs: 600 };

function remount(): void {
  round += 1;
  status = stored ? 'Remounted: the saved draft was restored.' : 'Remounted with no draft.';
}

function clear(): void {
  stored = null;
  round += 1;
  status = 'Draft cleared; the form starts empty.';
}

function tamper(): void {
  stored = structuredClone(TAMPERED_DRAFT);
  round += 1;
  status =
    'A tampered draft was restored: score fell back to its default, isAdmin was dropped, and the mood “furious” is refused on submit.';
}

function shown(value: unknown): string {
  if (!value) return 'Empty';
  return JSON.stringify(
    value,
    (key, item) =>
      key !== '' && typeof item === 'string' && item.length > 60 ? `${item.slice(0, 57)}…` : item,
    2
  );
}
</script>

<div class="drafts" data-forms-drafts="">
  <div class="drafts__form">
    <div class="drafts__bar" role="group" aria-label="Draft controls">
      <button type="button" class="drafts__button" onclick={remount}>Remount the form</button>
      <button type="button" class="drafts__button" onclick={clear}>Clear the draft</button>
      <button type="button" class="drafts__button" onclick={tamper}>Restore a tampered draft</button>
    </div>
    <p class="drafts__status" data-forms-drafts-status="">{status}</p>
    {#key round}
      {#if result.ok}
        <SchemaForm form={result.form} headingLevel={3} {drafts} onSubmit={() => ({ ok: true })} />
      {:else}
        <p role="alert">The draft schema did not validate.</p>
      {/if}
    {/key}
  </div>
  <div class="drafts__side">
    <h3 class="drafts__title">What the storage holds</h3>
    <p class="drafts__hint">
      Key <code>{DRAFT_KEY}</code>; saves so far: <span data-forms-drafts-saves="">{saves}</span>.
      Files are never stored.
    </p>
    <pre class="drafts__json" aria-label="Stored draft" tabindex="0" data-forms-drafts-stored="">{shown(stored)}</pre>
  </div>
</div>

<style>
  .drafts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
    gap: 1rem;
    align-items: start;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 1rem;
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
  }
  .drafts__form,
  .drafts__side {
    display: grid;
    gap: 0.6rem;
    min-inline-size: 0;
  }
  .drafts__bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .drafts__button {
    min-block-size: 2.25rem;
    padding-inline: 0.8rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: var(--tx-background, ButtonFace);
    color: var(--tx-foreground, ButtonText);
    font: inherit;
    cursor: pointer;
  }
  .drafts__button:focus-visible,
  .drafts__json:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .drafts__status,
  .drafts__hint {
    margin: 0;
    font-size: 0.875rem;
    color: var(--tx-muted-foreground, CanvasText);
  }
  .drafts__title {
    margin: 0;
    font-size: 1rem;
  }
  .drafts__json {
    margin: 0;
    max-block-size: 22rem;
    padding: 0.75rem;
    overflow: auto;
    border-radius: 0.6rem;
    background: var(--tx-muted, Canvas);
    font-size: 0.8125rem;
  }
</style>
