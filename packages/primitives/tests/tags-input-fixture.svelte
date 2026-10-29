<script lang="ts">
import { TagsInput, type TagsInputInvalidDetail } from '../src/tags-input/index.ts';

type Props = {
  value?: string[];
  delimiter?: string | readonly string[] | RegExp;
  addOnPaste?: boolean;
  addOnBlur?: boolean;
  allowDuplicates?: boolean;
  max?: number;
  validate?: (tag: string) => boolean | string;
  disabled?: boolean;
  name?: string;
  required?: boolean;
  dir?: 'ltr' | 'rtl';
  childInput?: boolean;
  onValueChange?: (value: string[]) => void;
  onInvalid?: (detail: TagsInputInvalidDetail) => void;
  onsubmit?: (data: FormData) => void;
};

let {
  value = $bindable(['design', 'research']),
  delimiter,
  addOnPaste,
  addOnBlur,
  allowDuplicates,
  max,
  validate,
  disabled = false,
  name,
  required = false,
  dir,
  childInput = false,
  onValueChange,
  onInvalid,
  onsubmit,
}: Props = $props();
</script>

<form
  data-testid="form"
  onsubmit={(event) => {
    event.preventDefault();
    onsubmit?.(new FormData(event.currentTarget));
  }}
>
  <span id="topics-label">Topics</span>
  <div {dir}>
    <TagsInput.Root
      bind:value
      {delimiter}
      {addOnPaste}
      {addOnBlur}
      {allowDuplicates}
      {max}
      {validate}
      {disabled}
      {name}
      {required}
      {onValueChange}
      {onInvalid}
      aria-labelledby="topics-label"
      data-testid="root"
    >
      {#snippet children({ tags })}
        <TagsInput.List>
          {#each tags as tag, index (`${index}-${tag}`)}
            <TagsInput.Tag {index}>
              <span>{tag}</span>
              <TagsInput.TagRemove {index}>×</TagsInput.TagRemove>
            </TagsInput.Tag>
          {/each}
        </TagsInput.List>
        {#if childInput}
          <TagsInput.Input aria-label="Add a topic">
            {#snippet child({ props })}<input {...props} class="custom-input" />{/snippet}
          </TagsInput.Input>
        {:else}
          <TagsInput.Input aria-label="Add a topic" />
        {/if}
      {/snippet}
    </TagsInput.Root>
  </div>
  <button type="submit">Save</button>
  <button type="reset">Reset</button>
</form>
