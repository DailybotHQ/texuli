<script lang="ts">
import type { LayoutProps } from '../host/registry.ts';
import ContentLayout from './ContentLayout.svelte';

let props: LayoutProps = $props();
</script>

<ContentLayout kind="blog" {...props} />
