<script lang="ts">
import { DatePicker, DateRangePicker, TimeField } from '../../src/components/date/index.ts';
import { Field } from '../../src/components/field/index.ts';

let {
  kind = 'date',
  error,
  controlClass,
}: {
  kind?: 'date' | 'range' | 'time';
  /** The Field's error: it marks the control invalid through `aria-invalid`. */
  error?: string;
  controlClass?: string;
} = $props();
</script>

<Field label="Due" {error}>
  {#snippet children(control)}
    {#if kind === 'date'}
      <DatePicker {...control.props} label="Due" {controlClass} />
    {:else if kind === 'range'}
      <DateRangePicker {...control.props} label="Due" {controlClass} />
    {:else}
      <TimeField {...control.props} label="Due" />
    {/if}
  {/snippet}
</Field>
