<script lang="ts">
import { createPrimitiveContext } from '../src/internal/context.ts';

const context = createPrimitiveContext<{ selected: string }>('Fixture');
context.set({ selected: 'alpha' });
const value = context.get();
</script>

<output>{value.selected}</output>
