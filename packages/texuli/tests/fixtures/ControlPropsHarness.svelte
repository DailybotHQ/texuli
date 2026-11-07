<script lang="ts">
import { Button, IconButton } from '../../src/components/button/index.ts';
import { Field } from '../../src/components/field/index.ts';
import { Textarea } from '../../src/components/input/index.ts';
import { NumberField } from '../../src/components/number-pin/index.ts';

// 0.14.3 control props: Field counter, NumberField display,
// Button and IconButton iconSize (Avatar tone and shape: display.test.ts).
let bio = $state('Short bio');
</script>

<Field label="Bio" description="Shown on your profile" counter={{ value: bio, max: 20 }}>
  {#snippet children(control)}
    <Textarea {...control.props} bind:value={bio} maxlength={20} />
  {/snippet}
</Field>
<Field label="Nickname" counter={{ value: '', max: 12 }}>
  {#snippet children(control)}
    <Textarea {...control.props} maxlength={12} />
  {/snippet}
</Field>

<NumberField.Root
  id="total"
  value={1234.5}
  locale="en-US"
  formatOptions={{ style: 'currency', currency: 'USD' }}
  display="output"
>
  <NumberField.Decrement />
  <NumberField.Input aria-label="Total" />
  <NumberField.Increment />
</NumberField.Root>

<Button iconSize="lg">Save</Button>
<IconButton label="Close" iconSize="xs">
  <svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M4 4h8v8H4z"></path></svg>
</IconButton>
