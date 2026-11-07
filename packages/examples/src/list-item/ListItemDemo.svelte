<script lang="ts">
import { Avatar } from 'texuli/avatar';
import { IconButton } from 'texuli/button';
import { ListItem } from 'texuli/list-item';

let selected = $state('Weekly digest');
const people = [
  { name: 'Ada Example', note: 'Shared the launch checklist', time: '09:41' },
  { name: 'Lin Example', note: 'Asked for a review', time: 'Yesterday' },
];
const channels = ['Weekly digest', 'Release notes', 'Mentions only'];
</script>

<section data-example="texuli-list-item" aria-labelledby="tx-list-item-title">
  <h2 id="tx-list-item-title">List item</h2>
  <p>Rows of a list with leading media, two lines of text, trailing meta and actions. Fictional example.com only.</p>

  <h3>Links with avatars and meta</h3>
  <ul role="list" class="tx-list panel" aria-label="Recent activity" data-axis="links">
    {#each people as person, index (person.name)}
      <ListItem
        title={person.name}
        description={person.note}
        meta={person.time}
        href={`https://example.com/activity/${index + 1}`}
        current={index === 0}
      >
        {#snippet leading()}<Avatar name={person.name} size="sm" />{/snippet}
        {#snippet trailing()}<IconButton label={`More for ${person.name}`} size="sm">⋯</IconButton>{/snippet}
      </ListItem>
    {/each}
  </ul>

  <h3>Buttons with icons</h3>
  <ul role="list" class="tx-list panel" aria-label="Digest channel" data-axis="select">
    {#each channels as channel (channel)}
      <ListItem
        title={channel}
        icon={selected === channel ? 'check' : 'info'}
        meta={selected === channel ? 'Selected' : undefined}
        onSelect={() => (selected = channel)}
      />
    {/each}
  </ul>

  <h3>Plain rows and a blocked link</h3>
  <ul role="list" class="tx-list panel" aria-label="Plain rows" data-axis="plain">
    <ListItem title="Storage" description="12 of 50 GB used" meta="24%" icon="info" />
    <ListItem title="Blocked link stays text" description="javascript: is refused by the URL policy" href="javascript:alert(1)" />
  </ul>

  <h3>RTL</h3>
  <ul role="list" class="tx-list panel" dir="rtl" lang="ar" aria-label="قائمة" data-axis="rtl">
    <ListItem title="الإشعارات" description="ثلاث رسائل جديدة" meta="٣" icon="info" href="https://example.com/ar" />
  </ul>

</section>

<style>
  section {
    display: grid;
    gap: 1rem;
    padding: 1rem;
    max-inline-size: 40rem;
  }

  .panel {
    border: 1px solid var(--tx-border, currentColor);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-surface, Canvas);
    padding: 0.25rem;
  }
</style>
