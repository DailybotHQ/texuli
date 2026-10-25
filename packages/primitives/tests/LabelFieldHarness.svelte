<script lang="ts">
import { Field, Label } from '../src/label/index.ts';

let {
  invalid = false,
  disabled = false,
  required = false,
  showDescription = true,
  showError = true,
  forceMount = false,
  extraDescribedBy,
  asTextarea = false,
  id,
  value = $bindable(''),
}: {
  invalid?: boolean;
  disabled?: boolean;
  required?: boolean;
  showDescription?: boolean;
  showError?: boolean;
  forceMount?: boolean;
  extraDescribedBy?: string;
  asTextarea?: boolean;
  id?: string;
  value?: string;
} = $props();
</script>

<p id="extra-hint">Shown on the invoice.</p>
<Field.Root {id} {invalid} {disabled} {required} data-testid="field">
  <Field.Label>Work email</Field.Label>
  {#if asTextarea}
    <Field.Control aria-describedby={extraDescribedBy}>
      {#snippet child({ props })}
        <textarea {...props} bind:value></textarea>
      {/snippet}
    </Field.Control>
  {:else}
    <Field.Control type="email" name="email" aria-describedby={extraDescribedBy} bind:value />
  {/if}
  {#if showDescription}<Field.Description>We send receipts here.</Field.Description>{/if}
  {#if showError}<Field.Error {forceMount}>Enter an address like name@example.com.</Field.Error>{/if}
</Field.Root>
<output data-testid="value">{value}</output>

<Label.Root for="plain-input" data-testid="plain-label">Plain label <button type="button">Help</button></Label.Root>
<input id="plain-input" />
<Label.Root data-testid="wrapping-label"><input type="checkbox" /> Remember me</Label.Root>
