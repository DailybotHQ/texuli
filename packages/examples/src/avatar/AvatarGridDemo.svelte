<script lang="ts">
import { AVATAR_SIZES, AvatarGroupGrid } from 'texuli/avatar';

/**
 * `AvatarGroupGrid`: a 2x2 collage inside one avatar-sized circle,
 * as group conversations show their members. Fictional Harbor names only.
 */
const crew = [
  { name: 'Ada Example' },
  { name: 'Bea Harbor' },
  { name: 'Cal Orbit' },
  { name: 'Dee Quill' },
  { name: 'Eli North' },
  { name: 'Fay Reed' },
];
const counts = [2, 3, 4, 6] as const;
const conversations = [
  { title: 'Launch crew', members: crew.slice(0, 3) },
  { title: 'Harbor design review', members: crew },
];
</script>

<section data-example="ui-avatar-grid" aria-labelledby="avatar-grid-title">
  <h2 id="avatar-grid-title">Avatar group grid</h2>

  <h3>By member count</h3>
  <p class="row">
    {#each counts as count (count)}
      <span class="cell">
        <AvatarGroupGrid size="lg" items={crew.slice(0, count)} />
        <span class="caption">{count} members</span>
      </span>
    {/each}
  </p>

  <h3>Sizes</h3>
  <p class="row">
    {#each AVATAR_SIZES as size (size)}
      <span class="cell">
        <AvatarGroupGrid {size} items={crew.slice(0, 4)} />
        <span class="caption">{size}</span>
      </span>
    {/each}
  </p>

  <h3>Group conversations</h3>
  <ul class="list">
    {#each conversations as conversation (conversation.title)}
      <li>
        <AvatarGroupGrid items={conversation.members} label={conversation.title} />
        <span>{conversation.title}</span>
      </li>
    {/each}
  </ul>
</section>

<style>
  section {
    color: var(--tx-foreground, CanvasText);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;
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
  .list {
    display: grid;
    gap: 0.75rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .list li {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }
</style>
