<script lang="ts">
import type { Component } from 'svelte';
import { setDesignDefaults } from '../../src/defaults/index.ts';
import type { DesignDefaults } from '../../src/defaults/vocabulary.ts';

interface Props {
  // biome-ignore lint/suspicious/noExplicitAny: any styled component
  component: Component<any>;
  props?: Record<string, unknown>;
  inner: DesignDefaults;
}

let { component, props = {}, inner }: Props = $props();
setDesignDefaults(() => inner);
const Target = $derived(component);
</script>

<Target {...props} />
