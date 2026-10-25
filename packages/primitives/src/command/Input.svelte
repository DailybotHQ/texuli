<script lang="ts">
import { commandContext } from './context.ts';
import type { CommandInputProps } from './types.ts';

let { value = $bindable(), onValueChange, ...rest }: CommandInputProps = $props();
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

<input
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
  onkeydown={context.handleInputKeydown}
  data-command-input=""
/>
