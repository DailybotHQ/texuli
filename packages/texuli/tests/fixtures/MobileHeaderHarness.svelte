<script lang="ts">
import type { ComponentProps } from 'svelte';
import { MobileHeader } from '../../src/layouts/mobile/index.ts';

type Props = Omit<ComponentProps<typeof MobileHeader>, 'leading' | 'actions'> & {
  /** Render a `leading` snippet (an avatar button). */
  withLeading?: boolean;
  /** Render an `actions` snippet (an Edit button). */
  withActions?: boolean;
};

let { withLeading = false, withActions = false, ...props }: Props = $props();
</script>

{#snippet leading()}<button type="button">Account</button>{/snippet}
{#snippet actions()}<button type="button">Edit</button>{/snippet}

<MobileHeader
  {...props}
  leading={withLeading ? leading : undefined}
  actions={withActions ? actions : undefined}
/>
