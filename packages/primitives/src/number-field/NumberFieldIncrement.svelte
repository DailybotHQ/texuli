<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';
import type { ChildSnippet } from '../internal/child.ts';
import NumberFieldStepper from './NumberFieldStepper.svelte';

/** Steps the value up (`step`); press and hold to repeat. */
let props: HTMLButtonAttributes & {
  child?: ChildSnippet<Record<string, unknown>>;
  children?: Snippet;
} = $props();
</script>

<NumberFieldStepper {...props} direction={1} />
