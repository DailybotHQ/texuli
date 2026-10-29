<script lang="ts">
import { type Snippet, untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { ChildSnippet } from '../internal/child.ts';
import type { RefProp } from '../internal/ref.ts';
import { fieldDataAttributes } from './attributes.ts';
import { type FieldContextValue, fieldContext } from './context.ts';

/**
 * Field: one form control with its label, description and error. It owns
 * the ids and tells every part what to say; parts read it from context.
 */
type FieldRootProps = HTMLAttributes<HTMLDivElement> & {
  /** Base id; parts derive `-control`, `-label`, `-description`, `-error`. */
  id?: string;
  invalid?: boolean;
  disabled?: boolean;
  required?: boolean;
  child?: ChildSnippet<Record<string, unknown>>;
  children?: Snippet;
};

let {
  id,
  invalid = false,
  disabled = false,
  required = false,
  child,
  children,
  ref = $bindable(null),
  ...rest
}: FieldRootProps & RefProp = $props();

const generatedId = $props.id();
let descriptions = $state(0);
let errors = $state(0);
const base = $derived(id ?? generatedId);
/** Consumer ids claimed by parts; they win over the derived ones. */
let claimedIds = $state<{ control?: string; label?: string; description?: string; error?: string }>(
  {}
);

/**
 * Registration for mounted parts. `untrack`: the parts call this from an
 * effect, and the count must not become a dependency of that effect (it
 * would re-run on its own change).
 */
function counter(change: (delta: number) => void): () => () => void {
  return () => {
    untrack(() => change(1));
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      untrack(() => change(-1));
    };
  };
}

const context: FieldContextValue = {
  get controlId() {
    return claimedIds.control || `${base}-control`;
  },
  get labelId() {
    return claimedIds.label || `${base}-label`;
  },
  get descriptionId() {
    return claimedIds.description || `${base}-description`;
  },
  get errorId() {
    return claimedIds.error || `${base}-error`;
  },
  claimId(part, claimed) {
    claimedIds[part] = claimed || undefined;
  },
  get invalid() {
    return invalid;
  },
  get disabled() {
    return disabled;
  },
  get required() {
    return required;
  },
  get hasDescription() {
    return descriptions > 0;
  },
  get hasError() {
    return errors > 0;
  },
  registerDescription: counter((delta) => (descriptions += delta)),
  registerError: counter((delta) => (errors += delta)),
};
fieldContext.set(context);

const rootProps = $derived({
  ...rest,
  id: base,
  ...fieldDataAttributes({ invalid, disabled, required }),
});
</script>

{#if child}
  {@render child({ props: rootProps })}
{:else}
  <div bind:this={ref} {...rootProps}>{@render children?.()}</div>
{/if}
