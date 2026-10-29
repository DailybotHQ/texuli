/**
 * The recorded agent drafts the /live-generation/ playground replays: no
 * model, no network, no key. Each scenario is one blueprint envelope (the
 * shape the agent service streams to a `<Player stream>`: its own header,
 * then the model's tree, children last) cut into token-sized chunks by a
 * fixed pattern, so every replay is the same. The weekly report is the
 * agent service's recorded answer to its first preset prompt
 * (`apps/agent/src/demo.ts`), grown by a chart and a table. Fictional data
 * only (Harbor, example.com). Checked by
 * apps/website/tests/site-live-generation.test.ts.
 */

const CATALOG_PIN = '0'.repeat(64);

/** The service's envelope header, before the tree. */
function envelope(id: string, tree: Record<string, unknown>): Record<string, unknown> {
  return {
    format: 'texuli-blueprint',
    version: 1,
    spec: '0.6.0',
    id,
    catalog: CATALOG_PIN,
    status: 'draft',
    createdAt: '2026-10-29T09:00:00Z',
    updatedAt: '2026-10-29T09:00:00Z',
    generator: { kind: 'agent', name: 'Harbor assistant', model: 'example-model' },
    tier: 'untrusted',
    profile: 'web',
    tree,
  };
}

const heading = (level: number, text: string) => ({
  id: 'blocks-text',
  props: { block: { type: 'heading', level, text } },
});
const text = (markdown: string) => ({
  id: 'blocks-text',
  props: { block: { type: 'text', markdown } },
});

const KPIS = {
  id: 'blocks-data',
  props: {
    block: {
      type: 'kpi',
      items: [
        { label: 'Tickets solved', value: '1,310', delta: '+9%', tone: 'success' },
        { label: 'Open backlog', value: '193', delta: '-4%', tone: 'success' },
        { label: 'First response', value: '42 min', delta: '-6 min', tone: 'success' },
      ],
    },
  },
};

const CHART = {
  id: 'charts-bar',
  props: {
    title: 'Tickets by channel',
    description: 'Tickets solved per channel this week (fictional)',
    series: [
      {
        id: 'solved',
        label: 'Solved',
        points: [
          { x: 'Email', y: 540 },
          { x: 'Chat', y: 480 },
          { x: 'Phone', y: 290 },
        ],
      },
    ],
  },
};

const NEXT_WEEK = [
  heading(2, 'Next week'),
  text('Close the oldest Integrations tickets and review the billing macros.'),
];

/**
 * A node outside the closed vocabulary: an id the catalog does not have,
 * carrying a script. The player holds it (and never paints its props); the
 * final verdict refuses the whole draft.
 */
const OUTSIDE_THE_CATALOG = {
  id: 'script-runner',
  props: { code: 'navigator.sendBeacon("https://tracker.example.com/collect")' },
};

function report(extra: readonly Record<string, unknown>[] = []): Record<string, unknown> {
  return envelope('harbor-weekly-report', {
    id: 'layout-doc',
    props: { title: 'Harbor support, week 44' },
    children: [
      heading(2, 'Highlights'),
      text('Median first response fell to **42 minutes**. Satisfaction held at 94%.'),
      KPIS,
      ...extra,
      heading(2, 'Volume'),
      CHART,
      ...NEXT_WEEK,
    ],
  });
}

export type ScenarioId = 'report' | 'refused' | 'interrupted';

export interface Scenario {
  readonly id: ScenarioId;
  readonly label: string;
  readonly summary: string;
  /** The envelope text the agent streams. */
  readonly text: string;
  /** For `interrupted`: the share of chunks delivered before the connection drops. */
  readonly dropAt?: number;
}

const json = (value: unknown) => JSON.stringify(value, null, 2);

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'report',
    label: 'A weekly report',
    summary:
      'The recorded answer to “Build a weekly report for the fictional Harbor support team.” Every node passes its checks and paints as soon as its shell is complete.',
    text: json(report()),
  },
  {
    id: 'refused',
    label: 'A node outside the catalog',
    summary:
      'The same report with one node the catalog does not have. The player holds it with a static note and keeps painting the rest; when the draft completes, the final verdict refuses the whole draft.',
    text: json(report([OUTSIDE_THE_CATALOG])),
  },
  {
    id: 'interrupted',
    label: 'A dropped connection',
    summary:
      'The report again, but the connection drops partway. What was painted stays, the rest says it was not received, and Try again streams the draft from the start.',
    text: json(report()),
    dropAt: 0.55,
  },
];

export function scenario(id: ScenarioId): Scenario {
  return SCENARIOS.find((entry) => entry.id === id) ?? (SCENARIOS[0] as Scenario);
}

/** Chunk sizes cycle through this pattern: token-sized pieces that split anywhere. */
export const CHUNK_PATTERN: readonly number[] = [7, 13, 4, 19, 9, 23, 5, 11, 16, 3];

/** Cuts `text` into chunks by {@link CHUNK_PATTERN}; joined, they give `text` back. */
export function chunk(text: string): string[] {
  const out: string[] = [];
  let at = 0;
  let step = 0;
  while (at < text.length) {
    const size = CHUNK_PATTERN[step % CHUNK_PATTERN.length] as number;
    out.push(text.slice(at, at + size));
    at += size;
    step += 1;
  }
  return out;
}

export type SpeedId = 'slow' | 'normal' | 'fast';

/** Delay between two chunks, per speed. */
export const SPEEDS: readonly {
  readonly id: SpeedId;
  readonly label: string;
  readonly delayMs: number;
}[] = [
  { id: 'slow', label: 'Slow', delayMs: 90 },
  { id: 'normal', label: 'Normal', delayMs: 30 },
  { id: 'fast', label: 'Fast', delayMs: 8 },
];

export function delayFor(id: SpeedId): number {
  return SPEEDS.find((entry) => entry.id === id)?.delayMs ?? 30;
}
