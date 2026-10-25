import { type CatalogManifest, defineCatalogManifest } from '../../manifest/index.ts';
import {
  alertPropNames,
  badgePropNames,
  bannerPropNames,
  calloutPropNames,
  cardPropNames,
  chipPropNames,
  codePropNames,
  emptyStatePropNames,
  errorStatePropNames,
  inlineTextPropNames,
  kbdPropNames,
  kpiPropNames,
  statPropNames,
  stepperPropNames,
  tablePropNames,
  tagPropNames,
  timelinePropNames,
} from './prop-names.ts';

const PKG = 'texuli';

function propsFrom(
  names: readonly string[],
  detail: Record<
    string,
    {
      kind: CatalogManifest['props'][number]['kind'];
      required?: boolean;
      description?: string;
      enumValues?: readonly string[];
      default?: unknown;
      trust?: 'developer' | 'untrusted';
    }
  >
): CatalogManifest['props'] {
  return names.map((name) => {
    const meta = detail[name];
    if (!meta) throw new Error(`Missing prop detail for "${name}"`);
    return {
      name,
      kind: meta.kind,
      ...(meta.required ? { required: true } : {}),
      ...(meta.description ? { description: meta.description } : {}),
      ...(meta.enumValues ? { enumValues: meta.enumValues } : {}),
      ...(meta.default !== undefined ? { default: meta.default } : {}),
      ...(meta.trust ? { trust: meta.trust } : {}),
    };
  });
}

const badgeVariants = [
  'default',
  'secondary',
  'outline',
  'success',
  'warning',
  'destructive',
  'info',
  'neutral',
] as const;

const alertTones = ['info', 'success', 'warning', 'error', 'brand', 'neutral'] as const;

export const cardManifest = defineCatalogManifest({
  id: 'card',
  package: PKG,
  label: 'Card',
  summary: 'A surface for grouping related content with optional link behavior.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Group related content in a bordered surface', 'Make a whole tile a single link'],
  dontUseWhen: [
    'A single line of chrome (use badge or button)',
    'A data grid of many rows (use table)',
  ],
  a11y: [
    'When href is set, the card is a real link with an accessible name',
    'Rejected href schemes render as a non-interactive surface',
  ],
  props: propsFrom(cardPropNames, {
    variant: {
      kind: 'enum',
      enumValues: ['elevated', 'flat'],
      default: 'elevated',
      description: 'Visual elevation',
    },
    href: { kind: 'string', description: 'Optional link target (URL policy)', trust: 'developer' },
    hrefTrust: {
      kind: 'enum',
      enumValues: ['developer', 'untrusted'],
      default: 'developer',
    },
    linkLabel: { kind: 'string', description: 'Accessible name when the card is a link' },
    class: { kind: 'string', description: 'Extra classes' },
  }),
  examples: [
    {
      id: 'elevated',
      title: 'Elevated card',
      props: { variant: 'elevated' },
    },
    {
      id: 'linked',
      title: 'Linked card',
      props: {
        variant: 'flat',
        href: 'https://example.com/docs',
        linkLabel: 'Open documentation',
      },
    },
  ],
  related: ['button', 'stat'],
});

export const badgeManifest = defineCatalogManifest({
  id: 'badge',
  package: PKG,
  label: 'Badge',
  summary: 'A compact status or category label.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Show a short status or category next to a title'],
  dontUseWhen: ['A removable filter (use tag)', 'A toggleable filter chip (use chip)'],
  a11y: [
    'Never convey meaning by color alone; pair with a word.',
    'In a catalog tree, set label (or put the word in an inline-text child).',
  ],
  props: propsFrom(badgePropNames, {
    variant: {
      kind: 'enum',
      enumValues: badgeVariants,
      default: 'default',
    },
    label: {
      kind: 'string',
      description: 'Plain-text badge word, escaped; replaces children when both are given',
    },
    class: { kind: 'string' },
    children: { kind: 'slot', description: 'The badge word (an inline-text node in a tree)' },
  }),
  examples: [
    { id: 'success', title: 'Success badge', props: { variant: 'success' } },
    { id: 'labelled', title: 'Labelled badge', props: { variant: 'info', label: 'Shipped' } },
  ],
  related: ['tag', 'chip', 'inline-text'],
});

export const tagManifest = defineCatalogManifest({
  id: 'tag',
  package: PKG,
  label: 'Tag',
  summary: 'A labeled chip that can be removed.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Show a selected filter or category the user can remove'],
  dontUseWhen: ['Static status (use badge)', 'A pressed filter control (use chip)'],
  a11y: 'Remove control has an accessible name; pending remove is disabled.',
  props: propsFrom(tagPropNames, {
    label: { kind: 'string', required: true, description: 'Visible label' },
    variant: { kind: 'enum', enumValues: badgeVariants, default: 'secondary' },
    removeLabel: { kind: 'string', default: 'Remove' },
    onRemove: { kind: 'event', description: 'Called when remove is activated' },
    disabled: { kind: 'boolean', default: false },
    class: { kind: 'string' },
  }),
  examples: [
    { id: 'removable', title: 'Removable tag', props: { label: 'Logistics', variant: 'info' } },
  ],
  related: ['badge', 'chip'],
});

export const chipManifest = defineCatalogManifest({
  id: 'chip',
  package: PKG,
  label: 'Chip',
  summary: 'A toggleable filter chip (pressed state).',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Filter toggles in a toolbar or facet list'],
  dontUseWhen: ['Navigation (use a link)', 'A one-shot action (use button)'],
  a11y: 'Uses aria-pressed for selection; must be a real button.',
  props: propsFrom(chipPropNames, {
    label: { kind: 'string', required: true },
    variant: { kind: 'enum', enumValues: badgeVariants, default: 'outline' },
    selected: { kind: 'boolean', default: false },
    disabled: { kind: 'boolean', default: false },
    type: {
      kind: 'enum',
      enumValues: ['button', 'submit', 'reset'],
      default: 'button',
    },
    class: { kind: 'string' },
  }),
  examples: [
    { id: 'selected', title: 'Selected chip', props: { label: 'Active', selected: true } },
  ],
  related: ['badge', 'tag', 'button'],
});

export const tableManifest = defineCatalogManifest({
  id: 'table',
  package: PKG,
  label: 'Table',
  summary: 'A responsive data table with density, stacking and sticky header options.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Tabular comparison of many rows and columns'],
  dontUseWhen: ['A single metric (use stat or kpi)', 'A free-form card layout'],
  a11y: [
    'Real table markup with caption or label for the scroll region',
    'Stacked mode keeps labels associated with cells',
    'busy sets aria-busy on the table',
  ],
  props: propsFrom(tablePropNames, {
    variant: {
      kind: 'enum',
      enumValues: ['plain', 'striped', 'grid'],
      default: 'plain',
    },
    density: {
      kind: 'enum',
      enumValues: ['compact', 'default', 'comfortable'],
      default: 'default',
    },
    stack: {
      kind: 'enum',
      enumValues: ['never', 'sm', 'md'],
      default: 'never',
      description: 'Stack rows into labelled cards when the container is narrow',
    },
    stickyHeader: { kind: 'boolean', default: false },
    maxBlockSize: {
      kind: 'string',
      description: 'CSS length capping height so the body scrolls',
    },
    label: { kind: 'string', description: 'Accessible name for the scroll area' },
    busy: { kind: 'boolean', default: false },
    wrapperClass: { kind: 'string' },
    class: { kind: 'string' },
  }),
  examples: [
    {
      id: 'striped-sticky',
      title: 'Striped sticky header',
      props: { variant: 'striped', stickyHeader: true, stack: 'sm', label: 'Orders' },
    },
  ],
  related: ['stat', 'empty-state'],
});

const alertSharedDetail = {
  tone: {
    kind: 'enum' as const,
    enumValues: alertTones,
    default: 'info',
  },
  title: { kind: 'string' as const, description: 'Optional heading' },
  text: { kind: 'string' as const, description: 'Body copy', trust: 'untrusted' as const },
  hideIcon: { kind: 'boolean' as const, default: false },
  icon: { kind: 'slot' as const, description: 'Custom icon snippet' },
  actionLabel: { kind: 'string' as const },
  actionHref: {
    kind: 'string' as const,
    description: 'Optional action link (URL policy)',
    trust: 'developer' as const,
  },
  onAction: { kind: 'event' as const },
  dismissible: { kind: 'boolean' as const, default: false },
  dismissLabel: { kind: 'string' as const, default: 'Dismiss' },
  onDismiss: { kind: 'event' as const },
  class: { kind: 'string' as const },
};

export const alertManifest = defineCatalogManifest({
  id: 'alert',
  package: PKG,
  label: 'Alert',
  summary: 'Inline feedback for a page section (status or error).',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Report a result or problem next to the related content'],
  dontUseWhen: ['A full-page failure (use error-state)', 'A quiet tip in docs (use callout)'],
  a11y: 'error tone uses role=alert; other tones use role=status; dismiss is named.',
  props: propsFrom(alertPropNames, alertSharedDetail),
  examples: [
    {
      id: 'warning',
      title: 'Warning alert',
      props: { tone: 'warning', title: 'Check inventory', text: 'Three SKUs are low.' },
    },
  ],
  related: ['callout', 'banner', 'error-state'],
});

export const calloutManifest = defineCatalogManifest({
  id: 'callout',
  package: PKG,
  label: 'Callout',
  summary: 'Emphasized documentation-style tip with a strong start edge.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Highlight a tip or note beside prose'],
  dontUseWhen: ['A blocking error (use alert with error tone)', 'A site-wide notice (use banner)'],
  a11y: 'Same tone roles as Alert; never color-only meaning.',
  props: propsFrom(calloutPropNames, alertSharedDetail),
  examples: [
    {
      id: 'info-tip',
      title: 'Info callout',
      props: { tone: 'info', title: 'Tip', text: 'Export works offline in this prototype.' },
    },
  ],
  related: ['alert', 'banner'],
});

export const bannerManifest = defineCatalogManifest({
  id: 'banner',
  package: PKG,
  label: 'Banner',
  summary: 'Full-width notice across a page or app shell.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Announce a global condition (maintenance, trial)'],
  dontUseWhen: ['Inline field errors (use alert near the field)'],
  a11y: 'Same tone roles as Alert; dismiss control is optional and named.',
  props: propsFrom(bannerPropNames, alertSharedDetail),
  examples: [
    {
      id: 'brand',
      title: 'Brand banner',
      props: {
        tone: 'brand',
        title: 'New workspace',
        text: 'Invite teammates from Settings.',
        dismissible: true,
      },
    },
  ],
  related: ['alert', 'callout'],
});

export const statManifest = defineCatalogManifest({
  id: 'stat',
  package: PKG,
  label: 'Stat',
  summary: 'A single metric with optional delta, trend and sparkline slot.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Show one KPI with a human-formatted value'],
  dontUseWhen: ['A currency/percent KPI with previous period math (use kpi)'],
  a11y: 'Label and value are text; trend has a spoken word, not color alone.',
  props: propsFrom(statPropNames, {
    label: { kind: 'string', required: true },
    value: { kind: 'unknown', required: true, description: 'string or number' },
    delta: { kind: 'unknown', description: 'string or number change' },
    trend: { kind: 'enum', enumValues: ['up', 'down', 'neutral'] },
    positive: {
      kind: 'enum',
      enumValues: ['up', 'down'],
      default: 'up',
      description: 'Which direction is good',
    },
    hint: { kind: 'string' },
    icon: { kind: 'slot' },
    sparkline: { kind: 'slot' },
    variant: {
      kind: 'enum',
      enumValues: ['elevated', 'flat'],
      default: 'elevated',
    },
    class: { kind: 'string' },
  }),
  examples: [
    {
      id: 'revenue',
      title: 'Revenue up',
      props: { label: 'Revenue', value: '$12.4k', delta: '+8%', trend: 'up' },
    },
  ],
  related: ['kpi', 'card'],
});

export const kpiManifest = defineCatalogManifest({
  id: 'kpi',
  package: PKG,
  label: 'KPI',
  summary: 'A formatted metric with unit, previous-period delta and optional link.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Show a numeric KPI with unit formatting and comparison'],
  dontUseWhen: ['A free-form already-formatted string (use stat)'],
  a11y: 'Loading and empty states are announced; linked tiles use real anchors after URL policy.',
  props: propsFrom(kpiPropNames, {
    label: { kind: 'string', required: true },
    value: { kind: 'number', description: 'Current numeric value (nullable)' },
    unit: {
      kind: 'enum',
      enumValues: ['number', 'compact', 'cents', 'percent'],
      default: 'number',
    },
    currency: { kind: 'string', description: 'ISO currency when unit is cents' },
    previous: { kind: 'number' },
    comparisonLabel: { kind: 'string' },
    positive: { kind: 'enum', enumValues: ['up', 'down'], default: 'up' },
    sparkline: { kind: 'slot' },
    href: { kind: 'string', trust: 'developer' },
    hrefTrust: {
      kind: 'enum',
      enumValues: ['developer', 'untrusted'],
      default: 'developer',
    },
    loading: { kind: 'boolean', default: false },
    empty: { kind: 'unknown', description: 'true or empty message string' },
    variant: {
      kind: 'enum',
      enumValues: ['elevated', 'flat'],
      default: 'elevated',
    },
    class: { kind: 'string' },
  }),
  examples: [
    {
      id: 'orders',
      title: 'Orders KPI',
      props: {
        label: 'Orders',
        value: 1280,
        unit: 'compact',
        previous: 1100,
        comparisonLabel: 'vs last week',
      },
    },
  ],
  related: ['stat', 'card'],
});

export const emptyStateManifest = defineCatalogManifest({
  id: 'empty-state',
  package: PKG,
  label: 'Empty state',
  summary: 'Placeholder when a list or panel has nothing to show yet.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['First-run or filtered-empty lists'],
  dontUseWhen: ['A failure after a request (use error-state)'],
  a11y: 'Title is required text; illustration is decorative (aria-hidden).',
  props: propsFrom(emptyStatePropNames, {
    title: { kind: 'string', required: true },
    description: { kind: 'string' },
    illustration: { kind: 'slot' },
    action: { kind: 'slot' },
    size: { kind: 'enum', enumValues: ['sm', 'md'], default: 'md' },
    class: { kind: 'string' },
  }),
  examples: [
    {
      id: 'no-orders',
      title: 'No orders',
      props: { title: 'No orders yet', description: 'Create an order to get started.', size: 'md' },
    },
  ],
  related: ['error-state', 'table'],
});

export const errorStateManifest = defineCatalogManifest({
  id: 'error-state',
  package: PKG,
  label: 'Error state',
  summary: 'Full-panel failure with optional retry.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['A view failed to load and the user can retry'],
  dontUseWhen: ['A soft warning inline (use alert)'],
  a11y: 'Uses role=alert; retry is a real button with pending support.',
  props: propsFrom(errorStatePropNames, {
    title: { kind: 'string', default: 'Something went wrong' },
    message: { kind: 'string' },
    onRetry: { kind: 'event' },
    retryLabel: { kind: 'string', default: 'Try again' },
    action: { kind: 'slot' },
    class: { kind: 'string' },
  }),
  examples: [
    {
      id: 'retry',
      title: 'Retry error',
      props: {
        title: 'Could not load orders',
        message: 'Check your connection.',
        retryLabel: 'Retry',
      },
    },
  ],
  related: ['empty-state', 'alert'],
});

export const stepperManifest = defineCatalogManifest({
  id: 'stepper',
  package: PKG,
  label: 'Stepper',
  summary: 'Horizontal or vertical progress through ordered steps.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Show multi-step onboarding or checkout progress'],
  dontUseWhen: ['A chronological event log (use timeline)'],
  a11y: 'nav with an accessible name; current step is announced; completed steps may be activatable.',
  props: propsFrom(stepperPropNames, {
    steps: {
      kind: 'array',
      required: true,
      description: 'Array of { id, label, description? }',
    },
    current: { kind: 'number', required: true, description: '0-based active index' },
    completed: { kind: 'array', description: 'Ids of completed steps' },
    orientation: {
      kind: 'enum',
      enumValues: ['horizontal', 'vertical'],
      default: 'horizontal',
    },
    onStepClick: { kind: 'event' },
    label: { kind: 'string', default: 'Progress' },
    class: { kind: 'string' },
  }),
  examples: [
    {
      id: 'checkout',
      title: 'Checkout steps',
      props: {
        current: 1,
        orientation: 'horizontal',
        steps: [
          { id: 'cart', label: 'Cart' },
          { id: 'ship', label: 'Shipping' },
          { id: 'pay', label: 'Payment' },
        ],
      },
    },
  ],
  related: ['timeline', 'layout-wizard'],
});

export const timelineManifest = defineCatalogManifest({
  id: 'timeline',
  package: PKG,
  label: 'Timeline',
  summary: 'Vertical or horizontal chronological list of events.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Show a sequence of events with status'],
  dontUseWhen: ['A Gantt schedule with dependencies (use @texuli/data/timeline)'],
  a11y: [
    'Ordered list with an accessible name',
    'Status has a spoken word and marker shape, not color alone',
    'Item links pass the URL policy',
  ],
  props: propsFrom(timelinePropNames, {
    items: {
      kind: 'array',
      description: 'Data-driven items (or compose TimelineItem children)',
    },
    orientation: {
      kind: 'enum',
      enumValues: ['vertical', 'horizontal'],
      default: 'vertical',
    },
    label: { kind: 'string' },
    messages: { kind: 'object', description: 'Localized label/status words' },
    hrefTrust: {
      kind: 'enum',
      enumValues: ['developer', 'untrusted'],
      default: 'developer',
    },
    item: { kind: 'slot', description: 'Extra content under each data item' },
    class: { kind: 'string' },
  }),
  examples: [
    {
      id: 'shipment',
      title: 'Shipment timeline',
      props: {
        orientation: 'vertical',
        items: [
          { id: '1', title: 'Packed', time: 'Mon', status: 'complete' },
          { id: '2', title: 'In transit', time: 'Tue', status: 'current' },
          { id: '3', title: 'Delivered', time: 'Wed', status: 'upcoming' },
        ],
      },
    },
  ],
  related: ['stepper'],
});

export const kbdManifest = defineCatalogManifest({
  id: 'kbd',
  package: PKG,
  label: 'Kbd',
  summary: 'Inline keyboard key affordance.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Document a shortcut next to a control'],
  dontUseWhen: ['Multi-line code (use code with variant block)'],
  a11y: 'Rendered as a real kbd element; text is escaped.',
  props: propsFrom(kbdPropNames, {
    label: {
      kind: 'string',
      description: 'Plain-text key name, escaped; replaces children when both are given',
    },
    class: { kind: 'string' },
    children: { kind: 'slot', description: 'The key name (an inline-text node in a tree)' },
  }),
  examples: [
    { id: 'save', title: 'Save shortcut', props: {} },
    { id: 'labelled', title: 'Labelled key', props: { label: 'Ctrl' } },
  ],
  related: ['code', 'inline-text'],
});

/**
 * The sanctioned inline text node (audit G03): plain text for slot-only
 * components such as button, label and badge, whose Svelte surface takes
 * a `children` snippet and no string label. It is a catalog node, not a
 * component: the host paints `text` as one escaped text node, and the
 * renderer drops any children it is given.
 */
export const inlineTextManifest = defineCatalogManifest({
  id: 'inline-text',
  package: '@texuli/catalog',
  label: 'Inline text',
  summary: 'A plain text run for the slot of a slot-only component (button, label, badge).',
  tier: 'app',
  agentEmittable: false,
  useWhen: [
    'Give a form label, description, field error or menu trigger its visible text',
    'Text for a button, badge or kbd when the tree prefers a child to the label prop',
    'Any slot that needs a short phrase rather than a block',
  ],
  dontUseWhen: [
    'A paragraph, heading or list (use blocks-text)',
    'Text that needs formatting or links (use blocks-text)',
    'A component that already has a label or title prop (set that prop)',
  ],
  a11y: [
    'Painted as one escaped text node, so it names the parent control (a button label)',
    'A leaf: children are dropped',
  ],
  props: propsFrom(inlineTextPropNames, {
    text: {
      kind: 'string',
      required: true,
      description: 'Plain text; the renderer refuses markup-like strings',
    },
  }),
  examples: [
    { id: 'button-label', title: 'Button label', props: { text: 'Save changes' } },
    { id: 'badge-word', title: 'Badge word', props: { text: 'Shipped' } },
  ],
  related: ['button', 'label', 'badge', 'kbd'],
});

export const codeManifest = defineCatalogManifest({
  id: 'code',
  package: PKG,
  label: 'Code',
  summary: 'Inline or block code with escaped text (no HTML).',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Show a short code sample or token'],
  dontUseWhen: ['A full syntax-highlighted editor'],
  a11y: 'Text is always escaped; language is display-only metadata.',
  props: propsFrom(codePropNames, {
    value: {
      kind: 'string',
      description: 'Plain source (preferred for agent/user content)',
      trust: 'untrusted',
    },
    variant: {
      kind: 'enum',
      enumValues: ['inline', 'block'],
      default: 'inline',
    },
    language: { kind: 'string', description: 'Optional language hint' },
    class: { kind: 'string' },
  }),
  examples: [
    {
      id: 'block-ts',
      title: 'TypeScript block',
      props: { variant: 'block', language: 'ts', value: 'const n = 1;' },
    },
  ],
  related: ['kbd'],
});

/** Every display/feedback manifest in stable id order. */
export const DISPLAY_MANIFESTS: readonly CatalogManifest[] = Object.freeze([
  alertManifest,
  badgeManifest,
  bannerManifest,
  calloutManifest,
  cardManifest,
  chipManifest,
  codeManifest,
  emptyStateManifest,
  errorStateManifest,
  inlineTextManifest,
  kbdManifest,
  kpiManifest,
  statManifest,
  stepperManifest,
  tableManifest,
  tagManifest,
  timelineManifest,
]);

/** Map of component id → expected prop names for type/schema parity tests. */
export const DISPLAY_PROP_NAMES = Object.freeze({
  alert: alertPropNames,
  badge: badgePropNames,
  banner: bannerPropNames,
  callout: calloutPropNames,
  card: cardPropNames,
  chip: chipPropNames,
  code: codePropNames,
  'empty-state': emptyStatePropNames,
  'error-state': errorStatePropNames,
  'inline-text': inlineTextPropNames,
  kbd: kbdPropNames,
  kpi: kpiPropNames,
  stat: statPropNames,
  stepper: stepperPropNames,
  table: tablePropNames,
  tag: tagPropNames,
  timeline: timelinePropNames,
} as const);
