<script lang="ts">
import type { Snippet } from 'svelte';
import { markInDrawer } from './context.ts';

/** Wraps the drawer copy of the sidebar, so a Sidebar can tell it is inside the drawer. */
let { children }: { children: Snippet } = $props();

markInDrawer();
</script>

{@render children()}
