<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import * as Popover from '../popover/index.ts';
import { getShell } from './shared.ts';

type Props = Omit<HTMLAttributes<HTMLElement>, 'children'> & { children?: Snippet };

let { children, ...rest }: Props = $props();
const shell = getShell();
let content: HTMLElement | undefined;

/**
 * APG date picker dialog: opening focuses the day the calendar starts on,
 * which is the selected date (the range start), else today, else the first
 * enabled day; that day carries the grid's roving tab stop.
 */
function startDay(): HTMLElement | null {
  return content?.querySelector<HTMLElement>('[data-calendar-date][tabindex="0"]') ?? null;
}
</script>

<!-- A dialog (role="dialog") named for choosing a date. -->
<Popover.Content
  {...rest}
  aria-label={rest['aria-label'] ?? shell.labels.dialog}
  data-tx-date-picker-content
  initialFocus={startDay}
  {@attach (node) => {
    content = node;
    return () => {
      content = undefined;
    };
  }}
>
  {@render children?.()}
</Popover.Content>
