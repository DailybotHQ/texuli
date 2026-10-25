<script lang="ts">
/**
 * Renders one live control from each core package family so a consumer
 * install proves packed tarballs resolve and compile under Vite/Astro/SvelteKit.
 * Also imports texuli/select and @texuli/data/grid-core so CSS side-effect
 * types ship self-sufficiently (FIX-css-types-ship).
 */
import { safeHref } from '@texuli/core/url-policy';
import { DataGrid, type DataGridColumn } from '@texuli/data/grid-core';
import { Checkbox } from '@texuli/primitives/checkbox';
import { Badge } from 'texuli/badge';
import { Button } from 'texuli/button';
import { Select } from 'texuli/select';

type Row = { id: string; name: string };

const href = safeHref('https://example.com/consumer-smoke', 'developer');
let checked = $state(false);
let selected = $state('a');
/** Select/DataGrid mount after hydrate — Astro prerender hits a Select.Value recursion. */
let extras = $state(false);
$effect(() => {
  extras = true;
});

const selectItems = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];
const rows: Row[] = [{ id: '1', name: 'Ada' }];
const columns: DataGridColumn<Row>[] = [{ key: 'name', header: 'Name', type: 'text' }];
</script>

<div class="smoke" data-tx-consumer-smoke>
  <h1 data-package="texuli">Texuli consumer smoke</h1>
  <p data-package="core">core safeHref: {href ?? 'blocked'}</p>
  <p data-package="tokens">tokens: stylesheet imported by host</p>
  <div data-package="primitives">
    <Checkbox.Root bind:checked aria-label="Smoke checkbox">
      {#snippet children({ checked: isOn })}
        <span data-checkbox-state={isOn ? 'on' : 'off'}>checkbox {isOn ? 'on' : 'off'}</span>
      {/snippet}
    </Checkbox.Root>
  </div>
  <div data-package="texuli-ui">
    <Button variant="outline">Smoke button</Button>
    <Badge variant="secondary">Smoke</Badge>
  </div>
  <div data-package="texuli-select">
    {#if extras}
      <Select.Root bind:value={selected} items={selectItems} name="smoke-select">
        <Select.Trigger aria-label="Smoke select">
          <Select.Value placeholder="Pick" />
        </Select.Trigger>
        <Select.Portal>
          <Select.Content>
            <Select.Viewport>
              {#each selectItems as item (item.value)}
                <Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
              {/each}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    {:else}
      <span data-select-ssr="pending">select pending</span>
    {/if}
  </div>
  <div data-package="data-grid">
    {#if extras}
      <DataGrid {rows} {columns} getRowId={(row) => row.id} caption="Smoke grid" />
    {:else}
      <span data-grid-ssr="pending">grid pending</span>
    {/if}
  </div>
  <p data-checked={checked ? 'true' : 'false'}>checked={String(checked)}</p>
</div>

<style>
  .smoke {
    display: grid;
    gap: 0.75rem;
    padding: 1rem;
    color: CanvasText;
    background: Canvas;
    font-family: system-ui, sans-serif;
  }
</style>
