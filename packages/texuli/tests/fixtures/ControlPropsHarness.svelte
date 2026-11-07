<script lang="ts">
import { Button, IconButton } from '../../src/components/button/index.ts';
import Checkbox from '../../src/components/choice/Checkbox.svelte';
import Radio from '../../src/components/choice/Radio.svelte';
import RadioGroup from '../../src/components/choice/RadioGroup.svelte';
import Switch from '../../src/components/choice/Switch.svelte';
import { Field } from '../../src/components/field/index.ts';
import { Textarea } from '../../src/components/input/index.ts';
import { NumberField } from '../../src/components/number-pin/index.ts';

// 0.14.3 control props: labelContent, Field counter, NumberField display,
// Button and IconButton iconSize (Avatar tone and shape: display.test.ts).
let bio = $state('Short bio');
</script>

{#snippet rich(name: string)}<strong>{name}</strong> <a href="https://example.com/terms">terms</a>{/snippet}

<Checkbox description="Required to continue">
  {#snippet labelContent()}{@render rich('Accept')}{/snippet}
</Checkbox>
<Switch>
  {#snippet labelContent()}{@render rich('Notify')}{/snippet}
</Switch>
<RadioGroup aria-label="Plan" value="team">
  <Radio value="team">
    {#snippet labelContent()}{@render rich('Team')}{/snippet}
  </Radio>
</RadioGroup>

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
