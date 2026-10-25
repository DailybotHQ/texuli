<script lang="ts">
import {
  AspectRatio,
  type AspectRatioValue,
  Separator,
  type SeparatorOrientation,
  type SeparatorVariant,
  VisuallyHidden,
} from '../../src/components/separator-aspect/index.ts';

let {
  show = 'separator' as 'separator' | 'aspect' | 'hidden',
  orientation = 'horizontal' as SeparatorOrientation,
  decorative = true,
  variant = 'default' as SeparatorVariant,
  ratio = '16/9' as AspectRatioValue,
  custom = undefined as string | undefined,
}: {
  show?: 'separator' | 'aspect' | 'hidden';
  orientation?: SeparatorOrientation;
  decorative?: boolean;
  variant?: SeparatorVariant;
  ratio?: AspectRatioValue;
  custom?: string;
} = $props();
</script>

{#if show === 'separator'}
  <Separator {orientation} {decorative} {variant} />
{:else if show === 'aspect'}
  <AspectRatio {ratio} {custom}>
    <span>Preview</span>
  </AspectRatio>
{:else}
  <VisuallyHidden>Screen reader only label</VisuallyHidden>
{/if}
