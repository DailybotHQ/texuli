<script lang="ts">
import { localizeLabels } from '@texuli/core/i18n';
import { untrack } from 'svelte';
import { useMessages } from 'texuli/i18n';
import {
  applyCodeFieldEdit,
  CODE_FIELD_HIGHLIGHT_LIMIT,
  CODE_FIELD_SYNC_LIMIT,
  type CodeFieldEdit,
  type CodeFieldProps,
  DEFAULT_CODE_FIELD_LABELS,
  indentEdit,
  indentUnit,
  newlineEdit,
  resolveCodeFieldLabels,
} from './code-field.ts';
import { resolveCodeLanguage } from './grammars.ts';
import { codeTokenClass } from './token-styles.ts';
import { tokenizeCode } from './tokenize-code.ts';
import { type CodeToken, splitTokenLines } from './tokenizer.ts';
import './code.css';
import './code-field.css';

/**
 * An editable, syntax-highlighted code field. A real `<textarea>` holds the
 * text, the caret, the selection, undo and the form value; its text is
 * transparent and sits over an `aria-hidden` `<pre>` that prints the same
 * text as token spans (elements and text nodes, never HTML). Both share one
 * font, padding, wrapping and tab size, and the overlay follows the
 * textarea's scroll. Tab indents; Escape, then Tab, leaves the field.
 */
let {
  value = $bindable(''),
  ref = $bindable(null),
  textareaRef = $bindable(null),
  language,
  label,
  labels,
  placeholder,
  readonly = false,
  disabled = false,
  rows = 4,
  wrap = false,
  tabSize = 2,
  indentWith = 'spaces',
  lineNumbers = false,
  highlightLimit = CODE_FIELD_HIGHLIGHT_LIMIT,
  showKeyboardHint = false,
  id,
  class: className,
  style,
  hidden,
  oninput,
  onkeydown,
  onblur,
  onscroll,
  onValueChange,
  'aria-describedby': describedBy,
  ...rest
}: CodeFieldProps = $props();

const uid = $props.id();
const inputId = $derived(id ?? `tx-code-field-${uid}`);
const hintId = `tx-code-field-hint-${uid}`;
const msg = useMessages();
const text = $derived(
  resolveCodeFieldLabels(
    labels,
    localizeLabels(msg, 'blocks.code-field', DEFAULT_CODE_FIELD_LABELS)
  )
);

const tabs = $derived(Number.isFinite(tabSize) ? Math.min(8, Math.max(1, Math.floor(tabSize))) : 2);
const unit = $derived(indentUnit(indentWith, tabs));
const limit = $derived(
  Number.isFinite(highlightLimit)
    ? Math.min(CODE_FIELD_HIGHLIGHT_LIMIT, Math.max(0, Math.floor(highlightLimit)))
    : CODE_FIELD_HIGHLIGHT_LIMIT
);
// A disabled field paints its own text: inactive, with no overlay to keep in step.
const highlighted = $derived(!disabled && value.length <= limit);
const grammar = $derived(language === undefined ? null : resolveCodeLanguage(language));
const capturesTab = $derived(!readonly && !disabled);

/*
 * The text the overlay prints. Short values tokenize on every input; long
 * ones on the next animation frame, which runs before that frame paints, so
 * the overlay never shows stale text yet a burst of inputs tokenizes once.
 */
let deferred = $state<string | null>(null);
const source = $derived(
  value.length <= CODE_FIELD_SYNC_LIMIT || deferred === null ? value : deferred
);
$effect(() => {
  const next = value;
  const current = untrack(() => deferred);
  if (next.length <= CODE_FIELD_SYNC_LIMIT || !highlighted) {
    if (current !== null) deferred = null;
    return;
  }
  if (current === null) {
    deferred = next;
    return;
  }
  if (current === next) return;
  const raf = typeof requestAnimationFrame === 'function';
  const handle = raf
    ? requestAnimationFrame(() => {
        deferred = next;
      })
    : setTimeout(() => {
        deferred = next;
      }, 16);
  return () => {
    if (raf) cancelAnimationFrame(handle as number);
    else clearTimeout(handle as ReturnType<typeof setTimeout>);
  };
});

const tokens = $derived.by((): CodeToken[] => {
  if (!highlighted) return [];
  return tokenizeCode(source, grammar ?? 'text');
});
const lines = $derived(highlighted ? splitTokenLines(tokens) : []);
const numbered = $derived(lineNumbers && highlighted);
const digits = $derived(Math.min(6, Math.max(2, String(lines.length).length)));

/** Escape arms a release: the next Tab moves focus instead of indenting. */
let released = $state(false);

let code = $state<HTMLElement | null>(null);
let gutter = $state<HTMLElement | null>(null);

function follow(area: HTMLTextAreaElement) {
  const x = area.scrollLeft;
  const y = area.scrollTop;
  const shift = x === 0 && y === 0 ? '' : `translate(${-x}px, ${-y}px)`;
  code?.style.setProperty('transform', shift);
  gutter?.style.setProperty('transform', y === 0 ? '' : `translateY(${-y}px)`);
}

// The overlay is rebuilt after an edit; keep it at the textarea's scroll.
$effect(() => {
  void lines;
  if (textareaRef) follow(textareaRef);
});

function handleInput(event: Event & { currentTarget: EventTarget & HTMLTextAreaElement }) {
  // `bind:value` may have stored it already; an input is a change either way.
  value = event.currentTarget.value;
  onValueChange?.(value);
  oninput?.(event as Parameters<NonNullable<typeof oninput>>[0]);
}

/**
 * Applies an edit through the browser's editing commands, so undo and redo
 * keep it; where those are missing, replaces the range and reports an input.
 */
function apply(area: HTMLTextAreaElement, edit: CodeFieldEdit) {
  const expected = applyCodeFieldEdit(area.value, edit);
  area.setSelectionRange(edit.start, edit.end);
  let done = false;
  try {
    done =
      typeof document.execCommand === 'function' &&
      document.execCommand('insertText', false, edit.text) &&
      area.value === expected;
  } catch {
    done = false;
  }
  if (!done) {
    if (area.value !== expected) area.value = expected;
    area.dispatchEvent(new Event('input', { bubbles: true }));
  }
  area.setSelectionRange(edit.selectionStart, edit.selectionEnd);
  follow(area);
}

function ownKeydown(event: KeyboardEvent & { currentTarget: EventTarget & HTMLTextAreaElement }) {
  if (event.isComposing) return;
  const area = event.currentTarget;
  if (event.key === 'Escape') {
    if (capturesTab) released = true;
    return;
  }
  if (event.key === 'Tab') {
    if (!capturesTab || released || event.ctrlKey || event.altKey || event.metaKey) {
      released = false;
      return;
    }
    const edit = indentEdit(
      area.value,
      area.selectionStart,
      area.selectionEnd,
      unit,
      event.shiftKey
    );
    event.preventDefault();
    if (edit) apply(area, edit);
    return;
  }
  if (
    event.key === 'Shift' ||
    event.key === 'Control' ||
    event.key === 'Alt' ||
    event.key === 'Meta'
  ) {
    return;
  }
  released = false;
  if (
    event.key === 'Enter' &&
    capturesTab &&
    !event.shiftKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey
  ) {
    event.preventDefault();
    apply(area, newlineEdit(area.value, area.selectionStart, area.selectionEnd));
  }
}

function handleKeydown(
  event: KeyboardEvent & { currentTarget: EventTarget & HTMLTextAreaElement }
) {
  if (typeof onkeydown === 'function') onkeydown(event);
  if (!event.defaultPrevented) ownKeydown(event);
}

function handleBlur(event: FocusEvent & { currentTarget: EventTarget & HTMLTextAreaElement }) {
  if (typeof onblur === 'function') onblur(event);
  released = false;
}

function handleScroll(event: Event & { currentTarget: EventTarget & HTMLTextAreaElement }) {
  if (typeof onscroll === 'function') onscroll(event as Parameters<typeof onscroll>[0]);
  follow(event.currentTarget);
}

const describedByIds = $derived(
  [describedBy ?? undefined, capturesTab ? hintId : undefined].filter(Boolean).join(' ') ||
    undefined
);
</script>

<div
  bind:this={ref}
  class={['tx-code-field', className]}
  {style}
  {hidden}
  data-tx-code-field=""
  data-lang={language}
  data-grammar={language === undefined ? undefined : (grammar ?? 'none')}
  data-highlight={highlighted ? 'on' : 'off'}
  data-pending={source !== value || undefined}
  data-wrap={wrap ? 'on' : 'off'}
  data-line-numbers={numbered || undefined}
  data-digits={numbered ? digits : undefined}
  data-tab-size={tabs}
  data-tab-released={released || undefined}
  data-readonly={readonly || undefined}
  data-disabled={disabled || undefined}
>
  {#if label}<label class="tx-code-field__label" for={inputId}>{label}</label>{/if}
  <div class="tx-code-field__box" dir="ltr">
    {#if numbered && !wrap}
      <div class="tx-code-field__gutter" aria-hidden="true"><div class="tx-code-field__numbers" bind:this={gutter}>{#each lines, index}<span class="tx-code-field__number">{index + 1}</span>{/each}</div></div>
    {/if}
    <div class="tx-code-field__stack">
      {#if highlighted}
        <!-- Decorative: the textarea above carries the text, the caret and the name. Line numbers are CSS content, never text. -->
        <pre class="tx-code-field__pre" aria-hidden="true"><code class="tx-code-field__code" bind:this={code}>{#each lines as line, index (index)}<span class="tx-code-field__line" data-line={index + 1}><span class="tx-code-field__text">{#each line as token, t (t)}<span class={codeTokenClass(token.kind)}>{token.text}</span>{/each}</span></span>{/each}</code></pre>
      {/if}
      <textarea
        bind:this={textareaRef}
        {...rest}
        id={inputId}
        class="tx-code-field__input"
        bind:value
        {placeholder}
        {readonly}
        {disabled}
        {rows}
        wrap={wrap ? 'soft' : 'off'}
        dir="ltr"
        spellcheck="false"
        autocapitalize="off"
        autocomplete="off"
        translate="no"
        aria-describedby={describedByIds}
        oninput={handleInput}
        onkeydown={handleKeydown}
        onblur={handleBlur}
        onscroll={handleScroll}
      ></textarea>
    </div>
  </div>
  {#if capturesTab}
    <span id={hintId} class={showKeyboardHint ? 'tx-code-field__hint' : 'tx-code__sr-only'}>{text.keyboardHint}</span>
  {/if}
</div>
