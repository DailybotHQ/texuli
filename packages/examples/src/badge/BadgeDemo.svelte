<script lang="ts">
import { Badge, Chip, Tag } from 'texuli/badge';

const variants = [
  'default',
  'secondary',
  'outline',
  'success',
  'warning',
  'destructive',
  'info',
  'neutral',
] as const;

let selected = $state(true);
let tags = $state(['Design', 'Research']);

function removeTag(name: string): void {
  tags = tags.filter((t) => t !== name);
}
</script>

<section data-example="texuli-badge" aria-labelledby="badge-demo-title">
  <h2 id="badge-demo-title">Badge, Tag and Chip</h2>

  <h3>Badges (every variant)</h3>
  <p class="row">
    {#each variants as variant (variant)}
      <Badge {variant}>{variant}</Badge>
    {/each}
  </p>

  <h3>Removable tags</h3>
  <p class="row" dir="rtl">
    {#each tags as tag (tag)}
      <Tag label={tag} variant="info" onRemove={() => removeTag(tag)} />
    {/each}
  </p>

  <h3>Filter chip</h3>
  <p class="row">
    <Chip
      label="Unread only"
      selected={selected}
      onclick={() => (selected = !selected)}
    />
    <Chip label="Disabled" disabled />
  </p>
</section>

<style>
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  :global([data-tx-mode='dark']) section {
    color: var(--tx-foreground, CanvasText);
  }
</style>
