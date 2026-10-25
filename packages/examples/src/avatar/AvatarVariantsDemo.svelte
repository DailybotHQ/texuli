<script lang="ts">
import { AVATAR_SIZES, Avatar } from 'texuli/avatar';
</script>

<section data-example="ui-avatar-variants" aria-labelledby="avatar-variants-title">
  <h2 id="avatar-variants-title">Avatar sizes</h2>
  <p class="row">
    {#each AVATAR_SIZES as size (size)}
      <span class="cell">
        <Avatar name="Ada Example" {size} />
        <span class="caption">{size}</span>
      </span>
    {/each}
  </p>
  <h3>With image delay</h3>
  <p class="row">
    <Avatar
      name="Bea Harbor"
      size="lg"
      delayMs={0}
      src="https://images.example.com/bea.webp"
    />
  </p>
</section>

<style>
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: flex-end;
  }
  .cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
  }
  .caption {
    font-size: var(--tx-font-size-xs, 0.75rem);
    color: var(--tx-muted-foreground, GrayText);
  }
  section {
    color: var(--tx-foreground, CanvasText);
  }
</style>
