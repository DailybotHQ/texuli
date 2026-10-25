<script lang="ts">
import { TagsInput } from '../../../src/tags-input/index.ts';
</script>

<label for="topics">Topics</label>
<TagsInput.Root value={['design']}>
  {#snippet children({ tags })}
    <TagsInput.List>
      {#each tags as tag, index (`${index}-${tag}`)}
        <TagsInput.Tag {index}>{tag}<TagsInput.TagRemove {index}>x</TagsInput.TagRemove></TagsInput.Tag>
      {/each}
    </TagsInput.List>
    <TagsInput.Input id="topics" />
  {/snippet}
</TagsInput.Root>
