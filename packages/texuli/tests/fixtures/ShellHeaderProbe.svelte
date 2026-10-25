<script lang="ts">
import { type AppShellContext, getAppShellContext } from '../../src/layouts/shells/index.ts';

let { onShell }: { onShell?: (shell: AppShellContext | undefined) => void } = $props();

const shell = getAppShellContext();
$effect.pre(() => onShell?.(shell));
</script>

<header>
  {#if shell}
    <button type="button" aria-expanded={shell.sidebarOpen} onclick={() => shell.toggleSidebar()}>Menu</button>
  {:else}
    <span>No shell</span>
  {/if}
</header>
