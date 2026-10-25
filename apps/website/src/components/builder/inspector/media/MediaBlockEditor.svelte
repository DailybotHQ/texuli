<script lang="ts">
import { listKeyboard } from '../../keyboard/list.ts';
import {
  COLUMNS,
  editableMediaBlock,
  editGallery,
  FITS,
  GALLERY_ITEM_FIELDS,
  MAX_DIMENSION,
  MAX_GALLERY_ITEMS,
  MEDIA_FIELDS,
  MEDIA_TYPE_LABELS,
  MEDIA_TYPES,
  type MediaBlockValue,
  type MediaField,
  setRecordField,
  switchMediaType,
  validateMediaBlock,
} from './model.ts';
import SourcePicker from './SourcePicker.svelte';

/**
 * Structured editor for a `blocks-media` `block` prop: a type selector and
 * one control per field the media family parser reads, with a source picker
 * for every image or video source. The parser judges the whole block and
 * stops at its first problem, which is shown at the field it names. Values
 * render as text; nothing here is a sink.
 */
let { value, onchange }: { value: unknown; onchange: (block: MediaBlockValue) => void } = $props();

const uid = $props.id();
const block = $derived(editableMediaBlock(value));
const issues = $derived(validateMediaBlock(block));
const items = $derived(
  Array.isArray(block.items)
    ? (block.items as unknown[]).map((item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? (item as Record<string, unknown>)
          : {}
      )
    : []
);
const issueAt = (key: string) => issues.find((issue) => issue.field === key)?.message;
/** Issues no field shows (a wrong type, a non-object item): listed at the top. */
const unplaced = $derived(issues.filter((issue) => !placed(issue.field)));

function placed(key: string): boolean {
  const known = new Set<string>();
  for (const field of MEDIA_FIELDS[block.type]) known.add(field.name);
  items.forEach((_, index) => {
    for (const field of GALLERY_ITEM_FIELDS) known.add(`items.${index}.${field.name}`);
  });
  return known.has(key);
}
</script>

{#snippet fieldControl(
  field: MediaField,
  record: Record<string, unknown>,
  key: string,
  set: (next: Record<string, unknown>) => void
)}
  {@const id = `${uid}-${key.replaceAll('.', '-')}`}
  {@const issue = issueAt(key)}
  {@const current = record[field.name]}
  {#if field.kind === 'source'}
    <SourcePicker
      media={field.media}
      label={field.label}
      value={current}
      required={field.required}
      {issue}
      onchange={(next) => set(setRecordField(record, field, next))}
    />
  {:else if field.kind === 'boolean'}
    <label class="media-editor__check" data-media-field={key}>
      <input
        type="checkbox"
        checked={current === true}
        aria-invalid={issue ? 'true' : undefined}
        aria-describedby={issue ? `${id}-issue` : undefined}
        onchange={(event) => set(setRecordField(record, field, event.currentTarget.checked))}
      />
      {field.label}
    </label>
    {#if issue}<p id={`${id}-issue`} class="media-editor__issue">{issue}</p>{/if}
  {:else}
    <div class="media-editor__field" data-media-field={key}>
      <label for={id}>{field.label}{field.required ? ' · required' : ''}</label>
      {#if field.kind === 'plain'}
        <input
          {id}
          type="text"
          maxlength={field.max}
          value={typeof current === 'string' ? current : ''}
          aria-invalid={issue ? 'true' : undefined}
          aria-describedby={issue ? `${id}-issue` : undefined}
          oninput={(event) => set(setRecordField(record, field, event.currentTarget.value))}
        />
      {:else if field.kind === 'dimension'}
        <input
          {id}
          type="number"
          min="1"
          max={MAX_DIMENSION}
          step="1"
          value={typeof current === 'number' ? current : ''}
          aria-invalid={issue ? 'true' : undefined}
          aria-describedby={issue ? `${id}-issue` : undefined}
          oninput={(event) => {
            const raw = event.currentTarget.value;
            if (raw === '' && event.currentTarget.validity.badInput) return;
            set(setRecordField(record, field, raw === '' ? undefined : Number(raw)));
          }}
        />
      {:else if field.kind === 'fit'}
        <select
          {id}
          value={typeof current === 'string' ? current : ''}
          onchange={(event) => set(setRecordField(record, field, event.currentTarget.value || undefined))}
        >
          <option value="">Default</option>
          {#each FITS as fit (fit)}<option value={fit}>{fit}</option>{/each}
        </select>
      {:else if field.kind === 'columns'}
        <select
          {id}
          value={typeof current === 'number' ? String(current) : ''}
          onchange={(event) => {
            const raw = event.currentTarget.value;
            set(setRecordField(record, field, raw === '' ? undefined : Number(raw)));
          }}
        >
          <option value="">Default</option>
          {#each COLUMNS as count (count)}<option value={String(count)}>{count}</option>{/each}
        </select>
      {/if}
      {#if issue}<p id={`${id}-issue`} class="media-editor__issue">{issue}</p>{/if}
    </div>
  {/if}
{/snippet}

<fieldset class="media-editor" data-tx-media-editor>
  <legend>Media block</legend>
  <div class="media-editor__field">
    <label for={`${uid}-type`}>Block type</label>
    <select
      id={`${uid}-type`}
      value={block.type}
      onchange={(event) => {
        const next = MEDIA_TYPES.find((type) => type === event.currentTarget.value);
        if (next) onchange(switchMediaType(block, next));
      }}
    >
      {#each MEDIA_TYPES as type (type)}<option value={type}>{MEDIA_TYPE_LABELS[type]}</option>{/each}
    </select>
  </div>

  {#each unplaced as issue (issue.field)}
    <p class="media-editor__issue" data-media-field={issue.field}>{issue.message}</p>
  {/each}

  {#each MEDIA_FIELDS[block.type] as field (field.name)}
    {#if field.kind === 'items'}
      <fieldset class="media-editor__items" use:listKeyboard={{ label: 'image' }}>
        <legend>{field.label} ({items.length} of {MAX_GALLERY_ITEMS})</legend>
        {#if issueAt('items')}<p class="media-editor__issue">{issueAt('items')}</p>{/if}
        {#each items as item, index (index)}
          <fieldset class="media-editor__item" data-list-item>
            <legend>Image {index + 1}</legend>
            {#each GALLERY_ITEM_FIELDS as itemField (itemField.name)}
              {@render fieldControl(itemField, item, `items.${index}.${itemField.name}`, (next) =>
                onchange(editGallery(block, { action: 'set', index, item: next }))
              )}
            {/each}
            <div class="media-editor__tools">
              <button type="button" data-list-control="up" aria-keyshortcuts="Alt+ArrowUp" disabled={index === 0} onclick={() => onchange(editGallery(block, { action: 'move', index, step: -1 }))}>Move image {index + 1} up</button>
              <button type="button" data-list-control="down" aria-keyshortcuts="Alt+ArrowDown" disabled={index === items.length - 1} onclick={() => onchange(editGallery(block, { action: 'move', index, step: 1 }))}>Move image {index + 1} down</button>
              <button type="button" data-list-control="remove" disabled={items.length <= 1} onclick={() => onchange(editGallery(block, { action: 'remove', index }))}>Remove image {index + 1}</button>
            </div>
          </fieldset>
        {/each}
        <button type="button" data-list-control="add" disabled={items.length >= MAX_GALLERY_ITEMS} onclick={() => onchange(editGallery(block, { action: 'add' }))}>Add image</button>
      </fieldset>
    {:else}
      {@render fieldControl(field, block, field.name, (next) => onchange(next as MediaBlockValue))}
    {/if}
  {/each}
  <p class="media-editor__status">
    {issues.length ? 'The block schema refuses this block; the player shows a placeholder until it is fixed.' : 'The block schema accepts this block.'}
  </p>
</fieldset>

<style>
  .media-editor,
  .media-editor__items,
  .media-editor__item {
    display: grid;
    gap: 0.55rem;
    margin: 0;
    padding: 0.5rem 0.65rem 0.65rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.45rem;
    min-inline-size: 0;
  }
  .media-editor__field {
    display: grid;
    gap: 0.25rem;
  }
  .media-editor__field :is(input, select) {
    box-sizing: border-box;
    inline-size: 100%;
    padding: 0.45rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.4rem;
    font: inherit;
    color: inherit;
    background: var(--tx-background, Canvas);
  }
  .media-editor [aria-invalid='true'] {
    border-color: var(--tx-destructive, Mark);
  }
  .media-editor__check {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .media-editor__tools {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .media-editor button {
    justify-self: start;
    font: inherit;
    font-size: 0.8125rem;
    padding: 0.3rem 0.55rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.4rem;
    color: inherit;
    background: var(--tx-surface, Canvas);
    cursor: pointer;
  }
  .media-editor button:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
  .media-editor__issue,
  .media-editor__status {
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 600;
  }
  .media-editor :is(input, select, button):focus-visible {
    outline: 3px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
</style>
