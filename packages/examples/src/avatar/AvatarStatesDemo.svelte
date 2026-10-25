<script lang="ts">
import { AVATAR_STATUSES, Avatar } from 'texuli/avatar';
</script>

<section data-example="ui-avatar-states" aria-labelledby="avatar-states-title">
  <h2 id="avatar-states-title">Avatar states</h2>
  <h3>Presence</h3>
  <p class="row">
    {#each AVATAR_STATUSES as status (status)}
      <span class="cell">
        <Avatar name="Ada Example" {status} />
        <span class="caption">{status}</span>
      </span>
    {/each}
  </p>
  <h3>Unsafe src keeps initials</h3>
  <p class="row">
    <Avatar name="Cal Orbit" src="javascript:alert(1)" />
    <Avatar name="Dee Quill" src="data:text/html,nope" />
  </p>
  <h3>Decorative next to a name</h3>
  <p class="row named">
    <Avatar name="Eli Sands" decorative status="online" />
    <span>Eli Sands</span>
  </p>
</section>

<style>
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: flex-end;
  }
  .named {
    align-items: center;
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
