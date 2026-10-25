<script lang="ts">
import { Button } from 'texuli/button';
import { Field, type FieldErrorMap, Form, fieldMessage } from 'texuli/field';
import { Input } from 'texuli/input';

let displayName = $state('');
let email = $state('');
let errors = $state<FieldErrorMap>({});
let saved = $state(false);

function validate(values: Record<string, string>): FieldErrorMap {
  const next: FieldErrorMap = {};
  if (!values.displayName || values.displayName.trim().length < 2) {
    next.displayName = 'Enter at least two characters.';
  }
  if (!values.email?.includes('@example.com')) {
    next.email = 'Use a fictional @example.com address.';
  }
  return next;
}
</script>

<div class="guide-live" data-guide-live="forms">
  <p class="guide-live__label">Live · Form with validate</p>
  {#if saved}
    <p role="status" data-guide-form-saved>Profile saved for the fictional workspace.</p>
    <Button
      size="sm"
      variant="outline"
      type="button"
      onclick={() => {
        saved = false;
        displayName = '';
        email = '';
        errors = {};
      }}
    >
      Reset demo
    </Button>
  {:else}
    <Form
      bind:errors
      noValidate
      onValidate={validate}
      onSubmitValues={() => {
        saved = true;
      }}
    >
      <div class="stack">
        <Field
          label="Display name"
          error={fieldMessage(errors, 'displayName')}
          required
        >
          {#snippet children(control)}
            <Input
              {...control.props}
              name="displayName"
              bind:value={displayName}
              autocomplete="off"
              placeholder="Alex Harbor"
            />
          {/snippet}
        </Field>
        <Field label="Email" error={fieldMessage(errors, 'email')} required>
          {#snippet children(control)}
            <Input
              {...control.props}
              name="email"
              type="email"
              bind:value={email}
              autocomplete="off"
              placeholder="alex@example.com"
            />
          {/snippet}
        </Field>
        <Button size="sm" type="submit">Save profile</Button>
      </div>
    </Form>
  {/if}
</div>

<style>
  .stack {
    display: grid;
    gap: 0.85rem;
    max-inline-size: 24rem;
  }
  p {
    margin: 0;
  }
</style>
