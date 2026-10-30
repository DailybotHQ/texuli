/**
 * The blueprints /output-page/ turns into other targets (fictional data
 * only, example.com): a weekly digest that uses most of the email subset
 * plus a chart (which has no email form and falls back to its text), and
 * hostile copies the static renderers refuse. The same digest feeds the
 * email preview, the player's print mode and the PDF.
 */

const block = (id: string, value: Record<string, unknown>) => ({ id, props: { block: value } });

export const WEEKLY_DIGEST = {
  id: 'layout-page',
  props: {
    title: 'Harbor weekly digest',
    description: 'Orders, support and releases for week 44 (fictional data).',
  },
  children: [
    block('blocks-text', { type: 'heading', level: 2, text: 'Highlights', eyebrow: 'Week 44' }),
    {
      id: 'blocks-text',
      props: {
        block: {
          type: 'text',
          markdown:
            'Orders grew **12%** over last week; see [the orders dashboard](https://example.com/orders).\n\n- Shipping took 2.1 days on average\n- Returns fell to *1.8%*',
        },
      },
    },
    block('blocks-data', {
      type: 'stat',
      items: [
        { label: 'Revenue', value: '$48.2k', delta: '+4%' },
        { label: 'Orders', value: '1,284', delta: '+12%' },
        { label: 'Tickets closed', value: '96', delta: '-3%' },
      ],
    }),
    block('blocks-data', {
      type: 'table',
      caption: 'Orders by region',
      columns: [
        { id: 'region', label: 'Region' },
        { id: 'orders', label: 'Orders' },
        { id: 'change', label: 'Change' },
      ],
      rows: [
        { region: 'East', orders: 512, change: '+9%' },
        { region: 'West', orders: 431, change: '+15%' },
        { region: 'South', orders: 341, change: '+11%' },
      ],
    }),
    block('blocks-text', {
      type: 'callout',
      title: 'Heads up',
      body: 'Two products are *low* on stock: the walnut desk and the oak shelf.',
    }),
    block('blocks-data', {
      type: 'chart',
      kind: 'bar',
      title: 'Orders per day',
      description: 'Orders rose every day from Monday to Friday.',
      series: [
        {
          id: 'orders',
          label: 'Orders',
          points: [
            { x: 'Mon', y: 160 },
            { x: 'Tue', y: 171 },
            { x: 'Wed', y: 188 },
            { x: 'Thu', y: 196 },
            { x: 'Fri', y: 214 },
          ],
        },
      ],
    }),
    block('blocks-text', {
      type: 'quote',
      quote: 'Best week of the quarter, and the calmest on-call yet.',
      cite: 'Ada Example',
      role: 'Operations',
    }),
    block('blocks-structure', {
      type: 'cta',
      actions: [
        { label: 'Open the dashboard', href: 'https://example.com/dashboard' },
        { label: 'Reply to the team', href: 'mailto:ops@example.com' },
      ],
    }),
  ],
};

/** A link that would run script when clicked: the whole draft is refused. */
export const SCRIPT_LINK_DIGEST = {
  ...WEEKLY_DIGEST,
  children: [
    ...WEEKLY_DIGEST.children.slice(0, -1),
    block('blocks-structure', {
      type: 'cta',
      actions: [{ label: 'Open the dashboard', href: 'javascript:alert(document.cookie)' }],
    }),
  ],
};

/** Raw markup and an inline style the catalog does not know: refused. */
export const RAW_MARKUP_DIGEST = {
  id: 'layout-page',
  props: { title: 'Harbor weekly digest', style: 'color:red', onclick: 'alert(1)' },
  children: [
    {
      id: 'blocks-text',
      props: {
        block: { type: 'text', markdown: '<iframe src="https://evil.example.com"></iframe>' },
      },
    },
  ],
};

export interface OutputDraft {
  readonly id: string;
  readonly label: string;
  readonly draft: unknown;
}

export const OUTPUT_DRAFTS: readonly OutputDraft[] = [
  { id: 'digest', label: 'Weekly digest', draft: WEEKLY_DIGEST },
  { id: 'script-link', label: 'With a javascript: link', draft: SCRIPT_LINK_DIGEST },
  { id: 'raw-markup', label: 'With raw markup and handlers', draft: RAW_MARKUP_DIGEST },
];

/** What the email preview is rendered with (also stated on the page). */
export const EMAIL_OPTIONS = {
  preheader: 'Orders up 12%, two products low on stock',
  baseUrl: 'https://example.com/',
} as const;

/** The player envelope for the print-mode demo. */
export const PRINT_BLUEPRINT = {
  format: 'texuli-blueprint',
  version: 1,
  spec: '0.8.0',
  id: 'weekly-digest',
  catalog: '0'.repeat(64),
  status: 'draft',
  createdAt: '2026-10-29T09:00:00Z',
  updatedAt: '2026-10-29T09:00:00Z',
  generator: { kind: 'agent', name: 'Harbor assistant', model: 'example-model' },
  tier: 'untrusted',
  profile: 'web',
  tree: WEEKLY_DIGEST,
};
