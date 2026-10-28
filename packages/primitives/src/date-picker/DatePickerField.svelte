<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { DateField } from '../date-field/index.ts';
import { getShell, getSingle } from './shared.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** The field's group label (visible to assistive technology). */
  label: string;
  /** Submits the value with a form under this name. */
  name?: string;
  required?: boolean;
};

let { label, name, required = false, ...rest }: Props = $props();
const shell = getShell();
const single = getSingle();
</script>

<DateField.Root
  {...rest}
  value={single.value}
  onValueChange={(next) => single.setValue(next)}
  locale={shell.locale}
  {label}
  {...name ? { name } : {}}
  {required}
  disabled={shell.disabled}
  {...shell.minValue ? { min: shell.minValue } : {}}
  {...shell.maxValue ? { max: shell.maxValue } : {}}
  {...shell.onInvalid ? { onInvalid: shell.onInvalid } : {}}
/>
