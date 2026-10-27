/**
 * Seed blueprints for the JSON live preview (`/workflows-page/json/`).
 * Fictional data only (Harbor Notes, example.com). Each seed is checked by
 * `apps/website/tests/site-drag-json.test.ts` through the same
 * `checkBlueprintText` the island runs: the valid seeds pass with zero
 * errors, and the invalid one fails with the expected codes and paths.
 */

export interface JsonSeed {
  id: string;
  /** The option text in the seed select. */
  label: string;
  /** One sentence shown under the select. */
  summary: string;
  /** Whether the seed is meant to validate. */
  valid: boolean;
  blueprint: Readonly<Record<string, unknown>>;
}

const CATALOG_PIN = '0'.repeat(64);

function envelope(
  id: string,
  extra: Record<string, unknown>,
  tree: Record<string, unknown>
): Record<string, unknown> {
  return {
    format: 'texuli-blueprint',
    version: 1,
    spec: '0.3.0',
    id,
    catalog: CATALOG_PIN,
    status: 'draft',
    createdAt: '2026-10-27T09:00:00Z',
    updatedAt: '2026-10-27T09:00:00Z',
    generator: { kind: 'agent', name: 'Harbor assistant', model: 'example-model' },
    ...extra,
    tree,
  };
}

/** A small fictional automation pipeline (spec workflow graph, version 1). */
const RELEASE_PIPELINE = {
  version: 1,
  cycles: 'forbid',
  nodeTypes: [
    {
      id: 'trigger',
      label: 'Trigger',
      ports: [{ id: 'out', direction: 'out', kind: 'flow', multiple: true }],
    },
    {
      id: 'step',
      label: 'Step',
      ports: [
        { id: 'in', direction: 'in', kind: 'flow', multiple: true },
        { id: 'out', direction: 'out', kind: 'flow', multiple: true },
      ],
    },
    {
      id: 'finish',
      label: 'Finish',
      ports: [{ id: 'in', direction: 'in', kind: 'flow', multiple: true }],
    },
  ],
  nodes: [
    { id: 'merge', type: 'trigger', label: 'Pull request merged', position: { x: 0, y: 0 } },
    { id: 'test', type: 'step', label: 'Run the checks', position: { x: 240, y: 0 } },
    { id: 'notes', type: 'step', label: 'Draft release notes', position: { x: 480, y: 0 } },
    { id: 'ship', type: 'finish', label: 'Post to the team space', position: { x: 720, y: 0 } },
  ],
  edges: [
    { id: 'e1', from: { node: 'merge', port: 'out' }, to: { node: 'test', port: 'in' } },
    { id: 'e2', from: { node: 'test', port: 'out' }, to: { node: 'notes', port: 'in' } },
    { id: 'e3', from: { node: 'notes', port: 'out' }, to: { node: 'ship', port: 'in' } },
  ],
};

/** The default: local state, bindings, closed actions, drag as data and a workflow graph. */
const releaseBoard: JsonSeed = {
  id: 'release-board',
  label: 'Release board (state, actions, drag, workflow)',
  summary:
    'Local state with a list variable, $state bindings, closed on-actions, a sortable list bound to the list and a read-only workflow graph.',
  valid: true,
  blueprint: envelope(
    'json-preview-release-board',
    {
      state: {
        priorities: {
          type: 'list',
          maxItems: 12,
          initial: [
            { id: 'search', label: 'Faster search', owner: 'Search team' },
            { id: 'export', label: 'CSV export', owner: 'Data team' },
            { id: 'invite', label: 'Team invites', owner: 'Growth team' },
          ],
        },
        review: {
          type: 'enum',
          values: [
            'Priorities (not reviewed)',
            'Priorities (reordered)',
            'Priorities (pipeline checked)',
          ],
        },
        showPipeline: { type: 'boolean', initial: true },
      },
    },
    {
      id: 'layout-page',
      props: {
        title: 'Release week at Harbor Notes',
        description:
          'Fictional data. Reorder the priorities; the pipeline shows how a release ships.',
      },
      children: [
        {
          id: 'layout-stack',
          props: { gap: 'medium' },
          children: [
            {
              id: 'layout-card',
              props: { title: { $state: 'review' } },
              children: [
                {
                  id: 'sortable-list',
                  props: {
                    label: 'Release priorities',
                    itemDetail: 'owner',
                    reorder: { bind: { $state: 'priorities' }, axis: 'vertical' },
                  },
                  on: {
                    move: [{ op: 'setState', state: 'review', value: 'Priorities (reordered)' }],
                  },
                },
              ],
            },
            {
              id: 'control-toggle',
              props: { state: 'showPipeline', label: 'Show the release pipeline' },
              on: {
                change: [
                  { op: 'setState', state: 'review', value: 'Priorities (pipeline checked)' },
                ],
              },
            },
            {
              id: 'layout-card',
              props: { title: 'Release pipeline' },
              when: {
                op: 'eq',
                left: { op: 'var', name: 'showPipeline' },
                right: { op: 'num', value: 1 },
              },
              children: [
                {
                  id: 'workflow-graph',
                  props: { label: 'Release pipeline', mode: 'view', graph: RELEASE_PIPELINE },
                },
              ],
            },
          ],
        },
      ],
    }
  ),
};

/** A plain report in the golden fixture style: no state, blocks and a chart. */
const weeklyReport: JsonSeed = {
  id: 'weekly-report',
  label: 'Weekly report (blocks and a chart)',
  summary: 'A plain document in the golden fixture style: text and KPI blocks and a bar chart.',
  valid: true,
  blueprint: envelope(
    'json-preview-weekly-report',
    { sources: [{ label: 'Sprint board', href: 'https://example.com/board' }] },
    {
      id: 'layout-doc',
      props: { title: 'Delivery report, week 42', toc: false },
      children: [
        {
          id: 'blocks-text',
          props: {
            block: {
              type: 'text',
              markdown:
                'The team closed **38 of 44** planned items. Two items wait on external reviews.',
            },
          },
        },
        {
          id: 'blocks-data',
          props: {
            block: {
              type: 'kpi',
              items: [
                { label: 'Items closed', value: '38', delta: '+5', tone: 'success' },
                { label: 'Carry-over', value: '6', delta: '-2', tone: 'success' },
                { label: 'Blocked', value: '2', delta: '+1', tone: 'warning' },
              ],
            },
          },
        },
        {
          id: 'charts-bar',
          props: {
            title: 'Items closed per team',
            description: 'Items closed per team in week 42',
            series: [
              {
                id: 'closed',
                label: 'Closed',
                points: [
                  { x: 'Boards', y: 14 },
                  { x: 'Search', y: 11 },
                  { x: 'Mobile', y: 13 },
                ],
              },
            ],
          },
        },
      ],
    }
  ),
};

/** A choice control bound to an enum variable, read back by a card title. */
const triage: JsonSeed = {
  id: 'triage',
  label: 'Ticket triage (controls and bindings)',
  summary: 'A choice control writes an enum variable; a card title reads it through a binding.',
  valid: true,
  blueprint: envelope(
    'json-preview-triage',
    {
      state: {
        queue: { type: 'enum', values: ['Support', 'Billing', 'Platform'], initial: 'Support' },
      },
    },
    {
      id: 'layout-page',
      props: { title: 'Ticket triage' },
      children: [
        {
          id: 'layout-stack',
          props: { gap: 'small' },
          children: [
            { id: 'control-choice', props: { state: 'queue', label: 'Queue' } },
            {
              id: 'layout-card',
              props: { title: { $state: 'queue' } },
              children: [
                {
                  id: 'blocks-text',
                  props: {
                    block: {
                      type: 'text',
                      markdown: 'Tickets for the selected queue appear here (fictional data).',
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    }
  ),
};

/** Intentionally invalid: an unknown component, an unknown variable and a closed-set violation. */
const broken: JsonSeed = {
  id: 'broken',
  label: 'Broken draft (shows diagnostics)',
  summary:
    'Intentionally invalid: an unknown component id, a binding to an undeclared variable and an event the component does not fire. It never paints.',
  valid: false,
  blueprint: envelope(
    'json-preview-broken',
    { state: { done: { type: 'boolean' } } },
    {
      id: 'layout-page',
      props: { title: 'Broken draft' },
      children: [
        { id: 'marquee-banner', props: { text: 'Not in the catalog' } },
        { id: 'layout-card', props: { title: { $state: 'missing' } } },
        {
          id: 'control-toggle',
          props: { state: 'done', label: 'Done' },
          on: { press: [{ op: 'toggleState', state: 'done' }] },
        },
      ],
    }
  ),
};

export const JSON_SEEDS: readonly JsonSeed[] = Object.freeze([
  releaseBoard,
  weeklyReport,
  triage,
  broken,
]);

export const DEFAULT_SEED_ID = releaseBoard.id;

/** The seed's text as shown in the editor: two-space JSON with a trailing newline. */
export function seedText(seed: JsonSeed): string {
  return `${JSON.stringify(seed.blueprint, null, 2)}\n`;
}

export function seedById(id: string): JsonSeed | undefined {
  return JSON_SEEDS.find((seed) => seed.id === id);
}
