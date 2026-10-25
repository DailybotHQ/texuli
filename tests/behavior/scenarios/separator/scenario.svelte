<script lang="ts">
// Separator scenario: @texuli/primitives' Separator, semantic and decorative,
// in both orientations.
import { Separator } from '../../../../packages/primitives/src/separator/index.ts';
</script>

<p>Above the decorative rule</p>
<Separator.Root decorative data-behavior-separator="decorative" />
<p>Between sections</p>
<Separator.Root data-behavior-separator="semantic" />
<div class="behavior-row">
  <span>Left</span>
  <Separator.Root orientation="vertical" data-behavior-separator="vertical" />
  <span>Right</span>
</div>

<style>
  :global([data-behavior-separator]) {
    background: CanvasText;
    min-block-size: 1px;
    min-inline-size: 1px;
  }
  .behavior-row {
    display: flex;
    gap: 0.5rem;
  }
</style>
