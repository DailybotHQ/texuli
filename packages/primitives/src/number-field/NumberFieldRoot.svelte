<script lang="ts">
import { createFormBridge, type FormBridge } from '@texuli/core/form-bridge';
import { type Snippet, untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { ChildSnippet } from '../internal/child.ts';
import { type NumberFieldContextValue, numberFieldContext } from './context.ts';
import {
  clampNumber,
  formatNumber,
  largeStepNumber,
  type NumberFormatOptions,
  parseNumber,
  snapToStep,
  stepNumber,
} from './number.ts';

/**
 * NumberField: a locale-aware number input with steppers (APG spinbutton).
 * The value is a `number` or `null` (empty); the input shows it formatted
 * for `locale` and parses what people type back into a number on commit.
 */
type NumberFieldRootProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  value?: number | null;
  defaultValue?: number | null;
  min?: number;
  max?: number;
  step?: number;
  /** PageUp/PageDown step (default `step × 10`). */
  largeStep?: number;
  /** Snap committed values to the step grid from `min` (default `false`: clamp only). */
  snapOnStep?: boolean;
  locale?: string;
  formatOptions?: NumberFormatOptions;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  /** Mouse-wheel stepping while the input has focus (default `false`). */
  allowWheel?: boolean;
  /** Submits the number (not the formatted text) under this name, through a native form bridge. */
  name?: string;
  form?: string;
  /** Base id; the input gets `<id>-input`. */
  id?: string;
  incrementLabel?: string;
  decrementLabel?: string;
  onValueChange?: (value: number | null) => void;
  child?: ChildSnippet<Record<string, unknown>>;
  children?: Snippet;
};

let {
  value = $bindable(),
  defaultValue = null,
  min,
  max,
  step = 1,
  largeStep,
  snapOnStep = false,
  locale,
  formatOptions,
  disabled = false,
  readOnly = false,
  required = false,
  allowWheel = false,
  name,
  form,
  id,
  incrementLabel = 'Increase',
  decrementLabel = 'Decrease',
  onValueChange,
  child,
  children,
  ...rest
}: NumberFieldRootProps = $props();

const generatedId = $props.id();
const base = $derived(id ?? generatedId);
/** A consumer id claimed by the input; it wins over the derived one. */
let claimedIds = $state<{ input?: string }>({});
// svelte-ignore state_referenced_locally -- the initial value seeds uncontrolled mode once.
let localValue = $state<number | null>(value ?? defaultValue);
const current = $derived(value === undefined ? localValue : value);
let draft = $state<string | null>(null);
let inputElement = $state<HTMLInputElement | null>(null);

const safeStep = $derived(step > 0 && Number.isFinite(step) ? step : 1);
const valueText = $derived(formatNumber(current, locale, formatOptions));

function setValue(next: number | null): void {
  if (disabled || readOnly) return;
  const normalized =
    next === null
      ? null
      : clampNumber(snapOnStep ? snapToStep(next, safeStep, min) : next, min, max);
  draft = null;
  if (Object.is(normalized, current)) return;
  localValue = normalized;
  value = normalized;
  onValueChange?.(normalized);
}

function commit(): void {
  if (draft === null) return;
  const parsed = parseNumber(draft, locale, formatOptions);
  if (parsed.ok) setValue(parsed.value);
  draft = null;
}

const context: NumberFieldContextValue = {
  get inputId() {
    return claimedIds.input || `${base}-input`;
  },
  claimId(part, claimed) {
    claimedIds[part] = claimed || undefined;
  },
  get value() {
    return current;
  },
  get inputText() {
    return draft ?? valueText;
  },
  get min() {
    return min;
  },
  get max() {
    return max;
  },
  get step() {
    return safeStep;
  },
  get largeStep() {
    return largeStep && largeStep > 0 ? largeStep : safeStep * 10;
  },
  get locale() {
    return locale;
  },
  get formatOptions() {
    return formatOptions;
  },
  get disabled() {
    return disabled;
  },
  get readOnly() {
    return readOnly;
  },
  get required() {
    return required;
  },
  get allowWheel() {
    return allowWheel;
  },
  get canIncrement() {
    return !disabled && !readOnly && (max === undefined || current === null || current < max);
  },
  get canDecrement() {
    return !disabled && !readOnly && (min === undefined || current === null || current > min);
  },
  get incrementLabel() {
    return incrementLabel;
  },
  get decrementLabel() {
    return decrementLabel;
  },
  get valueText() {
    return valueText;
  },
  setDraft(text) {
    if (!disabled && !readOnly) draft = text;
  },
  commit,
  stepBy(direction, large = false) {
    commit();
    const options = { step: safeStep, min, max };
    setValue(
      large
        ? largeStepNumber(current, direction, context.largeStep, options)
        : stepNumber(current, direction, options)
    );
  },
  toBound(bound) {
    const target = bound === 'min' ? min : max;
    if (target !== undefined) setValue(target);
  },
  setInputElement(element) {
    inputElement = element;
  },
  focusInput() {
    inputElement?.focus({ preventScroll: true });
  },
};
numberFieldContext.set(context);

// Native form participation: the number, not the formatted text. The
// bridge input sits right after the visible input, inside the field.
let bridge: FormBridge | null = null;
$effect(() => {
  const input = inputElement;
  if (!input || !name) return;
  const created = createFormBridge(input.ownerDocument, {
    name,
    value: untrack(() => (current === null ? '' : String(current))),
    required,
    disabled,
    ...(form ? { form } : {}),
    focusTarget: input,
    onReset: (reset) => setValue(reset === '' ? null : Number(reset)),
  });
  input.after(created.input);
  bridge = created;
  return () => {
    created.dispose();
    bridge = null;
  };
});
$effect(() => {
  const submitted = current === null ? '' : String(current);
  bridge?.setValue(submitted);
});

const rootProps = $derived({
  ...rest,
  id: base,
  'data-disabled': disabled ? '' : undefined,
  'data-readonly': readOnly ? '' : undefined,
  'data-required': required ? '' : undefined,
  'data-empty': current === null ? '' : undefined,
});
</script>

{#if child}
  {@render child({ props: rootProps })}
{:else}
  <div {...rootProps}>{@render children?.()}</div>
{/if}
