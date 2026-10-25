<script lang="ts">
import { Avatar, AvatarGroup } from 'texuli/avatar';
</script>

<section data-example="ui-avatar" aria-labelledby="avatar-default-title">
  <h2 id="avatar-default-title">Avatar</h2>
  <p class="row">
    <Avatar name="Ada Example" status="online" />
    <Avatar name="Bea Harbor" status="away" />
    <Avatar name="Cal Orbit" />
  </p>
  <h3>Group</h3>
  <AvatarGroup
    label="Harbor notes team"
    max={3}
    items={[
      { name: 'Ada Example', status: 'online' },
      { name: 'Bea Harbor' },
      { name: 'Cal Orbit', status: 'busy' },
      { name: 'Dee Quill' },
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
  }
  section {
    color: var(--tx-foreground, CanvasText);
  }
</style>
