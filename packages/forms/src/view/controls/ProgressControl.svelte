<script lang="ts">
import { Stepper } from 'texuli/stepper';
import type { SchemaFormProgressProps } from './types.ts';

/* The step navigation of a multi-step form (loaded only for one, G119). */

let { steps, current, label, onStepClick }: SchemaFormProgressProps = $props();
</script>

<Stepper class="tx-forms__progress" {steps} {current} {label} {onStepClick} />
