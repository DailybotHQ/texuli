<script lang="ts">
import type { FilterCondition, FilterOperator } from '../engines/grid/filter.ts';
import {
  customOperator,
  type FilterAnyOperator,
  groupFields,
  optionLabel,
  optionValue,
} from './catalog.ts';
import { type FilterBuilderContext, pathKey } from './context.ts';
import { type FilterPath, operatorsFor } from './model.ts';

interface Props {
  condition: FilterCondition;
  path: FilterPath;
  /** Position in its group, from 1. */
  position: number;
  ctx: FilterBuilderContext;
}

let { condition, path, position, ctx }: Props = $props();

const key = $derived(pathKey(path));
const id = $derived(`${ctx.uid}-${key}`);
const field = $derived(ctx.fields.find((entry) => entry.key === condition.field));
const fieldType = $derived(field?.type ?? 'text');
const operator = $derived(condition.operator);
/** A catalog operator: its editor decides the value control. */
const custom = $derived(customOperator(operator, ctx.operators));
const options = $derived(custom?.options ?? field?.options ?? []);
/** The value type the controls edit: the field's, or the one a catalog editor implies. */
const type = $derived.by(() => {
  if (!custom) return fieldType;
  switch (custom.editor) {
    case 'number':
    case 'date':
    case 'boolean':
      return custom.editor;
    case 'option':
    case 'options':
      return options.length > 0 ? 'enum' : 'text';
    case 'range':
      return fieldType === 'date' ? 'date' : 'number';
    default:
      return 'text';
  }
});
const messages = $derived(ctx.issues.get(key) ?? []);
/** The ids of this condition's issue messages, or undefined when it has none. */
const issue = $derived(
  messages.length > 0 ? messages.map((_, index) => `${id}-issue-${index}`).join(' ') : undefined
);
const shape = $derived(
  custom
    ? custom.editor === 'none'
      ? 'none'
      : custom.editor === 'options'
        ? 'in'
        : custom.editor === 'range'
          ? 'between'
          : 'one'
    : operator === 'isEmpty' || operator === 'isNotEmpty'
      ? 'none'
      : operator === 'in' || operator === 'between'
        ? operator
        : 'one'
);
const sections = $derived(groupFields(ctx.fields, ctx.groups));
/** The menu text of an operator: the labels for built-ins, the catalog label otherwise. */
const operatorLabel = (option: FilterAnyOperator) =>
  ctx.labels.operators[option as FilterOperator] ??
  customOperator(option, ctx.operators)?.label ??
  option;
/** The native input type of a typed value (text otherwise). */
const inputType = $derived(type === 'number' ? 'number' : type === 'date' ? 'date' : 'text');
const list = $derived(Array.isArray(condition.value) ? condition.value : []);

function read(raw: string): string | number | undefined {
  if (raw.trim() === '') return undefined;
  if (type !== 'number') return raw;
  const number = Number(raw);
  return Number.isFinite(number) ? number : raw;
}

function setValue(value: unknown): void {
  ctx.act({ kind: 'value', path, value });
}

function setEnd(index: 0 | 1, raw: string): void {
  const pair = [list[0] ?? null, list[1] ?? null];
  pair[index] = read(raw) ?? null;
  setValue(pair);
}

function setList(raw: string): void {
  setValue(
    raw
      .split(',')
      .map((part) => read(part.trim()))
      .filter((part) => part !== undefined)
  );
}

const show = (value: unknown) => (value === undefined || value === null ? '' : String(value));

/** The typed value inputs: the single value, and the two ends of a range. */
let single = $state<HTMLInputElement | null>(null);
const ends = $state<(HTMLInputElement | null)[]>([null, null]);

/**
 * What a typed value input shows. While its own text already reads as the
 * model value ("1.0" for 1, or an unfinished "1." a browser reports as
 * empty), the text stays, so typing a decimal is never rewritten under the
 * caret; a model change from elsewhere replaces it.
 */
function shown(node: HTMLInputElement | null, value: unknown): string {
  if (node && (read(node.value) ?? null) === (value ?? null)) return node.value;
  return show(value);
}
</script>

<fieldset class="tx-filter-builder__condition" data-filter-path={key}>
  <legend class="tx-filter-builder__sr-only">{ctx.labels.condition(position)}</legend>
  <label class="tx-filter-builder__sr-only" for="{id}-field">{ctx.labels.field}</label>
  <select
    id="{id}-field"
    class="tx-filter-builder__control"
    data-filter-focus="{key}:field"
    disabled={ctx.disabled}
    value={condition.field}
    onchange={(event) => ctx.act({ kind: 'field', path, key: event.currentTarget.value })}
  >
    {#if !field}<option value={condition.field}>{condition.field}</option>{/if}
    {#each sections as section (section.group?.id ?? '')}
      {#if section.group}
        <optgroup label={section.group.label}>
          {#each section.fields as option (option.key)}
            <option value={option.key}>{option.header}</option>
          {/each}
        </optgroup>
      {:else}
        {#each section.fields as option (option.key)}
          <option value={option.key}>{option.header}</option>
        {/each}
      {/if}
    {/each}
  </select>
  <label class="tx-filter-builder__sr-only" for="{id}-operator">{ctx.labels.operator}</label>
  <select
    id="{id}-operator"
    class="tx-filter-builder__control"
    disabled={ctx.disabled}
    aria-invalid={issue && shape === 'none' ? 'true' : undefined}
    aria-describedby={shape === 'none' ? issue : undefined}
    value={operator}
    onchange={(event) =>
      ctx.act({ kind: 'operator', path, operator: event.currentTarget.value })}
  >
    {#if field && !operatorsFor(field, ctx.operators).includes(operator)}<option value={operator}>{operatorLabel(operator)}</option>{/if}
    {#each operatorsFor(field ?? { type: fieldType }, ctx.operators) as option (option)}
      <option value={option}>{operatorLabel(option)}</option>
    {/each}
  </select>
  {#if shape === 'between'}
    {#each [0, 1] as const as end (end)}
      <label class="tx-filter-builder__sr-only" for="{id}-value-{end}">
        {end === 0 ? ctx.labels.from : ctx.labels.to}
      </label>
      <input
        id="{id}-value-{end}"
        class="tx-filter-builder__control tx-filter-builder__value"
        type={inputType}
        disabled={ctx.disabled}
        aria-invalid={issue ? 'true' : undefined}
        aria-describedby={issue}
        bind:this={ends[end]}
        value={shown(ends[end] ?? null, list[end])}
        oninput={(event) => setEnd(end, event.currentTarget.value)}
      />
    {/each}
  {:else if shape !== 'none'}
    <label class="tx-filter-builder__sr-only" for="{id}-value">{ctx.labels.value}</label>
    {#if shape === 'in' && type === 'enum'}
      <select
        id="{id}-value"
        class="tx-filter-builder__control tx-filter-builder__value"
        multiple
        size={Math.min(4, options.length || 1)}
        disabled={ctx.disabled}
        aria-invalid={issue ? 'true' : undefined}
        aria-describedby={issue}
        onchange={(event) =>
          setValue([...event.currentTarget.selectedOptions].map((option) => option.value))}
      >
        {#each options as option (optionValue(option))}
          <option value={optionValue(option)} selected={list.includes(optionValue(option))}>{optionLabel(option)}</option>
        {/each}
      </select>
    {:else if shape === 'in'}
      <input
        id="{id}-value"
        class="tx-filter-builder__control tx-filter-builder__value"
        type="text"
        disabled={ctx.disabled}
        aria-invalid={issue ? 'true' : undefined}
        aria-describedby="{id}-hint{issue ? ` ${issue}` : ''}"
        value={list.join(', ')}
        onchange={(event) => setList(event.currentTarget.value)}
      />
      <span id="{id}-hint" class="tx-filter-builder__sr-only">{ctx.labels.listHint}</span>
    {:else if type === 'boolean' || type === 'enum'}
      <select
        id="{id}-value"
        class="tx-filter-builder__control tx-filter-builder__value"
        disabled={ctx.disabled}
        aria-invalid={issue ? 'true' : undefined}
        aria-describedby={issue}
        value={show(condition.value)}
        onchange={(event) => {
          const raw = event.currentTarget.value;
          setValue(type === 'boolean' ? raw === 'true' : raw || undefined);
        }}
      >
        {#if type === 'boolean'}
          <option value="true">{ctx.labels.yes}</option>
          <option value="false">{ctx.labels.no}</option>
        {:else}
          <option value="">{ctx.labels.choose}</option>
          {#each options as option (optionValue(option))}
            <option value={optionValue(option)}>{optionLabel(option)}</option>
          {/each}
        {/if}
      </select>
    {:else}
      <input
        id="{id}-value"
        class="tx-filter-builder__control tx-filter-builder__value"
        type={inputType}
        disabled={ctx.disabled}
        aria-invalid={issue ? 'true' : undefined}
        aria-describedby={issue}
        bind:this={single}
        value={shown(single, condition.value)}
        oninput={(event) => setValue(read(event.currentTarget.value))}
      />
    {/if}
  {/if}
  <button
    type="button"
    class="tx-filter-builder__remove"
    disabled={ctx.disabled}
    aria-label={ctx.labels.removeCondition(position)}
    onclick={() => ctx.act({ kind: 'remove', path })}
  >
    <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M3 3l6 6M9 3l-6 6" /></svg>
  </button>
  {#each messages as message, index (index)}
    <p id="{id}-issue-{index}" class="tx-filter-builder__issue">{message}</p>
  {/each}
</fieldset>
