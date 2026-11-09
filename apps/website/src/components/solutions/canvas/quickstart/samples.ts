import type { SolutionEntry } from '../../../../data/solutions/schema.ts';
import type { SolutionQuickstartProps } from '../../shared/types.ts';

export const CANVAS_QUICKSTART_VERIFIED_BY =
  'apps/website/tests/solutions/canvas-quickstart.test.ts';

export const CANVAS_INSTALL = 'pnpm add @texuli/canvas';

/** JSON passed to `loadUntrustedCanvas` from `@texuli/canvas/model`. */
export const CANVAS_JSON = {
  format: 'texuli-canvas',
  formatVersion: 1,
  meta: { title: 'Launch plan', locale: 'en' },
  grid: 8,
  shapes: [
    {
      id: 'ship',
      type: 'sticky',
      x: 0,
      y: 0,
      width: 160,
      height: 160,
      text: 'Ship the Northwind beta',
      color: 'yellow',
    },
  ],
  connectors: [],
} as const;

export const CANVAS_CREATE_SAMPLE = `import { applyCanvasOps, createCanvas } from '@texuli/canvas/model';

const canvas = createCanvas({ title: 'Launch plan' });
const added = applyCanvasOps(canvas, [
  {
    op: 'add',
    shape: { id: 'ship', type: 'sticky', x: 0, y: 0, width: 160, height: 160, text: 'Ship' },
  },
]);

if (added.ok) {
  console.log(added.doc.shapes.length);
}
`;

export const CANVAS_LOAD_SAMPLE = `import { loadUntrustedCanvas } from '@texuli/canvas/model';

const result = loadUntrustedCanvas(${JSON.stringify(CANVAS_JSON, null, 2)});

if (result.ok) {
  console.log(result.canvas.shapes.map((shape) => shape.id));
}
`;

export const CANVAS_EDITOR_SAMPLE = `<script lang="ts">
  import { CanvasEditor } from '@texuli/canvas/editor';
  import { loadUntrustedCanvas } from '@texuli/canvas/model';
  import '@texuli/tokens/base.css';

  const loaded = loadUntrustedCanvas(${JSON.stringify(CANVAS_JSON)});
  let canvas = $state.raw(loaded.ok ? loaded.canvas : null);
</script>

{#if canvas}
  <CanvasEditor bind:canvas />
{/if}
`;

export function canvasQuickstart(entry: SolutionEntry): SolutionQuickstartProps {
  return {
    entry,
    title: 'Start with a canvas',
    install: { label: 'Install', language: 'bash', code: CANVAS_INSTALL },
    samples: [
      { label: 'Create a canvas', language: 'ts', code: CANVAS_CREATE_SAMPLE },
      { label: 'Load untrusted JSON', language: 'ts', code: CANVAS_LOAD_SAMPLE },
      { label: 'Edit with CanvasEditor', language: 'svelte', code: CANVAS_EDITOR_SAMPLE },
    ],
    verifiedBy: CANVAS_QUICKSTART_VERIFIED_BY,
  };
}
