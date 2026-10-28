<script lang="ts">
/**
 * G26: every styled text control binds `value` and takes a caller `oninput`.
 * The caller handler records the bound value it sees, so a test proves the
 * internal handler ran first and was not replaced.
 */
import { Input, InputGroup, Textarea, TextCounter } from '../../src/components/input/index.ts';

let {
  kind,
  seen = [],
}: {
  kind:
    | 'input'
    | 'input-clearable'
    | 'textarea'
    | 'input-group'
    | 'text-counter'
    | 'text-counter-textarea';
  seen?: (string | number | null)[];
} = $props();

let value = $state('');

function record(): void {
  seen.push(value);
}
</script>

{#if kind === 'input'}
  <Input aria-label="Field" bind:value oninput={record} />
{:else if kind === 'input-clearable'}
  <Input aria-label="Field" clearable bind:value oninput={record} />
{:else if kind === 'textarea'}
  <Textarea aria-label="Field" bind:value oninput={record} />
{:else if kind === 'input-group'}
  <InputGroup bind:value inputProps={{ 'aria-label': 'Field', oninput: record }} />
{:else if kind === 'text-counter'}
  <TextCounter label="Field" maxlength={40} bind:value oninput={record} />
{:else if kind === 'text-counter-textarea'}
  <TextCounter label="Field" tag="textarea" maxlength={40} bind:value oninput={record} />
{/if}
<output data-testid="bound">{value}</output>
