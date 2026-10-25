<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';
import type { ChildSnippet } from '../internal/child.ts';
import * as Popover from '../popover/index.ts';
import { getShell } from './shared.ts';

type Props = Omit<HTMLButtonAttributes, 'children'> & {
  children?: Snippet;
  child?: ChildSnippet<Record<string, unknown>>;
};

let { children, child, ...rest }: Props = $props();
const shell = getShell();
</script>

<!-- APG date picker: the button names the dialog it opens and the date it holds. -->
<Popover.Trigger
  {...rest}
  aria-label={rest['aria-label'] ?? shell.triggerLabel}
  disabled={shell.disabled || rest.disabled}
  data-tx-date-picker-trigger={shell.id}
  {...child ? { child } : {}}
>
  {@render children?.()}
</Popover.Trigger>
