<script lang="ts">
import { composeHandlers } from '../internal/handlers.ts';
import type { RefProp } from '../internal/ref.ts';
import { commandContext } from './context.ts';
import type { CommandInputProps } from './types.ts';

let {
  value = $bindable(),
  onValueChange,
  ref = $bindable(null),
  onkeydown,
  ...rest
}: CommandInputProps & RefProp = $props();
const context = commandContext.get();
let localValue = $state('');
const query = $derived(value ?? localValue);

function setValue(next: string): void {
  if (value !== undefined) value = next;
  else localValue = next;
  context.updateQuery(next);
  onValueChange?.(next);
}
</script>

<input bind:this={ref}
  {...rest}
  role="combobox"
  aria-label={rest['aria-label'] ?? context.label}
  aria-autocomplete="list"
  aria-expanded="true"
  aria-controls={context.listId}
  aria-activedescendant={context.activeValue ? context.itemId(context.activeValue) : undefined}
  autocomplete="off"
  value={query}
  oninput={(event) => setValue(event.currentTarget.value)}
  onkeydown={composeHandlers(onkeydown, context.handleInputKeydown)}
  data-command-input=""
/>
