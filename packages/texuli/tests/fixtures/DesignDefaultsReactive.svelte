<script lang="ts">
import Button from '../../src/components/button/Button.svelte';
import { setDesignDefaults } from '../../src/defaults/index.ts';

let size = $state<'sm' | 'lg'>('sm');
setDesignDefaults(() => ({ button: { size } }));
</script>

<Button label="Save" data-testid="target" />
<button type="button" onclick={() => (size = size === 'sm' ? 'lg' : 'sm')}>Toggle size</button>
