<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { DateField } from '../date-field/index.ts';
import { getRange, getShell } from './shared.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** Names the pair of fields (role="group"). */
  label: string;
  /** Form names for the start and the end. */
  startName?: string;
  endName?: string;
};

let { label, startName, endName, ...rest }: Props = $props();
const shell = getShell();
const range = getRange();
</script>

<div {...rest} role="group" aria-label={label} data-tx-date-range-field>
  <DateField.Root
    value={range.start}
    onValueChange={(next) => range.setStart(next)}
    locale={shell.locale}
    label={shell.labels.start}
    {...startName ? { name: startName } : {}}
    disabled={shell.disabled}
    {...shell.minValue ? { min: shell.minValue } : {}}
    {...range.end ? { max: range.end } : shell.maxValue ? { max: shell.maxValue } : {}}
  />
  <span aria-hidden="true" data-tx-date-range-separator>–</span>
  <DateField.Root
    value={range.end}
    onValueChange={(next) => range.setEnd(next)}
    locale={shell.locale}
    label={shell.labels.end}
    {...endName ? { name: endName } : {}}
    disabled={shell.disabled}
    {...range.start ? { min: range.start } : shell.minValue ? { min: shell.minValue } : {}}
    {...shell.maxValue ? { max: shell.maxValue } : {}}
  />
</div>
