<script lang="ts">
// The combobox scenario exercises only the public primitive API.
import { Combobox } from '@texuli/primitives/combobox';
import { behaviorEvent } from '../../harness/client/events.ts';

const people = [
  { value: 'ada', label: 'Ada Example' },
  { value: 'grace', label: 'Grace Sample' },
  { value: 'linus', label: 'Linus Demo' },
];
let value = $state('');
let inputValue = $state('');
</script>

<label for="assignee-input">Assignee</label>
<Combobox.Root bind:value bind:inputValue items={people} onValueChange={(next) => behaviorEvent('valueChange', next)}>
  <Combobox.Input id="assignee-input" />
  <Combobox.Trigger aria-label="Show people">▾</Combobox.Trigger>
  <Combobox.Portal>
    <Combobox.Content id="assignee-list" class="behavior-list" data-behavior-layer sideOffset={4}>
      <Combobox.Viewport>
        {#snippet children(person)}
          <Combobox.Item value={person.value} label={person.label}>{person.label}</Combobox.Item>
        {/snippet}
      </Combobox.Viewport>
    </Combobox.Content>
  </Combobox.Portal>
</Combobox.Root>
<button type="button" onclick={() => (value = 'grace')}>Assign Grace</button>

<style>
  :global(.behavior-list) {
    display: grid;
    min-inline-size: 10rem;
    padding: 0.25rem;
    border: 1px solid CanvasText;
    background: Canvas;
    color: CanvasText;
  }
</style>
