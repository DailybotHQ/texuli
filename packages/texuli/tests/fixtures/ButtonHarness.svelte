<script lang="ts">
import type { ButtonSize, ButtonVariant } from '../../src/components/button/index.ts';
import { Button } from '../../src/components/button/index.ts';
import { type ClassValue } from '../../src/internal/cx.ts';

let {
  label = 'Action',
  variant = 'default' as ButtonVariant,
  size = 'md' as ButtonSize,
  href = undefined as string | undefined,
  loading = false,
  loadingLabel = undefined as string | undefined,
  disabled = false,
  class: className = undefined as string | undefined,
  onclick = undefined as ((event: MouseEvent) => unknown) | undefined,
}: {
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  class?: ClassValue;
  onclick?: (event: MouseEvent) => unknown;
} = $props();
</script>

<Button {variant} {size} {href} {loading} {loadingLabel} {disabled} class={className} {onclick}
  >{label}</Button
>
