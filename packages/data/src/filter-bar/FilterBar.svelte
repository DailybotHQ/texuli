<script lang="ts">
import { type ClassValue, cx } from 'texuli/cx';
import type { FilterGroup, FilterNode } from '../engines/grid/filter.ts';
import { FilterBuilder } from '../filter-builder/index.ts';
import type { FilterField } from '../filter-builder/model.ts';
import { type FilterPath, removeAt } from '../filter-builder/model.ts';

interface Props {
  fields: readonly FilterField[];
  value?: FilterGroup;
  onValueChange?: (value: FilterGroup) => void;
  saved?: boolean;
  disabled?: boolean;
  label?: string;
  addLabel?: string;
  clearLabel?: string;
  savedLabel?: string;
  unsavedLabel?: string;
  class?: ClassValue;
}

let {
  fields,
  value = $bindable({ type: 'group', op: 'and', children: [] }),
  onValueChange,
  saved = true,
  disabled = false,
  label = 'Filters',
  addLabel = 'Add filter',
  clearLabel = 'Clear filters',
  savedLabel = 'Saved',
  unsavedLabel = 'Unsaved changes',
  class: className,
}: Props = $props();

interface Chip {
  path: FilterPath;
  text: string;
}
function chips(nodes: readonly FilterNode[], path: FilterPath = []): Chip[] {
  return nodes.flatMap((node, index) => {
    const nextPath = [...path, index];
    if (node.type === 'group') return chips(node.children, nextPath);
    const field = fields.find((item) => item.key === node.field);
    if (!field) return [];
    const raw = Array.isArray(node.value)
      ? node.value.filter((part) => part !== null).join(' – ')
      : node.value;
    const valueText = typeof raw === 'boolean' ? (raw ? 'Yes' : 'No') : String(raw ?? '');
    return [
      {
        path: nextPath,
        text: `${field.header} ${node.operator}${valueText ? ` ${valueText}` : ''}`,
      },
    ];
  });
}
const applied = $derived(chips(value.children));

function update(next: FilterGroup): void {
  value = next;
  onValueChange?.(next);
}

function remove(path: FilterPath): void {
  update(removeAt(value, path));
}

function clear(): void {
  update({ ...value, children: [] });
}
</script>

<section class={cx('tx-filter-bar', className)} aria-label={label} data-tx-component="data-filter-bar" data-tx-filter-bar>
  <div class="tx-filter-bar__chips" role="group" aria-label="Applied filters">
    {#each applied as chip (chip.path.join('-'))}
      <span class="tx-filter-bar__chip">
        <span>{chip.text}</span>
        <button type="button" aria-label={`Remove ${chip.text}`} disabled={disabled} onclick={() => remove(chip.path)}>×</button>
      </span>
    {:else}
      <span class="tx-filter-bar__empty">No filters applied</span>
    {/each}
  </div>
  <details class="tx-filter-bar__editor" inert={disabled}>
    <summary aria-disabled={disabled}>{addLabel}</summary>
    <div class="tx-filter-bar__panel"><FilterBuilder {fields} {value} onValueChange={update} {disabled} /></div>
  </details>
  <button type="button" class="tx-filter-bar__clear" disabled={disabled || applied.length === 0} onclick={clear}>{clearLabel}</button>
  <span class="tx-filter-bar__saved" role="status" data-saved={saved ? 'true' : 'false'}>{saved ? savedLabel : unsavedLabel}</span>
</section>

<style>
  .tx-filter-bar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--tx-space-2); }
  .tx-filter-bar__chips { display: flex; flex: 1 1 auto; flex-wrap: wrap; align-items: center; gap: calc(var(--tx-space-unit) * 1.5); }
  .tx-filter-bar__chip { display: inline-flex; align-items: center; gap: var(--tx-space-1); border: var(--tx-border-width-thin) solid var(--tx-border, CanvasText); border-radius: var(--tx-shape-radius-full); padding: var(--tx-space-1) var(--tx-space-2); font-size: var(--tx-type-label-size); }
  .tx-filter-bar__chip button, .tx-filter-bar__clear, .tx-filter-bar__editor summary { border: 0; border-radius: var(--tx-shape-radius-xs); padding: var(--tx-space-1) var(--tx-space-2); background: var(--tx-muted, ButtonFace); color: inherit; font: inherit; cursor: pointer; }
  .tx-filter-bar__editor { position: relative; }
  .tx-filter-bar__editor summary { list-style: none; }
  .tx-filter-bar__editor summary::-webkit-details-marker { display: none; }
  .tx-filter-bar__panel { position: absolute; z-index: 5; inset-block-start: calc(100% + var(--tx-space-1)); inset-inline-end: 0; inline-size: min(34rem, calc(100vw - var(--tx-space-8))); max-block-size: min(70vh, 36rem); overflow: auto; padding: var(--tx-space-3); border: var(--tx-border-width-thin) solid var(--tx-border, CanvasText); border-radius: var(--tx-shape-radius-md); background: var(--tx-surface, Canvas); color: var(--tx-surface-foreground, CanvasText); box-shadow: var(--tx-elevation-3); }
  .tx-filter-bar__empty, .tx-filter-bar__saved { color: var(--tx-muted-foreground, GrayText); font-size: var(--tx-type-label-size); }
  .tx-filter-bar__saved { margin-inline-start: auto; }
  button:disabled, summary[aria-disabled="true"] { opacity: 0.55; cursor: not-allowed; }
</style>
