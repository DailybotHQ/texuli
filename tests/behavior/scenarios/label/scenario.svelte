<script lang="ts">
// Label and field scenario: @texuli/primitives' Label and Field.
import { Field, Label } from '@texuli/primitives/label';

let email = $state('');
let invalid = $state(false);
const check = () => (invalid = !/^[^@\s]+@[^@\s]+$/.test(email));
</script>

<section aria-label="Label and field examples" class="behavior-stack">
  <Label.Root for="scenario-company">Company</Label.Root>
  <input id="scenario-company" />

  <Field.Root {invalid} class="behavior-stack">
    <Field.Label>Work email</Field.Label>
    <Field.Control type="email" bind:value={email} />
    <Field.Description>We send receipts here.</Field.Description>
    <Field.Error>Enter an address like name@example.com.</Field.Error>
  </Field.Root>
  <button type="button" onclick={check}>Check address</button>

  <Label.Root><input type="checkbox" /> Remember me</Label.Root>
</section>

<style>
  :global(.behavior-stack) {
    display: grid;
    gap: 0.5rem;
    justify-items: start;
  }
</style>
