<!-- Lazily loaded: carry the styles with the component (Astro attaches lazily
     imported component CSS only to some pages). -->
<svelte:options css="injected" />

<script lang="ts">
/**
 * Field, Form, Label, Description, FieldError, Input, InputGroup, Textarea
 * and TextCounter: real controls you can type in, with validation.
 */
import { Button } from 'texuli/button';
import { Description, Field, FieldError, Form, Label } from 'texuli/field';
import { Input, InputGroup, Textarea, TextCounter } from 'texuli/input';
import { readers, type StageValues } from './values.ts';

type Props = { componentId: string; values: StageValues };

let { componentId, values }: Props = $props();

const { str, num, bool, pick } = readers(() => values);

let text = $state('');
let amount = $state('120');
let notes = $state('Ship the Lumen Atlas pilot on Friday.');
let summary = $state('A short summary of the release');
let email = $state('');
let errors = $state<Record<string, string>>({});
let saved = $state('');

$effect(() => {
  text = str('value', componentId === 'input' ? 'Ada Park' : '');
});

function validate(form: Record<string, string>): Record<string, string> {
  const next: Record<string, string> = {};
  if (!form.team?.trim()) next.team = 'Enter a team name.';
  if (!/^[^@\s]+@example\.com$/.test(form.email ?? '')) next.email = 'Use an example.com address.';
  return next;
}
</script>

<div class="stage" data-tx-field-stage={componentId}>
  {#if componentId === 'field'}
    <Field
      label={str('label', 'Email')}
      description={str('description', 'Work address')}
      error={str('error') || (email && !email.includes('@') ? 'Include an @ sign.' : null)}
      required={bool('required', true)}
      disabled={bool('disabled')}
      hideLabel={bool('hideLabel')}
      orientation={pick('orientation', ['vertical', 'horizontal'] as const, 'vertical')}
    >
      {#snippet children(control)}
        <Input {...control.props} bind:value={email} type="email" placeholder="ada@example.com" />
      {/snippet}
    </Field>
  {:else if componentId === 'form'}
    {#if saved}
      <p role="status">Saved team {saved}.</p>
      <p><Button size="sm" variant="outline" onclick={() => (saved = '')}>Edit again</Button></p>
    {:else}
      <Form
        bind:errors
        layout={pick('layout', ['stack', 'grid'] as const, 'stack')}
        noValidate={bool('noValidate', true)}
        onValidate={validate}
        onSubmitValues={(form) => {
          saved = form.team ?? '';
        }}
      >
        <Field label="Team name" error={errors.team} required>
          {#snippet children(control)}
            <Input {...control.props} name="team" placeholder="Harbor design" />
          {/snippet}
        </Field>
        <Field label="Contact email" error={errors.email} required>
          {#snippet children(control)}
            <Input {...control.props} name="email" type="email" placeholder="ada@example.com" />
          {/snippet}
        </Field>
        <Button type="submit">Save team</Button>
      </Form>
    {/if}
  {:else if componentId === 'label' || componentId === 'description' || componentId === 'field-error'}
    <div class="field">
      <Label
        for="stage-team"
        required={componentId === 'label' ? bool('required', true) : true}
        size={componentId === 'label' ? pick('size', ['sm', 'md'] as const, 'md') : 'md'}
        srOnly={componentId === 'label' && bool('srOnly')}
      >
        Team name
      </Label>
      <Input
        id="stage-team"
        bind:value={text}
        placeholder="Harbor design"
        aria-describedby="stage-team-desc stage-team-error"
        aria-invalid={text.trim() === '' ? 'true' : undefined}
      />
      <Description id="stage-team-desc">Shown on invoices for the workspace.</Description>
      <FieldError
        id="stage-team-error"
        show={componentId === 'field-error' ? bool('show', true) && text.trim() === '' : text.trim() === ''}
      >
        Enter a team name.
      </FieldError>
    </div>
  {:else if componentId === 'input'}
    <div class="field">
      <Label for="stage-input">Full name</Label>
      <Input
        id="stage-input"
        bind:value={text}
        type={pick('type', ['text', 'email', 'search', 'password', 'url', 'tel'] as const, 'text')}
        clearable={bool('clearable', true)}
        clearLabel={str('clearLabel', 'Clear')}
        disabled={bool('disabled')}
        readonly={bool('readonly')}
      />
    </div>
    <div class="field">
      <Label for="stage-input-invalid">Email (invalid)</Label>
      <Input id="stage-input-invalid" type="email" value="not-an-email" aria-invalid="true" />
    </div>
    <div class="field">
      <Label for="stage-input-disabled">Locked</Label>
      <Input id="stage-input-disabled" value="Read only" disabled />
    </div>
  {:else if componentId === 'input-group'}
    <div class="field">
      <Label for="stage-amount">Amount</Label>
      <InputGroup
        bind:value={amount}
        clearable={bool('clearable', true)}
        clearLabel={str('clearLabel', 'Clear amount')}
        disabled={bool('disabled')}
        readonly={bool('readonly')}
        invalid={bool('invalid')}
        inputProps={{ id: 'stage-amount', inputmode: 'decimal' }}
      >
        {#snippet start()}<span aria-hidden="true">USD</span>{/snippet}
        {#snippet end()}<span aria-hidden="true">.00</span>{/snippet}
      </InputGroup>
    </div>
  {:else if componentId === 'textarea'}
    <div class="field">
      <Label for="stage-notes">Notes</Label>
      <Textarea
        id="stage-notes"
        bind:value={notes}
        autosize={bool('autosize', true)}
        rows={Math.min(8, Math.max(1, num('rows', 3)))}
        disabled={bool('disabled')}
        readonly={bool('readonly')}
      />
    </div>
  {:else}
    <TextCounter
      bind:value={summary}
      label={str('label', 'Summary')}
      maxlength={Math.max(10, num('maxlength', 80))}
      showAfter={num('showAfter', 20)}
      tag={pick('tag', ['input', 'textarea'] as const, 'input')}
      disabled={bool('disabled')}
      readonly={bool('readonly')}
      required={bool('required')}
      invalid={bool('invalid')}
      remainingLabel={str('remainingLabel', 'characters left')}
    />
  {/if}
</div>

<style>
  .stage {
    display: grid;
    gap: 0.85rem;
    max-inline-size: 28rem;
  }
  .field {
    display: grid;
    gap: 0.35rem;
  }
  p {
    margin: 0;
  }
</style>
