<script lang="ts">
import { untrack } from 'svelte';
import { createAttachmentKey } from 'svelte/attachments';
import type { HTMLInputAttributes } from 'svelte/elements';
import { type ChildSnippet, composeChildProps } from '../internal/child.ts';
import type { RefProp } from '../internal/ref.ts';
import { numberFieldContext } from './context.ts';
import { inputModeFor, isPartialNumber } from './number.ts';

/**
 * The spinbutton (APG): ArrowUp/ArrowDown step, PageUp/PageDown step by
 * `largeStep`, Home/End go to min/max. Typing edits a draft that commits
 * (parsed for the locale, clamped) on Enter or blur; keystrokes that cannot
 * lead to a number are refused. Name it with a label (`for` its id) or
 * `aria-label`.
 */
type NumberFieldInputProps = Omit<HTMLInputAttributes, 'value' | 'type'> & {
  child?: ChildSnippet<Record<string, unknown>>;
};

let { child, ref = $bindable(null), ...rest }: NumberFieldInputProps & RefProp = $props();
const field = numberFieldContext.get();
// A consumer id wins: the context records it, so every reference follows.
field.claimId(
  'input',
  untrack(() => rest.id)
);
$effect(() => {
  field.claimId('input', rest.id);
  return () => field.claimId('input', undefined);
});

function attachInput(node: HTMLInputElement) {
  field.setInputElement(node);
  return () => field.setInputElement(null);
}
/** Spread with `{...props}`, so a `child` element registers itself too. */
const attachKey = createAttachmentKey();

function onkeydown(event: KeyboardEvent) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
  switch (event.key) {
    case 'ArrowUp':
      field.stepBy(1);
      break;
    case 'ArrowDown':
      field.stepBy(-1);
      break;
    case 'PageUp':
      field.stepBy(1, true);
      break;
    case 'PageDown':
      field.stepBy(-1, true);
      break;
    case 'Home':
      if (field.min === undefined) return;
      field.toBound('min');
      break;
    case 'End':
      if (field.max === undefined) return;
      field.toBound('max');
      break;
    case 'Enter':
      field.commit();
      return;
    default:
      return;
  }
  event.preventDefault();
}

function onbeforeinput(event: InputEvent) {
  if (!event.data || !event.inputType.startsWith('insert')) return;
  const input = event.currentTarget as HTMLInputElement;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  const next = input.value.slice(0, start) + event.data + input.value.slice(end);
  if (!isPartialNumber(next, field.locale, field.formatOptions)) event.preventDefault();
}

function oninput(event: Event) {
  field.setDraft((event.currentTarget as HTMLInputElement).value);
}

function onwheel(event: WheelEvent) {
  const input = event.currentTarget as HTMLInputElement;
  if (!field.allowWheel || input.ownerDocument.activeElement !== input || event.deltaY === 0)
    return;
  event.preventDefault();
  field.stepBy(event.deltaY < 0 ? 1 : -1);
}

const baseProps = $derived({
  id: field.inputId,
  type: 'text' as const,
  role: 'spinbutton' as const,
  inputmode: inputModeFor(field.step, field.min, field.formatOptions),
  autocomplete: 'off' as const,
  autocorrect: 'off' as const,
  spellcheck: false,
  value: field.inputText,
  'aria-valuenow': field.value ?? undefined,
  'aria-valuetext': field.value === null ? undefined : field.valueText,
  'aria-valuemin': field.min,
  'aria-valuemax': field.max,
  'aria-required': field.required ? ('true' as const) : undefined,
  disabled: field.disabled || undefined,
  readonly: field.readOnly || undefined,
  'data-disabled': field.disabled ? '' : undefined,
  'data-readonly': field.readOnly ? '' : undefined,
  onkeydown,
  onbeforeinput,
  oninput,
  onblur: () => field.commit(),
  onwheel,
});
// Spinbutton semantics and the value stay owned by the field.
const inputProps = $derived({
  ...composeChildProps(baseProps, rest as Partial<typeof baseProps>),
  role: 'spinbutton' as const,
  id: field.inputId,
  value: field.inputText,
  'aria-valuenow': baseProps['aria-valuenow'],
  'aria-valuetext': baseProps['aria-valuetext'],
  'aria-valuemin': baseProps['aria-valuemin'],
  'aria-valuemax': baseProps['aria-valuemax'],
});
</script>

{#if child}
  {@render child({ props: { ...inputProps, [attachKey]: attachInput } })}
{:else}
  <input bind:this={ref} {...inputProps} {@attach attachInput} />
{/if}
