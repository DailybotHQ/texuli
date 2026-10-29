<script lang="ts">
import { TagsInput } from '../../src/tags-input/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs }: HarnessProps = $props();
</script>

<TagsInput.Root value={['a', 'b']} aria-label="Tags" {...p('tags-input/TagsInputRoot')} bind:ref={refs['tags-input/TagsInputRoot']}>
  {#snippet children({ tags })}
    <TagsInput.List {...p('tags-input/TagsInputList')} bind:ref={refs['tags-input/TagsInputList']}>
      {#each tags as tag, index (`${index}-${tag}`)}
        {#if index === 1}
          <TagsInput.Tag {index} {...p('tags-input/TagsInputTag')} bind:ref={refs['tags-input/TagsInputTag']}>
            {tag}<TagsInput.TagRemove {index} {...p('tags-input/TagsInputTagRemove')} bind:ref={refs['tags-input/TagsInputTagRemove']}>×</TagsInput.TagRemove>
          </TagsInput.Tag>
        {:else}
          <TagsInput.Tag {index}>{tag}<TagsInput.TagRemove {index}>×</TagsInput.TagRemove></TagsInput.Tag>
        {/if}
      {/each}
    </TagsInput.List>
    <TagsInput.Input aria-label="Add" {...p('tags-input/TagsInputInput')} bind:ref={refs['tags-input/TagsInputInput']} />
  {/snippet}
</TagsInput.Root>
