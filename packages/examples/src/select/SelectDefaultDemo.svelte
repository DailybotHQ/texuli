<script lang="ts">
import { Select } from 'texuli/select';

const items = [
  { value: 'free', label: 'Free', description: '1 seat · example.com' },
  { value: 'team', label: 'Team', description: 'Up to 10 seats' },
  { value: 'enterprise', label: 'Enterprise', description: 'Custom limits' },
];

let value = $state('team');
let open = $state(true);
</script>

<section data-example="ui-select" class="demo" aria-label="Select default">
  <h2>Select</h2>
  <p>Styled listbox with groups, descriptions and a chevron trigger. Open for capture.</p>
  <span class="field" id="plan-label">Plan</span>
  <Select.Root bind:value bind:open {items} name="plan">
    <Select.Trigger aria-labelledby="plan-label">
      <Select.Value placeholder="Choose a plan" />
    </Select.Trigger>
    <Select.Portal>
      <Select.Content>
        <Select.Viewport>
          <Select.Group>
            <Select.Label>Billing plans</Select.Label>
            {#each items as item (item.value)}
              <Select.Item value={item.value} label={item.label} description={item.description}>
                {item.label}
              </Select.Item>
            {/each}
          </Select.Group>
        </Select.Viewport>
      </Select.Content>
    </Select.Portal>
  </Select.Root>
</section>

<style>
  .demo {
    display: grid;
    gap: 0.75rem;
    justify-items: start;
    padding: 1.5rem;
    min-block-size: 18rem;
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
  }
  h2 {
    margin: 0;
    font-size: 1.125rem;
  }
  p {
    margin: 0;
    color: var(--tx-muted-foreground, GrayText);
    max-inline-size: 36rem;
  }
  .field {
    font-size: 0.875rem;
    font-weight: 500;
  }
  .demo :global(.tx-select-root) {
    min-inline-size: 16rem;
  }
</style>
