<script lang="ts">
import { FormBuilder } from '@texuli/forms/builder';
import type { FormSchema } from '@texuli/forms/model';

let schema = $state<FormSchema>({
  title: 'Community day RSVP',
  description: 'Register for the example.com community day.',
  fields: [
    { name: 'name', type: 'text', label: 'Your name', required: true },
    { name: 'email', type: 'email', label: 'Email address', required: true },
  ],
});
</script>

<section data-example="forms-builder" class="demo" aria-label="Interactive form builder example">
  <FormBuilder {schema} onChange={(next) => schema = next} />
</section>

<style>
  .demo { padding: 1rem; color: var(--tx-foreground, CanvasText); background: var(--tx-background, Canvas); }
</style>
