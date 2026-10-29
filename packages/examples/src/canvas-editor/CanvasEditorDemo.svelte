<script lang="ts">
import { CanvasEditor } from '@texuli/canvas/editor';
import { retroBoard } from './board.ts';

/** A fictional launch retro on the infinite canvas: draw, connect, move by keyboard or pointer, zoom and undo. */
let canvas = $state.raw(retroBoard());
</script>

<div data-example="canvas-editor" class="canvas-editor-demo">
  <CanvasEditor bind:canvas />
</div>

<style>
  .canvas-editor-demo {
    min-block-size: 32rem;
  }
</style>
