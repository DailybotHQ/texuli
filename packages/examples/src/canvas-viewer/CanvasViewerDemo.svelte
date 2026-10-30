<script lang="ts">
import { CanvasViewer } from '@texuli/canvas/viewer';
import { retroBoard } from '../canvas-editor/board.ts';

/** The same retro, read-only: fitted into an image, with its structure as text for screen readers. */
const canvas = retroBoard();
</script>

<div data-example="canvas-viewer">
  <CanvasViewer {canvas} />
</div>
