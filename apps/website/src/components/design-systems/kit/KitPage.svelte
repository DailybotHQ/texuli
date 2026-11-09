<script lang="ts">
/**
 * The kit island of /design-systems/kit/ (PLAN_016 T-t4-site): `DesignSystemKit` over the
 * build-time data of the example brand. Server-rendered; on hydration the mode switch works
 * and the matrix loads its live samples (lazy chunks of the site's own bundle, no network).
 */
import { DesignSystemKit, type DesignSystemKitProps } from 'texuli/ds-kit';

type Props = Pick<DesignSystemKitProps, 'document' | 'compiled' | 'allow' | 'catalog'>;

let props: Props = $props();
let modeView = $state<'both' | 'light' | 'dark'>('both');
</script>

<DesignSystemKit {...props} bind:modeView headingLevel={2} />
