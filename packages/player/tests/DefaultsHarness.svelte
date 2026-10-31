<script lang="ts">
import type { ComponentProps } from 'svelte';
import { setDesignDefaults } from 'texuli/defaults';
import Player from '../src/Player.svelte';

// An app-level provider around the player: the blueprint's design system
// overrides it prop by prop, and what it leaves unset still comes through.
type Props = ComponentProps<typeof Player> & { outer: Record<string, Record<string, string>> };
let { outer, ...props }: Props = $props();
setDesignDefaults(() => outer);
</script>

<Player {...props} />
