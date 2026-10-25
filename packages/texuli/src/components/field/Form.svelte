<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLFormAttributes } from 'svelte/elements';
import { type ClassValue, cx } from '../../internal/cx.ts';
import {
  applyNativeCustomValidity,
  clearNativeCustomValidity,
  type FieldErrorMap,
  formDataToRecord,
  isValidErrorMap,
  setNativeCustomValidity,
  toFieldErrorMap,
  type ValidateResult,
} from './form-utils.ts';
import { formClass } from './variants.ts';
import './field.css';

type Props = Omit<HTMLFormAttributes, 'onsubmit' | 'children'> & {
  /** Stack or responsive grid of fields. */
  layout?: 'stack' | 'grid';
  /** Skip browser native constraint validation (still runs `onValidate`). */
  noValidate?: boolean;
  /**
   * Schema-agnostic validate hook. Return a field→message map (or Promise)
   * to block submit and surface errors. Empty map / null / undefined = ok.
   */
  onValidate?: (
    values: Record<string, string>,
    form: HTMLFormElement
  ) => ValidateResult | Promise<ValidateResult>;
  /** Called after validation succeeds, with FormData values. */
  onSubmitValues?: (
    values: Record<string, string>,
    event: SubmitEvent & { currentTarget: HTMLFormElement }
  ) => void | Promise<void>;
  /** Controlled error map from the parent (merged after validate). */
  errors?: FieldErrorMap;
  onErrorsChange?: (errors: FieldErrorMap) => void;
  class?: ClassValue;
  children?: Snippet;
  /** Form-level error slot (e.g. `_form` message). */
  formError?: Snippet<[string | undefined]>;
};

let {
  layout = 'stack',
  noValidate = false,
  onValidate,
  onSubmitValues,
  errors = $bindable({}),
  onErrorsChange,
  class: className,
  children,
  formError,
  ...rest
}: Props = $props();

let formEl = $state<HTMLFormElement | null>(null);
let busy = $state(false);

const classes = $derived(cx(formClass({ layout }), className));
const formLevelError = $derived(errors._form);

async function handleSubmit(
  event: SubmitEvent & { currentTarget: HTMLFormElement }
): Promise<void> {
  event.preventDefault();
  if (busy) return;
  const form = event.currentTarget;
  if (!noValidate && !form.checkValidity()) {
    form.reportValidity();
    return;
  }
  busy = true;
  try {
    clearNativeCustomValidity(form);
    const values = formDataToRecord(form);
    const raw = onValidate ? await onValidate(values, form) : null;
    const next = toFieldErrorMap(raw);
    errors = next;
    onErrorsChange?.(next);
    if (!isValidErrorMap(next)) {
      applyNativeCustomValidity(form, next);
      form.reportValidity();
      return;
    }
    await onSubmitValues?.(values, event);
  } finally {
    busy = false;
  }
}
/**
 * A control's message from a failed submit is stale once the user edits it.
 * Clear it then: the browser checks constraints before `submit` fires, so a
 * stale message would otherwise block every later submit.
 */
function handleInput(event: Event & { currentTarget: EventTarget & HTMLFormElement }): void {
  const target = event.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    setNativeCustomValidity(target, '');
  }
  rest.oninput?.(event as never);
}
</script>

<form
  bind:this={formEl}
  class={classes}
  data-tx-form=""
  data-busy={busy ? '' : undefined}
  novalidate={noValidate || undefined}
  onsubmit={handleSubmit}
  {...rest}
  oninput={handleInput}
>
  {#if formLevelError}
    {#if formError}
      {@render formError(formLevelError)}
    {:else}
      <p class="tx-form__error" role="alert" data-tx-form-error="">{formLevelError}</p>
    {/if}
  {/if}
  {@render children?.()}
</form>
