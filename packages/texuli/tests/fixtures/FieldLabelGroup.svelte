<script lang="ts">
// A custom control built outside texuli: it names its group from the Field label.
import { useFieldLabel } from '../../src/components/field/index.ts';

const field = useFieldLabel();
</script>

<div role="group" aria-labelledby={field?.labelId} data-testid="custom-group">
  <button type="button">Low</button>
  <button type="button">High</button>
</div>
