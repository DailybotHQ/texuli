<script lang="ts" module>
import { attr, type DemoSpec, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    { kind: 'number', name: 'max', label: 'max', min: 2, max: 8, step: 1, default: 5 },
    { kind: 'boolean', name: 'allowDuplicates', label: 'allowDuplicates', default: false },
    { kind: 'boolean', name: 'addOnBlur', label: 'addOnBlur', default: false },
    { kind: 'boolean', name: 'disabled', label: 'disabled', default: false },
  ],
  keys: [
    { keys: ['Enter', ','], action: 'Add the typed text as a tag' },
    { keys: ['Backspace'], action: 'From an empty field, focus the last tag; on a tag, remove it' },
    {
      keys: ['ArrowLeft', 'ArrowRight'],
      action: 'Move between tags and the field (mirrored in RTL)',
    },
    { keys: ['Delete'], action: 'Remove the focused tag' },
    { keys: ['Home', 'End'], action: 'From a tag, go to the first tag or back to the field' },
  ],
  uncontrolled: 'A plain value (no binding) starts with two topics; the input keeps its own list.',
  controlled: 'bind:value keeps the tags in your state, so buttons outside can add or clear them.',
  code: (v) => `<script lang="ts">
  import { TagsInput } from '@texuli/primitives/tags-input';
  let tags = $state(['design', 'research']);
${SCRIPT_END}

<TagsInput.Root bind:value={tags}${attr('max', v.max as number)}${attr('allowDuplicates', v.allowDuplicates === true, false)}${attr('addOnBlur', v.addOnBlur === true, false)}${attr('disabled', v.disabled === true, false)} aria-label="Topics">
  {#snippet children({ tags })}
    <TagsInput.List>
      {#each tags as tag, index (\`\${index}-\${tag}\`)}
        <TagsInput.Tag {index}>
          {tag}
          <TagsInput.TagRemove {index}>×</TagsInput.TagRemove>
        </TagsInput.Tag>
      {/each}
    </TagsInput.List>
    <TagsInput.Input aria-label="Add a topic" />
  {/snippet}
</TagsInput.Root>`,
  keyCheck: {
    focus: '[data-demo-part="TagsInput.Input"]',
    press: 'Backspace',
    expect: { selector: '[data-demo-part="TagsInput.Tag"]:focus', count: 1 },
  },
  controlCheck: {
    act: '[data-demo-act="add"]',
    expect: { selector: '[data-demo-part="TagsInput.Tag"]', count: 3 },
  },
};
</script>

<script lang="ts">
import { TagsInput } from '@texuli/primitives/tags-input';
import { Button } from 'texuli/button';
// Loads the token-contract styles for the tags-input classes used below.
import 'texuli/tags-color';
import { bool, type DemoProps, num } from '../types.ts';

let { values, mode }: DemoProps = $props();

const max = $derived(num(values, 'max', 5));
const allowDuplicates = $derived(bool(values, 'allowDuplicates'));
const addOnBlur = $derived(bool(values, 'addOnBlur'));
const disabled = $derived(bool(values, 'disabled'));

let tags = $state<string[]>(['design', 'research']);

function addUrgent(): void {
  if (!tags.includes('urgent')) tags = [...tags, 'urgent'];
}
</script>

{#snippet body(list: string[])}
  <TagsInput.List class="tx-tags-input__list" data-tx-tags-list="" data-demo-part="TagsInput.List">
    {#each list as tag, index (`${index}-${tag}`)}
      <TagsInput.Tag {index} class="tx-tags-input__tag" data-tx-tags-tag="" data-demo-part="TagsInput.Tag">
        <span class="tx-tags-input__tag-label">{tag}</span>
        <TagsInput.TagRemove {index} class="tx-tags-input__remove" data-tx-tags-remove="" data-demo-part="TagsInput.TagRemove">
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
          </svg>
        </TagsInput.TagRemove>
      </TagsInput.Tag>
    {/each}
  </TagsInput.List>
  <TagsInput.Input class="tx-tags-input__input" aria-label="Add a topic" placeholder="Add a topic…" data-tx-tags-field="" data-demo-part="TagsInput.Input" />
{/snippet}

{#if mode === 'uncontrolled'}
  <TagsInput.Root value={['design', 'research']} {max} {allowDuplicates} {addOnBlur} {disabled} class="tx-tags-input" aria-label="Topics" data-tx-tags-input="" data-demo-part="TagsInput.Root">
    {#snippet children({ tags: current })}
      {@render body(current)}
    {/snippet}
  </TagsInput.Root>
{:else}
  <TagsInput.Root bind:value={tags} {max} {allowDuplicates} {addOnBlur} {disabled} class="tx-tags-input" aria-label="Topics" data-tx-tags-input="" data-demo-part="TagsInput.Root">
    {#snippet children({ tags: current })}
      {@render body(current)}
    {/snippet}
  </TagsInput.Root>
  <div class="demo-controls">
    <output data-demo-readout>Tags: {tags.length ? tags.join(', ') : 'none'}</output>
    <Button size="sm" variant="outline" onclick={addUrgent} data-demo-act="add">Add “urgent”</Button>
    <Button size="sm" variant="ghost" onclick={() => (tags = [])}>Clear</Button>
  </div>
{/if}
