<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';
import type { ChildSnippet } from '../internal/child.ts';
import type { RefProp } from '../internal/ref.ts';
import NumberFieldStepper from './NumberFieldStepper.svelte';

/** Steps the value down (`step`); press and hold to repeat. */
let {
  ref = $bindable(null),
  ...props
}: RefProp &
  HTMLButtonAttributes & {
    child?: ChildSnippet<Record<string, unknown>>;
    children?: Snippet;
  } = $props();
</script>

<NumberFieldStepper bind:ref {...props} direction={-1} />
