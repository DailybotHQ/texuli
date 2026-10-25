<script lang="ts">
import { createFormBridge } from '@texuli/core/form-bridge';
import { untrack } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import { createAttachmentKey } from 'svelte/attachments';
import { isRtl, tagsInputContext } from './context.ts';
import type { TagsInputInputProps } from './types.ts';

/**
 * The text input, the group's only Tab stop. Enter (or the delimiter key)
 * adds the typed text; Backspace on an empty input and ArrowLeft at its start
 * move to the last tag; pasted text is split into tags.
 */
let {
  child,
  ref = $bindable(null),
  onkeydown,
  onpaste,
  onblur,
  oninput,
  ...rest
}: TagsInputInputProps = $props();

const tagsInput = tagsInputContext.get();
let draft = $state('');

function take(text: string) {
  if (tagsInput.add(text)) draft = '';
}

function handleKeydown(event: KeyboardEvent & { currentTarget: HTMLInputElement }) {
  (onkeydown as ((e: KeyboardEvent) => void) | undefined)?.(event);
  if (event.defaultPrevented || event.isComposing) return;
  const field = event.currentTarget;
  const atStart = field.selectionStart === 0 && field.selectionEnd === 0;
  const rtl = isRtl(field);
  if (event.key === 'Enter' || (tagsInput.delimiterKey && event.key === tagsInput.delimiterKey)) {
    // Enter never submits the form while there is text to add.
    if (field.value.trim() === '' && event.key === 'Enter') return;
    event.preventDefault();
    take(field.value);
  } else if (
    (event.key === 'Backspace' && field.value === '') ||
    (event.key === (rtl ? 'ArrowRight' : 'ArrowLeft') && atStart)
  ) {
    if (tagsInput.tags.length === 0) return;
    event.preventDefault();
    tagsInput.focusTag(tagsInput.tags.length - 1);
  }
}

function handlePaste(event: ClipboardEvent) {
  (onpaste as ((e: ClipboardEvent) => void) | undefined)?.(event);
  if (event.defaultPrevented || !tagsInput.addOnPaste) return;
  const pasted = event.clipboardData?.getData('text') ?? '';
  if (pasted === '') return;
  event.preventDefault();
  take(draft + pasted);
}

function handleBlur(event: FocusEvent) {
  (onblur as ((e: FocusEvent) => void) | undefined)?.(event);
  if (tagsInput.addOnBlur && draft.trim() !== '') take(draft);
}

function handleInput(event: Event & { currentTarget: HTMLInputElement }) {
  (oninput as ((e: Event) => void) | undefined)?.(event);
  draft = event.currentTarget.value;
  tagsInput.clearInvalid();
}

/**
 * Registers the input and gives the group its constraint field: the shared
 * `@texuli/core/form-bridge` input, unnamed (the tag fields submit the tags),
 * carrying `required`, `disabled` and `form`. When the browser rejects the
 * form it focuses this text input; a form reset restores the starting tags.
 */
const register: Attachment<HTMLInputElement> = (node) => {
  tagsInput.setInput(node);
  ref = node;
  const field = untrack(() => {
    const constraint = tagsInput.constraint;
    return createFormBridge(node.ownerDocument, {
      name: '',
      value: constraint.filled ? 'filled' : '',
      required: constraint.required,
      disabled: constraint.disabled,
      ...(constraint.form ? { form: constraint.form } : {}),
      focusTarget: node,
      onReset: () => tagsInput.resetTags(),
    });
  });
  field.input.removeAttribute('name');
  node.after(field.input);
  $effect(() => {
    const constraint = tagsInput.constraint;
    field.setValue(constraint.filled ? 'filled' : '');
    field.input.required = constraint.required;
    field.input.disabled = constraint.disabled;
  });
  return () => {
    field.dispose();
    tagsInput.setInput(null);
  };
};
const registerKey = createAttachmentKey();

const partProps = $derived({
  autocomplete: 'off' as const,
  ...rest,
  type: 'text' as const,
  value: draft,
  disabled: tagsInput.disabled || undefined,
  'aria-invalid': tagsInput.invalid ? ('true' as const) : undefined,
  'data-invalid': tagsInput.invalid ? '' : undefined,
  onkeydown: handleKeydown,
  onpaste: handlePaste,
  onblur: handleBlur,
  oninput: handleInput,
  [registerKey]: register,
});
</script>

{#if child}
  {@render child({ props: partProps })}
{:else}
  <input {...partProps} />
{/if}
