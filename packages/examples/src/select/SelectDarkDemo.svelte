<script lang="ts">
import { Select } from 'texuli/select';

const items = [
  { value: 'inbox', label: 'Inbox', description: '12 unread' },
  { value: 'sent', label: 'Sent' },
  { value: 'archive', label: 'Archive' },
];
</script>

<section data-example="ui-select-dark" class="demo" aria-label="Select dark">
  <h2>Dark surface</h2>
  <Select.Root value="inbox" open {items} variant="soft">
    <Select.Trigger variant="soft" aria-label="Mailbox">
      <Select.Value />
    </Select.Trigger>
    <Select.Portal>
      <Select.Content>
        <Select.Viewport>
          <Select.Group>
            <Select.Label>Mailbox</Select.Label>
            {#each items as item (item.value)}
              <Select.Item
                value={item.value}
                label={item.label}
                description={item.description}
              >
                {item.label}
              </Select.Item>
            {/each}
          </Select.Group>
          <Select.Separator />
          <Select.Item value="spam" label="Spam">Spam</Select.Item>
        </Select.Viewport>
      </Select.Content>
    </Select.Portal>
  </Select.Root>
</section>

<style>
  .demo {
    display: grid;
    gap: 1rem;
    justify-items: start;
    padding: 1.5rem;
    min-block-size: 16rem;
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
  }
  h2 {
    margin: 0;
  }
  .demo :global(.tx-select-root) {
    min-inline-size: 14rem;
  }
</style>
