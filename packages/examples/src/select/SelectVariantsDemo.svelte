<script lang="ts">
import { Select } from 'texuli/select';

const items = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
];
</script>

<section data-example="ui-select-variants" class="demo" aria-label="Select variants">
  <h2>Variants and sizes</h2>
  <div class="row">
    <Select.Root value="a" open {items} size="sm" variant="outline">
      <Select.Trigger size="sm" variant="outline" aria-label="Small outline">
        <Select.Value />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content size="sm">
          <Select.Viewport>
            {#each items as item (item.value)}
              <Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
            {/each}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>

    <Select.Root value="b" open={false} {items} size="md" variant="soft">
      <Select.Trigger size="md" variant="soft" aria-label="Medium soft">
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

    <Select.Root value="c" open={false} {items} size="lg" variant="outline">
      <Select.Trigger size="lg" variant="outline" aria-label="Large outline">
        <Select.Value />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content size="lg">
          <Select.Viewport>
            {#each items as item (item.value)}
              <Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
            {/each}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
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
  h2 {
    margin: 0;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;
    align-items: flex-start;
  }
  .demo :global(.tx-select-root) {
    min-inline-size: 11rem;
  }
</style>
