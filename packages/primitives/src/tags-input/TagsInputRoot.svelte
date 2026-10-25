<script lang="ts">
import { untrack } from 'svelte';
import { type Attachment, createAttachmentKey } from 'svelte/attachments';
import { tagsInputContext, visuallyHidden } from './context.ts';
import { DEFAULT_TAGS_INPUT_LABELS } from './labels.ts';
import { addTags, splitTags } from './tags.ts';
import type { TagsInputRootProps } from './types.ts';

/**
 * Tags input root: a labelled group holding the tag list and one text input.
 * It owns the tags, applies the rules (duplicates, max, validate), announces
 * every change in a polite live region, and submits one field per tag.
 */
let {
  value = $bindable([]),
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
  child,
  children,
  ref = $bindable(null),
  ...rest
}: TagsInputRootProps = $props();

const text = $derived({ ...DEFAULT_TAGS_INPUT_LABELS, ...labels });
const tags = $derived(Array.isArray(value) ? value : []);
// A form reset goes back to the tags the input started with.
const initial = untrack(() => [...tags]);

let message = $state('');
let invalid = $state(false);
let root: HTMLElement | null = null;
let input: HTMLInputElement | null = null;

/** Clear first, then set, so the same message is read again. */
function announce(said: string) {
  message = '';
  queueMicrotask(() => {
    message = said;
  });
}

function commit(next: string[], said: string) {
  value = next;
  onValueChange?.(next);
  announce(said);
}

function tagElement(index: number): HTMLElement | null {
  return (
    root?.querySelector<HTMLElement>(`[data-tx-tags-input-tag][data-index="${index}"]`) ?? null
  );
}

function add(raw: string): boolean {
  if (disabled) return false;
  const candidates = splitTags(raw, delimiter);
  if (candidates.length === 0) return raw.trim() === '';
  const decision = addTags(tags, candidates, { delimiter, allowDuplicates, max, validate });
  const notes: string[] = decision.added.map((tag) => text.added(tag));
  for (const refused of decision.rejected) {
    onInvalid?.(refused);
    notes.push(
      refused.message ??
        (refused.reason === 'duplicate'
          ? text.duplicate(refused.tag)
          : refused.reason === 'max'
            ? text.max(max)
            : text.invalid(refused.tag))
    );
  }
  invalid = decision.rejected.length > 0;
  if (decision.added.length > 0) commit(decision.tags, notes.join('. '));
  else announce(notes.join('. '));
  // Keep a refused draft so it can be corrected; use up accepted text.
  return decision.rejected.length === 0;
}

function remove(index: number, focus: 'previous' | 'next' | 'input') {
  const removed = tags[index];
  if (disabled || removed === undefined) return;
  const next = tags.filter((_, i) => i !== index);
  commit(next, text.removed(removed));
  invalid = false;
  // Focus after the list re-renders.
  queueMicrotask(() => {
    const target = focus === 'previous' ? index - 1 : focus === 'next' ? index : -1;
    if (target >= 0 && target < next.length) tagElement(target)?.focus();
    else input?.focus();
  });
}

tagsInputContext.set({
  get tags() {
    return tags;
  },
  get disabled() {
    return disabled;
  },
  get invalid() {
    return invalid;
  },
  get labels() {
    return text;
  },
  get delimiterKey() {
    return typeof delimiter === 'string' && delimiter.length === 1 ? delimiter : undefined;
  },
  get addOnPaste() {
    return addOnPaste;
  },
  get addOnBlur() {
    return addOnBlur;
  },
  add,
  remove,
  focusTag: (index) => tagElement(index)?.focus(),
  focusInput: () => input?.focus(),
  setInput(node) {
    input = node;
  },
  clearInvalid() {
    invalid = false;
  },
  get constraint() {
    return { required, disabled, form, filled: tags.length > 0 };
  },
  resetTags() {
    commit([...initial], '');
  },
});

const attach: Attachment<HTMLElement> = (node) => {
  root = node;
  ref = node;
  return () => {
    root = null;
  };
};
const attachKey = createAttachmentKey();

const partProps = $derived({
  ...rest,
  role: 'group',
  'data-tx-tags-input-root': '',
  'data-disabled': disabled ? '' : undefined,
  'data-invalid': invalid ? '' : undefined,
  [attachKey]: attach,
});
</script>

{#if child}
  {@render child({ props: partProps })}
{:else}
  <div {...partProps}>{@render children?.({ tags: [...tags] })}</div>
{/if}
<!-- Outside the root, so a child-snippet root still submits and announces. -->
{#if name}
  {#each tags as tag, index (index)}<input type="hidden" {name} {form} value={tag} {disabled} />{/each}
{/if}
<span role="status" {@attach visuallyHidden}>{message}</span>
