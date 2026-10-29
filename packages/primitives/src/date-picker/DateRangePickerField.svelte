<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { DateField } from '../date-field/index.ts';
import type { RefProp } from '../internal/ref.ts';
import { getRange, getShell } from './shared.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** Names the pair of fields (role="group"). */
  label: string;
  /** Form names for the start and the end. */
  startName?: string;
  endName?: string;
  /** Id of the start field's first segment, for a `<label for>` or a Field. */
  inputId?: string;
  /** Both the start and the end must be filled (`required` on every segment). */
  required?: boolean;
} & RefProp;

let {
  label,
  startName,
  endName,
  inputId,
  required = false,
  ref = $bindable(null),
  ...rest
}: Props = $props();
// A description and an invalid state reach every segment, where focus lands.
const segmentAria = $derived({
  'aria-describedby': rest['aria-describedby'],
  'aria-invalid': rest['aria-invalid'],
});
const shell = getShell();
const range = getRange();
// A refusal says which field caused it.
const invalidFor = (side: 'start' | 'end') => {
  const report = shell.onInvalid;
  return report
    ? {
        onInvalid: (text: string, reason: 'invalid' | 'out-of-range') =>
          report(text, reason, { side }),
      }
    : {};
};
</script>

<div bind:this={ref} {...rest} role="group" aria-label={rest['aria-label'] ?? label} data-tx-date-range-field>
  <DateField.Root
    {...segmentAria}
    {inputId}
    value={range.start}
    onValueChange={(next) => range.setStart(next)}
    locale={shell.locale}
    label={shell.labels.start}
    {...startName ? { name: startName } : {}}
    disabled={shell.disabled}
    {...shell.minValue ? { min: shell.minValue } : {}}
    {...range.end ? { max: range.end } : shell.maxValue ? { max: shell.maxValue } : {}}
    {...invalidFor('start')}
    {required}
  />
  <span aria-hidden="true" data-tx-date-range-separator>–</span>
  <DateField.Root
    {...segmentAria}
    value={range.end}
    onValueChange={(next) => range.setEnd(next)}
    locale={shell.locale}
    label={shell.labels.end}
    {...endName ? { name: endName } : {}}
    disabled={shell.disabled}
    {...range.start ? { min: range.start } : shell.minValue ? { min: shell.minValue } : {}}
    {...shell.maxValue ? { max: shell.maxValue } : {}}
    {...invalidFor('end')}
    {required}
  />
</div>
