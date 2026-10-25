<script lang="ts">
/**
 * LayoutHost adapter for `wizard`: screen outlet inside the wizard frame.
 * Direct apps prefer `WizardLayout` with steps + content.
 */
import type { LayoutProps } from '../host/registry.ts';
import WizardLayout from './WizardLayout.svelte';

let { mountScreen, options }: LayoutProps = $props();

const title = $derived(typeof options?.title === 'string' ? options.title : undefined);
const description = $derived(
  typeof options?.description === 'string' ? options.description : undefined
);
</script>

<WizardLayout {mountScreen} {title} {description} />
