<script lang="ts">
// TagsInput scenario: @texuli/primitives TagsInput public API only, held to
// APG-aligned behavior.
import { TagsInput } from '@texuli/primitives/tags-input';
import { behaviorEvent } from '../../harness/client/events.ts';

let topics = $state(['design', 'research']);
</script>

<form
  class="behavior-tags"
  onsubmit={(event) => {
    event.preventDefault();
    behaviorEvent('submit', { topic: new FormData(event.currentTarget).getAll('topic') });
  }}
>
  <span id="topics-label">Topics</span>
  <TagsInput.Root
    bind:value={topics}
    name="topic"
    max={5}
    aria-labelledby="topics-label"
    class="behavior-tags-root"
    onValueChange={(next) => behaviorEvent('valueChange', next)}
  >
    {#snippet children({ tags })}
      <TagsInput.List class="behavior-tags-list">
        {#each tags as tag, index (`${index}-${tag}`)}
          <TagsInput.Tag {index} class="behavior-tag">
            <span>{tag}</span>
            <TagsInput.TagRemove {index} class="behavior-tag-remove">×</TagsInput.TagRemove>
          </TagsInput.Tag>
        {/each}
      </TagsInput.List>
      <TagsInput.Input aria-label="Add a topic" class="behavior-tags-input" />
    {/snippet}
  </TagsInput.Root>
  <button type="submit">Save topics</button>
</form>

<style>
  .behavior-tags {
    display: grid;
    gap: 0.75rem;
    padding: 1rem;
    max-inline-size: 32rem;
  }
  .behavior-tags :global(.behavior-tags-root) {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border: 1px solid #52525b;
    border-radius: 0.5rem;
  }
  .behavior-tags :global(.behavior-tags-list) {
    display: contents;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .behavior-tags :global(.behavior-tag) {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding-inline: 0.5rem;
    border-radius: 999px;
    background: #e0e7ff;
    color: #1e1b4b;
  }
  .behavior-tags :global(.behavior-tag:focus-visible) {
    outline: 2px solid #4338ca;
    outline-offset: 2px;
  }
  .behavior-tags :global(.behavior-tag-remove) {
    min-inline-size: 24px;
    min-block-size: 24px;
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  .behavior-tags :global(.behavior-tags-input) {
    flex: 1;
    min-inline-size: 8rem;
    border: 0;
    font: inherit;
  }
</style>
