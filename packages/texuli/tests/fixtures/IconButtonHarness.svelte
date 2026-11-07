<script lang="ts">
import type { ButtonSize } from '../../src/components/button/index.ts';
import { IconButton } from '../../src/components/button/index.ts';

let {
  label = 'Icon action',
  size = 'icon' as ButtonSize,
  badge,
  badgeLabel,
}: { label?: string; size?: ButtonSize; badge?: string | number; badgeLabel?: string } = $props();
</script>

<IconButton {label} {size} {badge} {badgeLabel}>
  <svg viewBox="0 0 16 16" aria-hidden="true"
    ><path
      fill="currentColor"
      d="M4 4h8v8H4z"
    ></path></svg
  >
</IconButton>
