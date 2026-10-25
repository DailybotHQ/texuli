<script lang="ts">
import { type Snippet, untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { fieldContext } from './context.ts';

/**
 * The error message. Its container stays mounted as a polite live region,
 * so the message is announced when the field turns invalid; the content and
 * the control's reference to it exist only while the field is invalid
 * (unless `forceMount` keeps the content for an exit animation).
 */
type FieldErrorProps = HTMLAttributes<HTMLElement> & {
  forceMount?: boolean;
  /** Renders the error element: spread `props`; render the message when `show`. */
  child?: Snippet<[{ props: Record<string, unknown>; show: boolean }]>;
  children?: Snippet;
};

let { forceMount = false, child, children, ...rest }: FieldErrorProps = $props();
const field = fieldContext.get();
// A consumer id wins: the context records it, so every reference follows.
field.claimId(
  'error',
  untrack(() => rest.id)
);
$effect(() => {
  field.claimId('error', rest.id);
  return () => field.claimId('error', undefined);
});
$effect(() => field.registerError());

const show = $derived(field.invalid || forceMount);
const partProps = $derived({
  ...rest,
  id: field.errorId,
  'aria-live': 'polite' as const,
  'data-field-error': '',
  'data-state': field.invalid ? 'invalid' : 'valid',
});
</script>

{#if child}
  {@render child({ props: partProps, show })}
{:else}
  <p {...partProps}>{#if show}{@render children?.()}{/if}</p>
{/if}
