<script lang="ts">
import Icon from '../../src/components/icons/Icon.svelte';
import IconsProvider from '../../src/components/icons/IconsProvider.svelte';
import type {
  IconName,
  IconRegistry,
  IconRegistryOptions,
} from '../../src/components/icons/types.ts';

let {
  icons,
  fallback,
  names,
}: {
  icons: IconRegistry;
  fallback?: IconRegistryOptions['fallback'];
  names: readonly string[];
} = $props();
</script>

<IconsProvider {icons} {fallback}>
  {#each names as name, index (index)}
    <Icon icon={name as IconName} data-name={name} />
  {/each}
</IconsProvider>
