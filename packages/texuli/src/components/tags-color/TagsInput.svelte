<script lang="ts">
import {
  type TagsInputInvalidDetail,
  type TagsInputLabels,
  TagsInput as TagsInputPrimitive,
} from '@texuli/primitives/tags-input';
import type { HTMLAttributes } from 'svelte/elements';
import { splitControlProps } from '../../internal/control-props.ts';
import { type ClassValue, cx } from '../../internal/cx.ts';
import './tags-color.css';

type Props = {
  value?: string[];
  onValueChange?: (value: string[]) => void;
  onInvalid?: (detail: TagsInputInvalidDetail) => void;
  delimiter?: string | RegExp;
  addOnPaste?: boolean;
  addOnBlur?: boolean;
  allowDuplicates?: boolean;
  max?: number;
  validate?: (tag: string, tags: readonly string[]) => boolean | string;
  disabled?: boolean;
  name?: string;
  form?: string;
  required?: boolean;
  labels?: Partial<TagsInputLabels>;
  /** Accessible name for the group (or use aria-labelledby). */
  label?: string;
  /** Accessible name for the text input. */
  inputLabel?: string;
  placeholder?: string;
  class?: ClassValue;
  id?: string;
} & Omit<
  HTMLAttributes<HTMLDivElement>,
  'class' | 'id' | 'children' | 'onInvalid' | 'placeholder' | 'onchange'
>;

let {
  value = $bindable([] as string[]),
  onValueChange,
  onInvalid,
  delimiter = ',',
  addOnPaste = true,
  addOnBlur = false,
  allowDuplicates = false,
  max = Number.POSITIVE_INFINITY,
  validate,
  disabled = false,
  name,
  form,
  required = false,
  labels,
  label,
  inputLabel = 'Add a tag',
  placeholder = 'Add…',
  class: className,
  id,
  ...rest
}: Props = $props();

// aria-*, data-*, handlers and form attributes name and wire the text input
// (the focusable control); layout hooks (style, hidden…) stay on the root.
const split = $derived(splitControlProps(rest));
</script>

<TagsInputPrimitive.Root
  bind:value
  {onValueChange}
  {onInvalid}
  {delimiter}
  {addOnPaste}
  {addOnBlur}
  {allowDuplicates}
  {max}
  {validate}
  {disabled}
  {name}
  {form}
  {required}
  {labels}
  {id}
  class={cx('tx-tags-input', className)}
  aria-label={label}
  data-tx-tags-input=""
  {...split.wrapper}
>
  {#snippet children({ tags })}
    <TagsInputPrimitive.List class="tx-tags-input__list" data-tx-tags-list="">
      {#each tags as tag, index (`${index}-${tag}`)}
        <TagsInputPrimitive.Tag {index} class="tx-tags-input__tag" data-tx-tags-tag="">
          <span class="tx-tags-input__tag-label">{tag}</span>
          <TagsInputPrimitive.TagRemove {index} class="tx-tags-input__remove" data-tx-tags-remove="">
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linecap="round"
              />
            </svg>
          </TagsInputPrimitive.TagRemove>
        </TagsInputPrimitive.Tag>
      {/each}
    </TagsInputPrimitive.List>
    <TagsInputPrimitive.Input
      {...split.control}
      class="tx-tags-input__input"
      aria-label={(split.control['aria-label'] as string | undefined) ?? inputLabel}
      {placeholder}
      data-tx-tags-field=""
    />
  {/snippet}
</TagsInputPrimitive.Root>
