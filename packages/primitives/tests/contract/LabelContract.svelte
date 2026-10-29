<script lang="ts">
import {
  FieldControl,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldRoot,
  LabelRoot,
} from '../../src/label/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs }: HarnessProps = $props();
</script>

<FieldRoot invalid {...p('label/FieldRoot')} bind:ref={refs['label/FieldRoot']}>
  <FieldLabel {...p('label/FieldLabel')} bind:ref={refs['label/FieldLabel']}>Name</FieldLabel>
  <FieldControl {...p('label/FieldControl')} bind:ref={refs['label/FieldControl']} />
  <FieldDescription {...p('label/FieldDescription')} bind:ref={refs['label/FieldDescription']}>Help</FieldDescription>
  <FieldError {...p('label/FieldError')} bind:ref={refs['label/FieldError']}>Required</FieldError>
</FieldRoot>
<LabelRoot for="x" {...p('label/LabelRoot')} bind:ref={refs['label/LabelRoot']}>Plain</LabelRoot>
<input id="x" />
