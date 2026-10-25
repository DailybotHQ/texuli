<script lang="ts">
import { type ClassValue } from '../../internal/cx.ts';

type Props = {
  class?: ClassValue;
};

let { class: className }: Props = $props();
</script>

<svg
  class={className}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <path d="m6 9 6 6 6-6" />
</svg>
