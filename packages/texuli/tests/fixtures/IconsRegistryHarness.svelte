<script lang="ts">
import Icon from '../../src/components/icons/Icon.svelte';
import IconsProvider from '../../src/components/icons/IconsProvider.svelte';
import { registerIcons } from '../../src/components/icons/registry.ts';
import type { IconRegistry } from '../../src/components/icons/types.ts';
import CustomIcon from './CustomIcon.svelte';

let { inner = {} }: { inner?: IconRegistry } = $props();

registerIcons({
  rocket: CustomIcon,
  spark: 'M12 3v18M3 12h18',
  // A built-in name keeps its own glyph.
  check: 'M1 1h2',
});
</script>

<span data-testid="outer">
  <Icon icon="rocket" label="Rocket" />
  <Icon icon="spark" />
  <Icon icon="check" />
</span>
<IconsProvider icons={inner}>
  <span data-testid="inner">
    <Icon icon="spark" />
    <Icon icon="rocket" />
  </span>
</IconsProvider>
