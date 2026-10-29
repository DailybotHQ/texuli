/**
 * Static copy for /live-generation/: the status, the steps of a streamed
 * paint and the docs they point to. Plain data, so the page and its tests
 * share one source (labels are text, never HTML).
 */

/** The release the streaming player ships in (on npm, in development, pre-1.0). */
export const STREAMING_RELEASE = '0.6.0';

export interface LiveStep {
  readonly title: string;
  readonly body: string;
}

/** How a node goes from bytes to paint, in order. */
export const LIVE_STEPS: readonly LiveStep[] = [
  {
    title: 'Bytes arrive',
    body: 'The agent writes the blueprint as JSON text. Chunks split anywhere, even inside a word or a number.',
  },
  {
    title: 'A skeleton holds the place',
    body: 'A node whose shell is still arriving shows a static skeleton of its catalog family: no content, no spinner, nothing to focus.',
  },
  {
    title: 'The shell is checked',
    body: 'Once a node’s members before children are final, it passes the same node-level rules as a whole draft: closed id and props, the URL policy at the untrusted tier, the sink scan.',
  },
  {
    title: 'It paints, or it is held',
    body: 'A node that passes paints at once. A node that fails is held with its subtree, as a static note; its props never reach the screen.',
  },
  {
    title: 'The final verdict',
    body: 'When the stream completes, the whole draft is validated again. Only a valid draft is armed; a refused one replaces the paint with the refusal notice.',
  },
];

export interface LiveDoc {
  readonly label: string;
  readonly path: string;
}

export const LIVE_DOCS: readonly LiveDoc[] = [
  { label: 'Streaming mode', path: 'packages/player/docs/streaming.md' },
  { label: 'The agent service', path: 'apps/agent/README.md' },
  {
    label: 'Streaming decision (ADR-014)',
    path: 'docs/DECISIONS.md',
  },
];
