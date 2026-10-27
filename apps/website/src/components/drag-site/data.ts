import { DEFAULT_DRAG_MESSAGES, formatDragMessage } from '@texuli/drag/messages';

/**
 * Fictional content for the /drag-page/ demos (a Harbor Notes product team
 * on example.com). Labels are plain text; nothing here renders as HTML.
 */
export const LABELS: Readonly<Record<string, string>> = {
  // Lists and columns
  priorities: 'This week',
  todo: 'To do',
  doing: 'Doing',
  done: 'Done (max 3)',
  site: 'Site map',
  palette: 'Block palette',
  page: 'Page',
  chips: 'Release channels',
  tiles: 'Dashboard tiles',
  outline: 'Guide outline',
  // Items
  'launch-notes': 'Write launch notes',
  'pricing-page': 'Refresh pricing page',
  'status-page': 'Check status page',
  invoices: 'Send May invoices',
  'audit-forms': 'Audit sign-up forms',
  'dark-mode': 'Polish dark mode',
  'export-csv': 'CSV export',
  'search-index': 'Search index',
  onboarding: 'Onboarding emails',
  guides: 'Guides',
  install: 'Install',
  theming: 'Theming',
  reference: 'Reference',
  tokens: 'Tokens',
  changelog: 'Changelog',
  heading: 'Heading block',
  text: 'Text block',
  chart: 'Chart block',
  quote: 'Quote block',
  pinned: 'Pinned summary (locked)',
  stable: 'Stable',
  beta: 'Beta',
  nightly: 'Nightly',
  canary: 'Canary',
  revenue: 'Revenue',
  signups: 'Sign-ups',
  churn: 'Churn',
  latency: 'Latency',
  uptime: 'Uptime',
  tickets: 'Tickets',
  intro: 'Introduction',
  setup: 'Setup',
  usage: 'Usage',
  faq: 'FAQ',
  accounts: 'Accounts',
  keys: 'API keys',
};

/** The label for an item id; clones (`text-copy`, `text-copy-2`) keep their source's label. */
export function labelOf(id: string): string {
  return LABELS[id] ?? LABELS[id.replace(/-copy(-\d+)?$/, '')] ?? id;
}

/** The keyboard instructions every handle points at (the engine's English default). */
export const DRAG_INSTRUCTIONS = formatDragMessage(DEFAULT_DRAG_MESSAGES.instructions, {});
