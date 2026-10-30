import type { RenderNode, RenderTier } from '../render/renderer/types.ts';

/**
 * Canvases in blueprints (spec 0.8.0, ADR-012). A `canvas` node carries a
 * Texuli canvas in its `canvas` prop. `validateDraft` checks it with the
 * host's {@link DraftCanvasCheck} at the draft's tier (`checkCanvasDraft`
 * from `@texuli/canvas/host`, which runs `validateCanvas`: closed shapes and
 * palette, text safety, image refs through the URL policy, the caps),
 * injected like `checkDocument` so this module stays free of the canvas
 * engine. Without it a `canvas` node is refused (`canvas-unchecked`): a
 * canvas never passes on structure alone.
 */

/** The catalog id whose `canvas` prop holds a Texuli canvas. */
export const CANVAS_ID = 'canvas';

/** One issue the host's canvas validator reports. */
export interface DraftCanvasIssue {
  code: string;
  /** Where in the canvas (a JSON path). */
  path: string;
  message: string;
  severity?: 'error' | 'warning';
}

/**
 * The host's canvas validator: `checkCanvasDraft` from
 * `@texuli/canvas/host` (`validateCanvas` at the given tier).
 */
export type DraftCanvasCheck = (
  canvas: unknown,
  tier: RenderTier
) => { ok: boolean; canvas?: unknown; issues: readonly DraftCanvasIssue[] };

/** A finding of the canvas check, reported by `validateDraft` under `canvases`. */
export interface CanvasFinding {
  code: 'canvas-unchecked' | 'canvas-schema';
  path: string;
  message: string;
}

/** Issues reported per canvas, so a hostile canvas cannot flood the receipt. */
export const MAX_CANVAS_FINDINGS = 20;

/** Every `canvas` node in a render tree with its node path. */
export function canvasNodes(
  roots: readonly RenderNode[]
): { node: Extract<RenderNode, { kind: 'component' }>; path: string }[] {
  const out: { node: Extract<RenderNode, { kind: 'component' }>; path: string }[] = [];
  const stack: { node: RenderNode; path: string }[] = roots
    .map((node, index) => ({ node, path: String(index) }))
    .reverse();
  while (stack.length > 0) {
    const { node, path } = stack.pop() as { node: RenderNode; path: string };
    if (node.kind !== 'component') continue;
    if (node.id === CANVAS_ID) out.push({ node, path });
    for (let i = node.children.length - 1; i >= 0; i -= 1)
      stack.push({ node: node.children[i] as RenderNode, path: `${path}.children.${i}` });
  }
  return out;
}

/**
 * Check every `canvas` node of a validated render tree at the tier. Pure;
 * never throws (a throwing host check is reported as `canvas-schema`).
 */
export function checkCanvases(
  roots: readonly RenderNode[],
  options: { tier: RenderTier; checkCanvas?: DraftCanvasCheck }
): CanvasFinding[] {
  const findings: CanvasFinding[] = [];
  for (const { node, path } of canvasNodes(roots)) {
    const out: CanvasFinding[] = [];
    const add = (finding: CanvasFinding) => {
      if (out.length < MAX_CANVAS_FINDINGS) out.push(finding);
    };
    if (!options.checkCanvas) {
      add({
        code: 'canvas-unchecked',
        path,
        message:
          'A canvas node needs the host canvas validator (checkCanvas); it is refused without it.',
      });
    } else {
      try {
        const result = options.checkCanvas(node.props.canvas, options.tier);
        const errors = result.issues.filter((issue) => issue.severity !== 'warning');
        for (const issue of errors)
          add({
            code: 'canvas-schema',
            path,
            message: `canvas ${issue.path}: ${issue.code}: ${issue.message}`,
          });
        if (!result.ok && out.length === 0)
          add({ code: 'canvas-schema', path, message: 'The canvas is invalid.' });
      } catch (cause) {
        add({
          code: 'canvas-schema',
          path,
          message: `The canvas validator failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        });
      }
    }
    findings.push(...out);
  }
  return findings;
}
