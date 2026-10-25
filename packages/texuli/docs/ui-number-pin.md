# NumberField and PinInput

`texuli/number-pin` styles the owned `@texuli/primitives/number-field` and
`@texuli/primitives/pin-input` controls with Texuli tokens. Both components
support `sm`, `md` and `lg` sizes and accept consumer classes.

```svelte
<script lang="ts">
  import { NumberField } from 'texuli/number-pin';
</script>

<label for="quantity">Quantity</label>
<NumberField.Root id="quantity" value={2} min={0} max={10}>
  <NumberField.Decrement />
  <NumberField.Input aria-label="Quantity" />
  <NumberField.Increment />
</NumberField.Root>
```

`NumberField.Root` and its parts preserve the primitive's locale formatting,
keyboard spinbutton behavior, bounds, optional wheel stepping and native form
submission. Set translated `incrementLabel` and `decrementLabel` on the root
when the default English labels are not appropriate.

```svelte
<script lang="ts">
  import { PinInput } from 'texuli/number-pin';
  import { REGEXP_ONLY_DIGITS } from '@texuli/primitives/pin-input';
  let code = $state('');
</script>

<label for="code">Verification code</label>
<PinInput.Root bind:value={code} inputId="code" maxlength={6} pattern={REGEXP_ONLY_DIGITS}>
  {#snippet children({ cells })}
    {#each cells as cell, index (index)}<PinInput.Cell {cell} />{/each}
  {/snippet}
</PinInput.Root>
```

The pin field remains one real, labeled input for typing, paste, autofill and
assistive technology. Its cells are decorative and hidden from the accessibility
tree. `mask` renders a password input and masked cells. The registered
`texuli-number-pin` example shows every size, disabled and read-only state, RTL,
and a dark surface.
