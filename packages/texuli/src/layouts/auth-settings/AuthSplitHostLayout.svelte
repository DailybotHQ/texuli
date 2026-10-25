<script lang="ts">
/**
 * LayoutHost adapter for `auth-split`: only the mountScreen contract.
 * Direct apps prefer `AuthSplitLayout` with form/brand snippets.
 */
import type { LayoutProps } from '../host/registry.ts';
import AuthSplitLayout from './AuthSplitLayout.svelte';

let { mountScreen, options }: LayoutProps = $props();

const brandTitle = $derived(
  typeof options?.brandTitle === 'string' ? options.brandTitle : undefined
);
const brandDescription = $derived(
  typeof options?.brandDescription === 'string' ? options.brandDescription : undefined
);
const brandEyebrow = $derived(
  typeof options?.brandEyebrow === 'string' ? options.brandEyebrow : undefined
);
</script>

<AuthSplitLayout {mountScreen} {brandTitle} {brandDescription} {brandEyebrow} />
