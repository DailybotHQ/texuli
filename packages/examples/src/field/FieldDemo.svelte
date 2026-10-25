<script lang="ts">
import { Button } from 'texuli/button';
import {
  Description,
  Field,
  FieldError,
  type FieldErrorMap,
  Form,
  fieldMessage,
  Label,
} from 'texuli/field';
import { Input } from 'texuli/input';

let name = $state('');
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

<section data-example="texuli-field" aria-labelledby="field-demo-title">
  <h2 id="field-demo-title">Field and Form</h2>

  <h3>Standalone field (invalid)</h3>
  <Field
    label="Team name"
    description="Shown on invoices for the Harbor workspace."
    error="Team name is required"
    required
  >
    {#snippet children(control)}
      <Input {...control.props} value="" placeholder="Harbor design" />
    {/snippet}
  </Field>

  <h3>Horizontal + RTL</h3>
  <div dir="rtl">
    <Field label="Locale" orientation="horizontal" description="Reading direction sample.">
      {#snippet children(control)}
        <Input {...control.props} value="ar-EG" readonly />
      {/snippet}
    </Field>
  </div>

  <h3>Composed Label / Description / FieldError</h3>
  <div class="tx-field-root">
    <Label for="notes-demo">Notes</Label>
    <Input id="notes-demo" aria-describedby="notes-demo-desc" placeholder="Optional" />
    <Description id="notes-demo-desc">Visible to your fictional teammates only.</Description>
  </div>

  <h3>Form with validate hook</h3>
  {#if saved}
    <p role="status" data-form-saved>Profile saved for the fictional workspace.</p>
  {:else}
    <Form
      bind:errors
      noValidate
      onValidate={validate}
      onSubmitValues={() => {
        saved = true;
      }}
    >
      <Field
        label="Display name"
        error={fieldMessage(errors, 'displayName')}
        required
      >
        {#snippet children(control)}
          <Input
            {...control.props}
            name="displayName"
            bind:value={name}
            autocomplete="nickname"
            placeholder="Alex Harbor"
          />
        {/snippet}
      </Field>
      <Field
        label="Email"
        description="example.com addresses only"
        error={fieldMessage(errors, 'email')}
        required
      >
        {#snippet children(control)}
          <Input
            {...control.props}
            name="email"
            type="email"
            bind:value={email}
            autocomplete="email"
            placeholder="ada@example.com"
          />
        {/snippet}
      </Field>
      <div class="tx-form__actions">
        <Button type="submit">Save profile</Button>
      </div>
    </Form>
  {/if}
</section>

<style>
  section {
    display: grid;
    gap: 1.5rem;
    padding: 1rem;
    max-inline-size: 28rem;
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
  }
  h2,
  h3 {
    margin: 0;
  }
</style>
