<script lang="ts">
import type { ChartSchemaDefinitions, ChartValueSchema } from '@texuli/charts/schemas';
import type { Snippet } from 'svelte';
import { listKeyboard } from '../../keyboard/list.ts';
import {
  editList,
  isPlainObject,
  issuesAt,
  type ListEdit,
  MAX_DEPTH,
  matchVariant,
  nextUniqueItem,
  type Path,
  resolve,
  type StructIssue,
  sampleValue,
  showRaw,
  unknownKeys,
  variantLabel,
  withKey,
} from './model.ts';
import StructNode from './StructNode.svelte';

/**
 * One value in a structured prop, edited through closed controls chosen by
 * its schema: text, number, switch and select for leaves; fieldsets for
 * objects, lists, tuples, records and unions. There is no free JSON here.
 * A default is shown as a placeholder and never written. `onchange(undefined)`
 * removes the value from its parent.
 */
let {
  schema,
  value,
  defs,
  issues,
  path,
  label,
  description = '',
  required = false,
  fallback,
  depth = 0,
  actions,
  onchange,
}: {
  schema: ChartValueSchema;
  value: unknown;
  defs: ChartSchemaDefinitions;
  /** Every issue of the whole prop; this node shows the ones at its path. */
  issues: readonly StructIssue[];
  path: Path;
  label: string;
  description?: string;
  required?: boolean;
  fallback?: unknown;
  depth?: number;
  /** Item controls (move, remove) from the parent list. */
  actions?: Snippet;
  onchange: (next: unknown) => void;
} = $props();

const uid = $props.id();
const node = $derived(resolve(schema, defs));
/** Nullable and union nodes hand their path to the inner node, which shows its issues. */
const delegates = $derived(
  (node.kind === 'nullable' && value !== null && value !== undefined) ||
    (node.kind === 'union' &&
      value !== undefined &&
      matchVariant(node.variants, value, defs) !== -1)
);
const own = $derived(delegates ? [] : issuesAt(issues, path));
const present = $derived(value !== undefined);
const hint = $derived(
  [
    description,
    fallback !== undefined ? `Default: ${showRaw(fallback)}. A default is not saved.` : '',
  ]
    .filter(Boolean)
    .join(' ')
);
const describedBy = $derived(
  [hint ? `${uid}-hint` : '', own.length ? `${uid}-issues` : ''].filter(Boolean).join(' ') ||
    undefined
);
const invalid = $derived(own.length > 0 ? 'true' : undefined);
const leaf = $derived(
  node.kind === 'string' ||
    node.kind === 'number' ||
    node.kind === 'boolean' ||
    node.kind === 'enum'
);
/** The value has the wrong shape for this container: offer a clean replacement. */
const misfit = $derived(
  present &&
    ((node.kind === 'object' && !isPlainObject(value)) ||
      (node.kind === 'record' && !isPlainObject(value)) ||
      ((node.kind === 'array' || node.kind === 'tuple') && !Array.isArray(value)))
);
let typed = $state('');

function sample(of: ChartValueSchema): unknown {
  return sampleValue(of, defs);
}

function list(edit: ListEdit) {
  onchange(editList(value, edit));
}

function onnumber(event: Event & { currentTarget: HTMLInputElement }) {
  const element = event.currentTarget;
  if (element.value === '' && element.validity.badInput) return;
  typed = '';
  if (element.value.trim() === '') return onchange(undefined);
  const next = Number(element.value);
  if (Number.isFinite(next)) onchange(next);
  else typed = 'Enter a finite number.';
}

function onnumberblur(event: FocusEvent & { currentTarget: HTMLInputElement }) {
  if (event.currentTarget.validity.badInput) typed = 'Enter a finite number.';
}

function renameKey(from: string, to: string) {
  const base = isPlainObject(value) ? value : {};
  if (to === from || to === '' || Object.hasOwn(base, to)) return;
  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(base)) next[key === from ? to : key] = item;
  onchange(next);
}

function freeKey(base: Record<string, unknown>): string {
  let index = Object.keys(base).length + 1;
  while (Object.hasOwn(base, `key-${index}`)) index += 1;
  return `key-${index}`;
}
</script>

{#snippet notes()}
  {#if hint}<p id={`${uid}-hint`} class="struct__hint">{hint}</p>{/if}
  {#if own.length || typed}
    <ul id={`${uid}-issues`} class="struct__issues">
      {#if typed}<li>{typed}</li>{/if}
      {#each own as issue, index (index)}<li>{issue.message}</li>{/each}
    </ul>
  {/if}
{/snippet}

{#snippet clear(text: string)}
  <button type="button" class="struct__button" onclick={() => onchange(undefined)}>{text}</button>
{/snippet}

{#if depth > MAX_DEPTH}
  <p class="struct__hint" data-struct-path={path.join('.')}>
    {label}: nested more than {MAX_DEPTH} levels deep; edit it in the payload panel.
  </p>
{:else if leaf}
  <div class="struct__leaf" data-struct-path={path.join('.')} data-kind={node.kind}>
    <div class="struct__row">
      {#if node.kind === 'boolean'}
        <label class="struct__switch">
          <input
            type="checkbox"
            role="switch"
            checked={value === true}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            onchange={(event) => onchange(event.currentTarget.checked)}
          />
          <span>{label}{required ? ' · required' : ''}</span>
        </label>
      {:else}
        <label class="struct__label" for={`${uid}-input`}>{label}{required ? ' · required' : ''}</label>
        {#if node.kind === 'enum'}
          {@const index = node.enumValues.indexOf(value as string | number | boolean)}
          <select
            id={`${uid}-input`}
            class="struct__input"
            value={index === -1 ? '' : String(index)}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            onchange={(event) => {
              const raw = event.currentTarget.value;
              onchange(raw === '' ? undefined : node.enumValues[Number(raw)]);
            }}
          >
            <option value="" disabled={required}>
              {required ? 'Choose…' : fallback !== undefined ? `Default (${showRaw(fallback)})` : 'Not set'}
            </option>
            {#each node.enumValues as option, optionIndex (optionIndex)}
              <option value={String(optionIndex)}>{String(option)}</option>
            {/each}
          </select>
        {:else if node.kind === 'number'}
          <input
            id={`${uid}-input`}
            class="struct__input"
            type="number"
            inputmode="decimal"
            step="any"
            value={typeof value === 'number' && Number.isFinite(value) ? value : ''}
            placeholder={fallback === undefined ? '' : String(fallback)}
            aria-invalid={invalid || (typed ? 'true' : undefined)}
            aria-describedby={describedBy}
            oninput={onnumber}
            onblur={onnumberblur}
          />
        {:else}
          <input
            id={`${uid}-input`}
            class="struct__input"
            type="text"
            value={typeof value === 'string' ? value : ''}
            placeholder={typeof fallback === 'string' ? fallback : ''}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            oninput={(event) => {
              const raw = event.currentTarget.value;
              onchange(raw === '' && !required ? undefined : raw);
            }}
          />
        {/if}
      {/if}
      {@render actions?.()}
    </div>
    {@render notes()}
    {#if present && own.length && typeof value !== 'string' && typeof value !== 'number'}
      <p class="struct__hint">Stored value: <code>{showRaw(value)}</code></p>
    {/if}
    {#if present && !required && node.kind === 'boolean'}{@render clear(`Reset ${label}`)}{/if}
  </div>
{:else}
  <fieldset class="struct__group" data-struct-path={path.join('.')} data-kind={node.kind} aria-describedby={describedBy}>
    <legend class="struct__legend">{label}{required ? ' · required' : ''}</legend>
    {#if actions}<div class="struct__row">{@render actions()}</div>{/if}
    {@render notes()}
    {#if !present}
      <button type="button" class="struct__button" onclick={() => onchange(sample(node))}>Add {label}</button>
    {:else if misfit}
      <p class="struct__hint">Stored value: <code>{showRaw(value)}</code></p>
      <button type="button" class="struct__button" onclick={() => onchange(sample(node))}>
        Replace {label} with a valid empty value
      </button>
    {:else if node.kind === 'nullable'}
      <label class="struct__switch">
        <input
          type="checkbox"
          role="switch"
          checked={value === null}
          onchange={(event) => onchange(event.currentTarget.checked ? null : sample(node.value))}
        />
        <span>No value (null)</span>
      </label>
      {#if value !== null}
        <StructNode schema={node.value} {value} {defs} {issues} {path} label={`${label} value`} depth={depth + 1} {onchange} />
      {/if}
    {:else if node.kind === 'union'}
      {@const variant = matchVariant(node.variants, value, defs)}
      <label class="struct__label" for={`${uid}-variant`}>{label} shape</label>
      <select
        id={`${uid}-variant`}
        class="struct__input"
        value={variant === -1 ? '' : String(variant)}
        onchange={(event) => {
          const chosen = node.variants[Number(event.currentTarget.value)];
          if (chosen) onchange(sample(chosen));
        }}
      >
        {#if variant === -1}<option value="" disabled>Unrecognized shape</option>{/if}
        {#each node.variants as option, optionIndex (optionIndex)}
          <option value={String(optionIndex)}>{variantLabel(option, optionIndex)}</option>
        {/each}
      </select>
      {#if variant === -1}
        <p class="struct__hint">Stored value: <code>{showRaw(value)}</code></p>
      {:else}
        <StructNode
          schema={node.variants[variant] as ChartValueSchema}
          {value}
          {defs}
          {issues}
          {path}
          label={`${label} (${variantLabel(node.variants[variant] as ChartValueSchema, variant)})`}
          depth={depth + 1}
          {onchange}
        />
      {/if}
    {:else if node.kind === 'object' && isPlainObject(value)}
      {@const fields = node.properties}
      {#each fields as field (field.name)}
        {@const child = value[field.name]}
        {#snippet removeField()}
          {#if child !== undefined && !field.required}
            <button
              type="button"
              class="struct__button"
              onclick={() => onchange(withKey(value, field.name, undefined))}
            >Remove {field.label}</button>
          {/if}
        {/snippet}
        <StructNode
          schema={field}
          value={child}
          {defs}
          {issues}
          path={[...path, field.name]}
          label={field.label}
          description={field.description}
          required={field.required}
          fallback={field.default}
          depth={depth + 1}
          actions={removeField}
          onchange={(next) => onchange(withKey(value, field.name, next))}
        />
      {/each}
      {#if node.additionalProperties}
        {@const extra = node.additionalProperties}
        {#each Object.keys(value).filter((key) => !fields.some((field) => field.name === key)) as key (key)}
          {#snippet removeExtra()}
            <button type="button" class="struct__button" onclick={() => onchange(withKey(value, key, undefined))}>Remove {key}</button>
          {/snippet}
          <StructNode schema={extra} value={value[key]} {defs} {issues} path={[...path, key]} label={key} depth={depth + 1} actions={removeExtra} onchange={(next) => onchange(withKey(value, key, next))} />
        {/each}
      {/if}
      {#each unknownKeys(node, value) as key (key)}
        <div class="struct__unknown" data-unknown-key={key}>
          <ul class="struct__issues">
            {#each issuesAt(issues, [...path, key]) as issue, index (index)}<li>{issue.message}</li>{/each}
          </ul>
          <p class="struct__hint">Stored value: <code>{showRaw(value[key])}</code></p>
          <button type="button" class="struct__button" onclick={() => onchange(withKey(value, key, undefined))}>
            Remove unknown key {key}
          </button>
        </div>
      {/each}
    {:else if node.kind === 'record' && isPlainObject(value)}
      {#each Object.keys(value) as key, index (index)}
        {#snippet entryActions()}
          <label class="struct__label" for={`${uid}-key-${index}`}>{label} key {index + 1}</label>
          <input
            id={`${uid}-key-${index}`}
            class="struct__input struct__key"
            type="text"
            value={key}
            onchange={(event) => renameKey(key, event.currentTarget.value.trim())}
          />
          <button type="button" class="struct__button" onclick={() => onchange(withKey(value, key, undefined))}>Remove {key}</button>
        {/snippet}
        <StructNode schema={node.values} value={value[key]} {defs} {issues} path={[...path, key]} label={key} depth={depth + 1} actions={entryActions} onchange={(next) => onchange(withKey(value, key, next ?? sample(node.values)))} />
      {/each}
      <button type="button" class="struct__button" onclick={() => onchange(withKey(value, freeKey(value), sample(node.values)))}>Add entry to {label}</button>
    {:else if node.kind === 'tuple' && Array.isArray(value)}
      {#each node.items as item, index (index)}
        <StructNode schema={item} value={value[index]} {defs} {issues} path={[...path, index]} label={`${label} ${index + 1}`} required depth={depth + 1} onchange={(next) => list({ action: 'set', index, value: next ?? sample(item) })} />
      {/each}
    {:else if node.kind === 'array' && Array.isArray(value)}
      {@const c = node.constraints}
      {@const full = c?.maxItems !== undefined && value.length >= c.maxItems}
      {@const atMin = c?.minItems !== undefined && value.length <= c.minItems}
      <div class="struct__list" use:listKeyboard={{ label: `${label} item` }}>
      {#each value as item, index (index)}
        {#snippet itemActions()}
          <span class="struct__tools">
            <button type="button" class="struct__button" data-list-control="up" aria-keyshortcuts="Alt+ArrowUp" disabled={index === 0} onclick={() => list({ action: 'move', index, step: -1 })}>Move {label} item {index + 1} up</button>
            <button type="button" class="struct__button" data-list-control="down" aria-keyshortcuts="Alt+ArrowDown" disabled={index === value.length - 1} onclick={() => list({ action: 'move', index, step: 1 })}>Move {label} item {index + 1} down</button>
            <button type="button" class="struct__button" data-list-control="remove" disabled={atMin} onclick={() => list({ action: 'remove', index })}>Remove {label} item {index + 1}</button>
          </span>
        {/snippet}
        <div class="struct__list-item" data-list-item>
        <StructNode
          schema={node.items}
          value={item}
          {defs}
          {issues}
          path={[...path, index]}
          label={`${label} item ${index + 1}`}
          required
          depth={depth + 1}
          actions={itemActions}
          onchange={(next) => list(next === undefined ? { action: 'remove', index } : { action: 'set', index, value: next })}
        />
        </div>
      {/each}
      <button
        type="button"
        class="struct__button"
        data-list-control="add"
        disabled={full}
        onclick={() => list({ action: 'add', value: nextUniqueItem(value, sample(node.items), c?.uniqueBy) })}
      >Add {label} item</button>
      </div>
      {#if full}<p class="struct__hint">{label} holds at most {c?.maxItems} items.</p>{/if}
    {:else}
      <p class="struct__hint">{label}: set in code only.</p>
    {/if}
  </fieldset>
{/if}

<style>
  .struct__group {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding: 0.5rem 0.65rem 0.65rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.45rem;
    min-inline-size: 0;
  }
  .struct__legend {
    padding-inline: 0.25rem;
    font-weight: 600;
  }
  .struct__leaf {
    display: grid;
    gap: 0.3rem;
  }
  .struct__row,
  .struct__tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
  }
  .struct__label {
    flex: 1 0 100%;
    font-size: 0.875rem;
  }
  .struct__input {
    box-sizing: border-box;
    flex: 1 1 8rem;
    min-inline-size: 0;
    padding: 0.45rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.4rem;
    font: inherit;
    color: inherit;
    background: var(--tx-background, Canvas);
  }
  .struct__switch {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .struct__button {
    font: inherit;
    font-size: 0.8125rem;
    padding: 0.3rem 0.55rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.4rem;
    color: inherit;
    background: var(--tx-surface, Canvas);
    cursor: pointer;
    justify-self: start;
  }
  .struct__button:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
  .struct__hint {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--tx-muted-foreground, GrayText);
    overflow-wrap: anywhere;
  }
  .struct__issues {
    margin: 0;
    padding-inline-start: 1.1rem;
    font-size: 0.8125rem;
    font-weight: 600;
  }
  .struct__unknown {
    display: grid;
    gap: 0.3rem;
    padding: 0.4rem;
    border-inline-start: 3px solid var(--tx-destructive, Mark);
  }
  :is(input, select, button):focus-visible {
    outline: 3px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  [aria-invalid='true'] {
    border-color: var(--tx-destructive, Mark);
  }
  /* List wrappers for keyboard support only: they add no box. */
  .struct__list, .struct__list-item { display: contents; }
</style>
