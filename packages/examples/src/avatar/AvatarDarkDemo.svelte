<script lang="ts">
import { Avatar, AvatarGroup } from 'texuli/avatar';
</script>

<section data-example="ui-avatar-dark" aria-labelledby="avatar-dark-title">
  <h2 id="avatar-dark-title">Avatar on dark tokens</h2>
  <p class="row">
    <Avatar name="Ada Example" status="online" size="lg" />
    <Avatar name="Bea Harbor" status="busy" size="lg" />
    <Avatar name="Cal Orbit" size="lg" />
  </p>
  <AvatarGroup
    label="Night shift"
    max={4}
    size="md"
    items={[
      { name: 'Ada Example', status: 'online' },
      { name: 'Bea Harbor', status: 'away' },
      { name: 'Cal Orbit' },
      { name: 'Dee Quill', status: 'offline' },
      { name: 'Eli Sands' },
    ]}
  />
</section>

<style>
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
    margin-block-end: 1rem;
  }
  section {
    color: var(--tx-foreground, CanvasText);
  }
</style>
