<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLInputAttributes } from 'svelte/elements';
import {
  acceptsValue,
  clampLength,
  type PinCell,
  pastedValue,
  pinCells,
  REGEXP_ONLY_DIGITS,
} from './pin-input.ts';

type RootProps = Omit<
  HTMLInputAttributes,
  'value' | 'children' | 'maxlength' | 'pattern' | 'type' | 'class'
> & {
  /** The code (`bind:value`). */
  value?: string;
  onValueChange?: (value: string) => void;
  /** Number of cells (1–32, default 6). */
  maxlength?: number;
  /** Whole-value pattern, for example `REGEXP_ONLY_DIGITS`. Omitted: any characters. */
  pattern?: string;
  /** Cleans pasted text before it is checked (default: remove whitespace). */
  pasteTransformer?: (text: string) => string;
  /** Runs when the last cell is filled. */
  onComplete?: (value: string) => void;
  disabled?: boolean;
  /** Id of the real input, for an external `<label for>` (`id` works too). */
  inputId?: string;
  /** The real input element (`bind:inputRef`). */
  inputRef?: HTMLInputElement | null;
  /** Show `•` in the cells and use a password input. */
  mask?: boolean;
  /** Class of the container. */
  class?: string;
  children?: Snippet<[{ cells: PinCell[]; isFocused: boolean; isHovering: boolean }]>;
};

let {
  value = $bindable(''),
  onValueChange,
  maxlength = 6,
  pattern,
  pasteTransformer,
  onComplete,
  disabled = false,
  inputId,
  inputRef = $bindable(null),
  mask = false,
  class: className,
  children,
  inputmode,
  autocomplete = 'one-time-code',
  ...rest
}: RootProps = $props();

const generatedId = $props.id();
const length = $derived(clampLength(maxlength));
const rules = $derived({ maxlength: length, pattern });
let isFocused = $state(false);
let isHovering = $state(false);
let selection = $state({ start: 0, end: 0 });
const cells = $derived(pinCells(value ?? '', { ...rules, mask }, isFocused ? selection : null));
const complete = $derived((value ?? '').length === length);

function readSelection(): void {
  if (!inputRef) return;
  selection = {
    start: inputRef.selectionStart ?? inputRef.value.length,
    end: inputRef.selectionEnd ?? inputRef.value.length,
  };
}

function caretTo(position: number): void {
  if (!inputRef) return;
  inputRef.setSelectionRange(position, position);
  readSelection();
}

function commit(next: string): void {
  const previous = value ?? '';
  if (next === previous) return;
  value = next;
  onValueChange?.(next);
  if (next.length === length) onComplete?.(next);
}

function onInput(event: Event): void {
  const input = event.currentTarget as HTMLInputElement;
  const next = input.value;
  if (!acceptsValue(next, rules)) {
    // Refused (wrong character or too long): put back what was there.
    const caret = Math.max(
      0,
      (input.selectionStart ?? next.length) - (next.length - (value ?? '').length)
    );
    input.value = value ?? '';
    caretTo(Math.min(caret, input.value.length));
    return;
  }
  commit(next);
  readSelection();
}

function onPaste(event: ClipboardEvent): void {
  event.preventDefault();
  if (disabled || !inputRef) return;
  const text = event.clipboardData?.getData('text') ?? '';
  const current = value ?? '';
  const next = pastedValue(
    current,
    text,
    {
      start: inputRef.selectionStart ?? current.length,
      end: inputRef.selectionEnd ?? current.length,
    },
    rules,
    pasteTransformer
  );
  if (next === null) return;
  inputRef.value = next;
  commit(next);
  caretTo(next.length);
}

// A click or tap lands on a cell: put the caret there (never past the code).
function onPointerUp(event: PointerEvent): void {
  if (!inputRef || disabled) return;
  const box = inputRef.getBoundingClientRect();
  const index =
    box.width > 0 ? Math.floor(((event.clientX - box.left) / box.width) * length) : length;
  caretTo(Math.max(0, Math.min(index, (value ?? '').length)));
}
</script>

<div
  class={className}
  data-pin-input-root=""
  data-state={complete ? 'complete' : 'incomplete'}
  data-disabled={disabled ? '' : undefined}
  onpointerenter={() => (isHovering = true)}
  onpointerleave={() => (isHovering = false)}
  role="presentation"
>
  <input
    bind:this={inputRef}
    {...rest}
    id={inputId ?? rest.id ?? generatedId}
    class="tx-pin-input__input"
    type={mask ? 'password' : 'text'}
    inputmode={inputmode ?? (pattern === REGEXP_ONLY_DIGITS ? 'numeric' : 'text')}
    {autocomplete}
    autocapitalize="off"
    spellcheck="false"
    maxlength={length}
    value={value ?? ''}
    {disabled}
    data-state={complete ? 'complete' : 'incomplete'}
    oninput={onInput}
    onpaste={onPaste}
    onfocus={() => {
      isFocused = true;
      caretTo((value ?? '').length);
    }}
    onblur={() => (isFocused = false)}
    onselect={readSelection}
    onkeyup={readSelection}
    onpointerup={onPointerUp}
  />
  {@render children?.({ cells, isFocused, isHovering })}
</div>

<style>
  [data-pin-input-root] {
    position: relative;
  }
  /* The real input covers the cells: it takes focus, typing, paste, autofill
     and touch, while the cells draw the code. Its own text stays invisible. */
  .tx-pin-input__input {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: transparent;
    caret-color: transparent;
    font: inherit;
    letter-spacing: -0.5em;
    outline: none;
    opacity: 0.001;
  }
</style>
