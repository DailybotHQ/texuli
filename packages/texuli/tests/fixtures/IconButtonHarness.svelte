<script lang="ts">
import { IconButton } from '../../src/components/button/index.ts';

let { label = 'Icon action' }: { label?: string } = $props();
</script>

<IconButton {label}>
  <svg viewBox="0 0 16 16" aria-hidden="true"
    ><path
      fill="currentColor"
      d="M4 4h8v8H4z"
    ></path></svg
  >
</IconButton>
