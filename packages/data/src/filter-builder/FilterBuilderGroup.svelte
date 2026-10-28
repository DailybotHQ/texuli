<script lang="ts">
import type { FilterGroup } from '../engines/grid/filter.ts';
import { type FilterBuilderContext, pathKey } from './context.ts';
import FilterBuilderCondition from './FilterBuilderCondition.svelte';
import Self from './FilterBuilderGroup.svelte';
import { depthOf, type FilterPath } from './model.ts';

interface Props {
  group: FilterGroup;
  path: FilterPath;
  /** Position in its parent group, from 1 (unused at the root). */
  position: number;
  ctx: FilterBuilderContext;
}

let { group, path, position, ctx }: Props = $props();

const key = $derived(pathKey(path));
const id = $derived(`${ctx.uid}-${key}`);
const root = $derived(path.length === 0);
</script>

<fieldset class="tx-filter-builder__group" data-filter-path={key} data-root={root || undefined}>
  <legend class={root ? 'tx-filter-builder__sr-only' : 'tx-filter-builder__legend'}>
    {root ? ctx.labels.builder : ctx.labels.group(position)}
  </legend>
  <div class="tx-filter-builder__match">
    <label for="{id}-op">{ctx.labels.match}</label>
    <select
      id="{id}-op"
      class="tx-filter-builder__control"
      aria-describedby="{id}-suffix"
      data-filter-focus="{key}:op"
      disabled={ctx.disabled}
      value={group.op}
      onchange={(event) =>
        ctx.act({ kind: 'combinator', path, op: event.currentTarget.value as FilterGroup['op'] })}
    >
      <option value="and">{ctx.labels.and}</option>
      <option value="or">{ctx.labels.or}</option>
    </select>
    <span id="{id}-suffix">{ctx.labels.matchSuffix}</span>
    {#if !root}
      <button
        type="button"
        class="tx-filter-builder__remove"
        disabled={ctx.disabled}
        aria-label={ctx.labels.removeGroup(position)}
        onclick={() => ctx.act({ kind: 'remove', path })}
      >
        <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M3 3l6 6M9 3l-6 6" /></svg>
      </button>
    {/if}
  </div>
  {#if group.children.length === 0}
    <p class="tx-filter-builder__empty">{ctx.labels.emptyGroup}</p>
  {:else}
    <ul class="tx-filter-builder__list">
      {#each group.children as child, index (index)}
        <li>
          {#if child.type === 'group'}
            <Self group={child} path={[...path, index]} position={index + 1} {ctx} />
          {:else}
            <FilterBuilderCondition condition={child} path={[...path, index]} position={index + 1} {ctx} />
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
  <div class="tx-filter-builder__add">
    <button
      type="button"
      class="tx-filter-builder__button"
      data-filter-focus="{key}:add"
      disabled={ctx.disabled || ctx.fields.length === 0}
      onclick={() => ctx.act({ kind: 'addCondition', path })}>{ctx.labels.addCondition}</button
    >
    {#if depthOf(path) < ctx.maxDepth}
      <button
        type="button"
        class="tx-filter-builder__button"
        disabled={ctx.disabled || ctx.fields.length === 0}
        onclick={() => ctx.act({ kind: 'addGroup', path })}>{ctx.labels.addGroup}</button
      >
    {/if}
  </div>
</fieldset>
