<script lang="ts">
import { Button } from 'texuli/button';
import { Switch } from 'texuli/choice';
import { Field } from 'texuli/field';
import { Input } from 'texuli/input';

let notify = $state(true);
let name = $state('Harbor design');
</script>

<div class="guide-live" data-guide-live="accessibility">
  <p class="guide-live__label">Live · labels, description and keyboard</p>
  <Field
    label="Workspace name"
    description="Announced with the control via aria-describedby."
    required
  >
    {#snippet children(control)}
      <Input {...control.props} bind:value={name} autocomplete="off" />
    {/snippet}
  </Field>
  <div class="switch-row">
    <Switch bind:checked={notify} label="Email digest" />
  </div>
  <div class="actions">
    <Button size="sm" type="button">Save settings</Button>
    <Button size="sm" variant="ghost" type="button">Cancel</Button>
  </div>
  <p class="hint">
    Tab to the field, switch and buttons. Focus rings come from theme tokens
    (<code>--tx-ring</code>), not custom outlines.
  </p>
</div>

<style>
  .switch-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .hint {
    margin: 0;
    font-size: 0.875rem;
  }
</style>
