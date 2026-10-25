<script lang="ts">
import { Sheet } from '../../../src/sheet/index.ts';
</script>

<Sheet.Root>
  <Sheet.Trigger id="filters-trigger">Open filters</Sheet.Trigger>
  <Sheet.Portal>
    <Sheet.Content id="filters-sheet" side="start">
      <Sheet.Title id="filters-title">Filters</Sheet.Title>
      <Sheet.Description id="filters-description">Narrow the fictional orders.</Sheet.Description>
      <Sheet.Close>Apply</Sheet.Close>
    </Sheet.Content>
  </Sheet.Portal>
</Sheet.Root>
