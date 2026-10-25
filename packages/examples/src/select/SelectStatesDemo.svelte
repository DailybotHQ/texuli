<script lang="ts">
import { Select } from 'texuli/select';

const items = [
  { value: 'open', label: 'Open' },
  { value: 'hold', label: 'On hold', disabled: true },
  { value: 'done', label: 'Done' },
];
</script>

<section data-example="ui-select-states" class="demo" aria-label="Select states">
  <h2>States</h2>
  <div class="row">
    <div>
      <h3>Placeholder</h3>
      <Select.Root value="" {items}>
        <Select.Trigger aria-label="Status placeholder">
          <Select.Value placeholder="Pick a status" />
        </Select.Trigger>
        <Select.Portal>
          <Select.Content>
            <Select.Viewport>
              {#each items as item (item.value)}
                <Select.Item value={item.value} label={item.label} disabled={item.disabled}
                  >{item.label}</Select.Item
                >
              {/each}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
    <div>
      <h3>Disabled</h3>
      <Select.Root value="open" disabled {items}>
        <Select.Trigger aria-label="Status disabled">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Content>
            <Select.Viewport>
              {#each items as item (item.value)}
                <Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
              {/each}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
    <div>
      <h3>Open with disabled option</h3>
      <Select.Root value="open" open {items}>
        <Select.Trigger aria-label="Status open">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Content>
            <Select.Viewport>
              {#each items as item (item.value)}
                <Select.Item value={item.value} label={item.label} disabled={item.disabled}
                  >{item.label}</Select.Item
                >
              {/each}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  </div>
</section>

<style>
  .demo {
    display: grid;
    gap: 1rem;
    padding: 1.5rem;
    min-block-size: 16rem;
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
  }
  h2,
  h3 {
    margin: 0;
  }
  h3 {
    font-size: 0.875rem;
    margin-block-end: 0.5rem;
    color: var(--tx-muted-foreground, GrayText);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 1.75rem;
    align-items: flex-start;
  }
  .demo :global(.tx-select-root) {
    min-inline-size: 12rem;
  }
</style>
