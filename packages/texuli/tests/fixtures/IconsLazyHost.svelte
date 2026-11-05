<script lang="ts">
// A lazy icon with a fallback, rendered on the server and hydrated (icons-ssr.test.ts).
import Icon from '../../src/components/icons/Icon.svelte';
import { registerIcons } from '../../src/components/icons/registry.ts';

registerIcons({ rocket: () => import('./CustomIcon.svelte') }, { fallback: 'info' });
</script>

<span data-host><Icon icon="rocket" label="Rocket" /></span>
