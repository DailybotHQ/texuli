<script lang="ts">
import { listKeyboard } from '../../keyboard/list.ts';
import MarkdownField from './MarkdownField.svelte';
import {
  editableBlock,
  editItems,
  HEADING_LEVELS,
  itemTexts,
  linkVerdicts,
  remaining,
  setField,
  switchType,
  TEXT_FIELDS,
  TEXT_TYPE_LABELS,
  TEXT_TYPES,
  type TextBlockValue,
  type TextField,
  TONES,
  validateTextBlock,
} from './model.ts';

/**
 * Structured editor for a `blocks-text` `block` prop: a type selector and
 * one field per schema field, with live limits, parser-checked errors and
 * URL-policy verdicts for links. Markdown fields edit through the rich text
 * editor (`MarkdownField`) and still store Markdown. Values render as text;
 * nothing here is a sink. Every change hands the whole block to the host as
 * one edit.
 */
let {
  value,
  onchange,
  legend = 'Text block',
}: { value: unknown; onchange: (block: TextBlockValue) => void; legend?: string } = $props();

const uid = $props.id();
const block = $derived(editableBlock(value));
const fields = $derived(TEXT_FIELDS[block.type]);
const issues = $derived(validateTextBlock(block));
const items = $derived(itemTexts(block));

const fieldId = (name: string) => `${uid}-${name}`;
const issueFor = (name: string) => issues.find((issue) => issue.field === name)?.message;
const stringOf = (name: string) => (typeof block[name] === 'string' ? (block[name] as string) : '');
const describedBy = (name: string, extra = false) =>
  [
    `${fieldId(name)}-count`,
    issueFor(name) ? `${fieldId(name)}-issue` : '',
    extra ? `${fieldId(name)}-links` : '',
  ]
    .filter(Boolean)
    .join(' ');

function set(name: string, next: unknown) {
  onchange(setField(block, name, next));
}

function textMax(field: TextField): number {
  return 'max' in field ? field.max : 0;
}
</script>

<fieldset class="text-editor" data-tx-text-editor>
  <legend>{legend}</legend>

  <label class="text-editor__field" for={fieldId('type')}>
    <span>Block type</span>
    <select
      id={fieldId('type')}
      value={block.type}
      onchange={(event) => {
        const next = event.currentTarget.value;
        const type = TEXT_TYPES.find((candidate) => candidate === next);
        if (type) onchange(switchType(block, type));
      }}
    >
      {#each TEXT_TYPES as type (type)}<option value={type}>{TEXT_TYPE_LABELS[type]}</option>{/each}
    </select>
  </label>

  {#each fields as field (field.name)}
    {#if field.kind === 'level'}
      <fieldset class="text-editor__levels">
        <legend>{field.label}</legend>
        {#each HEADING_LEVELS as level (level)}
          <label>
            <input
              type="radio"
              name={fieldId('level')}
              value={level}
              checked={block.level === level}
              onchange={() => set('level', level)}
            />
            H{level}
          </label>
        {/each}
      </fieldset>
    {:else if field.kind === 'boolean'}
      <label class="text-editor__check">
        <input
          type="checkbox"
          checked={block[field.name] === true}
          onchange={(event) => set(field.name, event.currentTarget.checked)}
        />
        {field.label}
      </label>
    {:else if field.kind === 'tone'}
      <label class="text-editor__field" for={fieldId('tone')}>
        <span>{field.label}</span>
        <select
          id={fieldId('tone')}
          value={stringOf('tone')}
          onchange={(event) => set('tone', event.currentTarget.value || undefined)}
        >
          <option value="">Default</option>
          {#each TONES as tone (tone)}<option value={tone}>{tone}</option>{/each}
        </select>
      </label>
    {:else if field.kind === 'items'}
      <fieldset class="text-editor__items" aria-describedby={`${fieldId('items')}-count`} use:listKeyboard={{ label: 'item' }}>
        <legend>{field.label}</legend>
        <p id={`${fieldId('items')}-count`} class="text-editor__count">
          {items.length} of {field.maxItems} items
        </p>
        {#each items as item, index (index)}
          {@const name = `items.${index}`}
          {@const verdicts = linkVerdicts(item)}
          <div class="text-editor__item" data-list-item>
            <label class="text-editor__field" for={fieldId(name)}>
              <span>Item {index + 1}</span>
              <textarea
                id={fieldId(name)}
                rows="2"
                maxlength={field.max}
                value={item}
                aria-invalid={issueFor(name) ? 'true' : undefined}
                aria-describedby={describedBy(name, verdicts.length > 0)}
                oninput={(event) =>
                  onchange(editItems(block, { action: 'set', index, text: event.currentTarget.value }))}
              ></textarea>
            </label>
            <p id={`${fieldId(name)}-count`} class="text-editor__count">
              {remaining(item, field.max)} characters left
            </p>
            {#if issueFor(name)}<p id={`${fieldId(name)}-issue`} class="text-editor__issue">{issueFor(name)}</p>{/if}
            {#if verdicts.length}{@render links(name, verdicts)}{/if}
            <div class="text-editor__item-actions" role="group" aria-label={`Item ${index + 1} actions`}>
              <button type="button" data-list-control="up" aria-keyshortcuts="Alt+ArrowUp" disabled={index === 0} onclick={() => onchange(editItems(block, { action: 'move', index, step: -1 }))}>
                Move item {index + 1} up
              </button>
              <button type="button" data-list-control="down" aria-keyshortcuts="Alt+ArrowDown" disabled={index === items.length - 1} onclick={() => onchange(editItems(block, { action: 'move', index, step: 1 }))}>
                Move item {index + 1} down
              </button>
              <button type="button" data-list-control="remove" disabled={items.length <= 1} onclick={() => onchange(editItems(block, { action: 'remove', index }))}>
                Remove item {index + 1}
              </button>
            </div>
          </div>
        {/each}
        <button
          type="button"
          data-list-control="add"
          disabled={items.length >= field.maxItems}
          onclick={() => onchange(editItems(block, { action: 'add', after: items.length - 1 }))}
        >
          Add item
        </button>
        {#if issueFor('items')}<p class="text-editor__issue">{issueFor('items')}</p>{/if}
      </fieldset>
    {:else}
      {@const text = stringOf(field.name)}
      {@const verdicts = field.kind === 'markdown' ? linkVerdicts(text) : []}
      {#if field.kind === 'markdown'}
        <div class="text-editor__field">
          <span id={`${fieldId(field.name)}-label`}>{field.label}{field.required ? ' · required' : ''}</span>
          <MarkdownField
            id={fieldId(field.name)}
            labelId={`${fieldId(field.name)}-label`}
            value={text}
            max={textMax(field)}
            invalid={Boolean(issueFor(field.name))}
            describedBy={describedBy(field.name, verdicts.length > 0)}
            onchange={(markdown) => set(field.name, markdown)}
          />
        </div>
      {:else}
        <label class="text-editor__field" for={fieldId(field.name)}>
          <span>{field.label}{field.required ? ' · required' : ''}</span>
          <input
            id={fieldId(field.name)}
            type="text"
            maxlength={textMax(field)}
            value={text}
            aria-invalid={issueFor(field.name) ? 'true' : undefined}
            aria-describedby={describedBy(field.name)}
            oninput={(event) => set(field.name, event.currentTarget.value)}
          />
        </label>
      {/if}
      <p id={`${fieldId(field.name)}-count`} class="text-editor__count">
        {remaining(text, textMax(field))} characters left{field.kind === 'markdown' ? ' · inline markdown' : ''}
      </p>
      {#if issueFor(field.name)}<p id={`${fieldId(field.name)}-issue`} class="text-editor__issue">{issueFor(field.name)}</p>{/if}
      {#if verdicts.length}{@render links(field.name, verdicts)}{/if}
    {/if}
  {/each}
</fieldset>

{#snippet links(name: string, verdicts: ReturnType<typeof linkVerdicts>)}
  <ul id={`${fieldId(name)}-links`} class="text-editor__links" aria-label="Links in this field">
    {#each verdicts as verdict, index (index)}
      <li data-link-kept={verdict.kept ? 'true' : 'false'}>
        “{verdict.text}”:
        {#if verdict.kept}
          links to <code>{verdict.href}</code>
        {:else}
          refused by the URL policy; it will show as plain text
        {/if}
      </li>
    {/each}
  </ul>
{/snippet}

<style>
  .text-editor {
    display: grid;
    gap: 0.6rem;
    margin: 0;
    padding: 0.75rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
  }
  legend {
    font-weight: 600;
  }
  .text-editor__field {
    display: grid;
    gap: 0.25rem;
  }
  .text-editor input[type='text'],
  .text-editor textarea,
  .text-editor select {
    box-sizing: border-box;
    inline-size: 100%;
    padding: 0.5rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.4rem;
    font: inherit;
    color: inherit;
    background: var(--tx-background, Canvas);
  }
  .text-editor textarea {
    resize: vertical;
  }
  .text-editor :is(input, textarea, select, button):focus-visible {
    outline: 3px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .text-editor [aria-invalid='true'] {
    border-color: var(--tx-destructive, Mark);
  }
  .text-editor__levels {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin: 0;
    border: 0;
    padding: 0;
  }
  .text-editor__items {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    border: 0;
  }
  .text-editor__item {
    display: grid;
    gap: 0.3rem;
    padding-block-end: 0.5rem;
    border-block-end: 1px solid var(--tx-border, ButtonBorder);
  }
  .text-editor__item-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .text-editor button {
    font: inherit;
    font-size: 0.8125rem;
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.4rem;
    color: inherit;
    background: var(--tx-surface, Canvas);
    cursor: pointer;
  }
  .text-editor button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .text-editor__count,
  .text-editor__links {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--tx-muted-foreground, GrayText);
  }
  .text-editor__links {
    padding-inline-start: 1.1rem;
  }
  .text-editor__issue {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--tx-destructive-foreground, var(--tx-foreground, CanvasText));
    font-weight: 600;
  }
</style>
