<script lang="ts">
import type { ButtonSize } from '../../src/components/button/index.ts';
import { IconButton } from '../../src/components/button/index.ts';

let { label = 'Icon action', size = 'icon' as ButtonSize }: { label?: string; size?: ButtonSize } =
  $props();
</script>

<IconButton {label} {size}>
  <svg viewBox="0 0 16 16" aria-hidden="true"
    ><path
      fill="currentColor"
      d="M4 4h8v8H4z"
    ></path></svg
  >
</IconButton>
