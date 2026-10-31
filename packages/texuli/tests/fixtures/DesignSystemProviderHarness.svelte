<script lang="ts">
import type { ApplicableDesignSystem } from '@texuli/tokens/design-system/apply';
import Button from '../../src/components/button/Button.svelte';
import { DesignSystemProvider } from '../../src/design-system/index.ts';
import DefaultsProbe from './DesignSystemDefaultsProbe.svelte';

interface Props {
  compiled: ApplicableDesignSystem;
  mode?: 'light' | 'dark';
  show?: boolean;
}

let { compiled, mode = 'light', show = true }: Props = $props();
</script>

{#if show}
  <DesignSystemProvider {compiled} {mode} fonts={false} data-testid="scope">
    <DefaultsProbe />
    <Button>Save</Button>
  </DesignSystemProvider>
{/if}
