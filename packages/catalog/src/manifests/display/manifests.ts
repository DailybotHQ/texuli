import { manifestData } from '../../manifest/data.ts';
import type { CatalogManifest } from '../../manifest/types.ts';
import { stampDisplayAxes } from './axes.ts';
import {
  accordionPropNames,
  alertPropNames,
  avatarGroupGridPropNames,
  avatarPropNames,
  badgePropNames,
  bannerPropNames,
  boxPropNames,
  calloutPropNames,
  cardPropNames,
  carouselPropNames,
  chipPropNames,
  codePropNames,
  colorSwatchPropNames,
  emptyStatePropNames,
  errorStatePropNames,
  headingPropNames,
  iconPropNames,
  inlineTextPropNames,
  kbdPropNames,
  kpiPropNames,
  linkPropNames,
  listItemPropNames,
  listPropNames,
  markPropNames,
  progressPropNames,
  prosePropNames,
  separatorPropNames,
  skeletonPropNames,
  spinnerPropNames,
  statPropNames,
  stepperPropNames,
  tablePropNames,
  tabsPropNames,
  tagPropNames,
  textPropNames,
  timelinePropNames,
} from './prop-names.ts';

/* @__NO_SIDE_EFFECTS__ */
function defineDisplayManifest(input: CatalogManifest): Readonly<CatalogManifest> {
  return stampDisplayAxes(manifestData(input));
}

const PKG = 'texuli';
const CATEGORY_COLOR_VALUES = [
  'none',
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
  'chart-6',
  'chart-7',
  'chart-8',
] as const;

/* @__NO_SIDE_EFFECTS__ */
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
const boxFills = [
  'none',
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
  'chart-6',
  'chart-7',
  'chart-8',
  'primary',
  'secondary',
  'success',
  'warning',
  'destructive',
  'info',
  'neutral',
] as const;
const boxSurfaces = [
  'transparent',
  'default',
  'muted',
  'subtle',
  'elevated',
  'canvas',
  'primary',
  'brand',
  'success',
  'warning',
  'destructive',
  'info',
  'primary-soft',
  'translucent',
] as const;

const headingSizes = ['display', '4xl', '3xl', '2xl', 'xl', 'lg', 'md', 'sm', 'xs'] as const;
const tabsVariants = ['line', 'pills', 'enclosed'] as const;
const accordionVariants = ['default', 'bordered'] as const;
const textTones = [
  'default',
  'muted',
  'subtle',
  'primary',
  'success',
  'warning',
  'destructive',
  'info',
  'inherit',
] as const;

/** Heading (ADR-032): the semantic level and a visual size from the type scale. */
export const headingManifest = /* @__PURE__ */ defineDisplayManifest({
  id: 'heading',
  package: PKG,
  label: 'Heading',
  summary: 'A page title or section heading: a semantic h1–h6 with a size from the type scale.',
  tier: 'app',
  agentEmittable: false,
  useWhen: [
    'Title a page, a section or a panel',
    'Keep visual hierarchy in a locked prototype, where typography utilities are refused',
  ],
  dontUseWhen: ['Body copy, labels or captions (use text)', 'Long-form content (use prose)'],
  a11y: [
    'Renders the semantic heading element for its level; pick levels in document order.',
    'size changes only the look, never the level announced to assistive technology.',
  ],
  props: propsFrom(headingPropNames, {
    level: {
      kind: 'number',
      default: 2,
      description: 'The semantic level, 1 to 6: renders <h1>…<h6>',
    },
    size: {
      kind: 'enum',
      enumValues: headingSizes,
      default: 'lg',
      description:
        'Visual size, independent of the level (default from the level: 1 xl, 2 lg, 3 md, 4–6 sm); xs is ~0.875rem for small card titles; 2xl–4xl sit between xl and display',
    },
    responsive: {
      kind: 'boolean',
      default: false,
      description:
        'Scale the size down on narrow screens: fluid from two scale steps below up to the size',
    },
    tracking: {
      kind: 'enum',
      enumValues: ['default', 'tight'],
      default: 'default',
      description: "Letter spacing: the role's own, or tight (--tx-letter-spacing-tight)",
    },
    tone: { kind: 'enum', enumValues: ['default', 'muted'], default: 'default' },
    truncate: { kind: 'boolean', default: false, description: 'One line with an ellipsis' },
    label: {
      kind: 'string',
      description: 'Plain-text heading, escaped; replaces children when both are given',
    },
    class: { kind: 'string' },
    children: { kind: 'slot', description: 'The heading text' },
  }),
  examples: [
    {
      id: 'page-title',
      title: 'Page title',
      props: { level: 1, size: 'xl', label: 'Quarterly report' },
    },
    {
      id: 'section',
      title: 'Muted section heading',
      props: { level: 2, size: 'md', tone: 'muted', label: 'Details' },
    },
    {
      id: 'hero',
      title: 'Responsive hero title',
      props: {
        level: 1,
        size: '4xl',
        responsive: true,
        tracking: 'tight',
        label: 'Plan the quarter',
      },
    },
    {
      id: 'card-title',
      title: 'Small card title',
      props: { level: 3, size: 'xs', label: 'Open tasks' },
    },
  ],
  related: ['text', 'prose'],
});

/** Text (ADR-032): body copy, labels, captions and small print. */
export const textManifest = /* @__PURE__ */ defineDisplayManifest({
  id: 'text',
  package: PKG,
  label: 'Text',
  summary: 'Body copy, labels and small print with a size, tone and weight from the design system.',
  tier: 'app',
  agentEmittable: false,
  useWhen: [
    'Body text, helper text, captions, muted or small print',
    'Text with a status ink (success, warning, destructive, info) next to a word that says it',
  ],
  dontUseWhen: ['A title or section heading (use heading)', 'Long-form content (use prose)'],
  a11y: [
    'Never renders a heading element: as is p, span, div, label, small or strong.',
    'A tone never carries meaning alone; the words say it.',
  ],
  props: propsFrom(textPropNames, {
    as: {
      kind: 'enum',
      enumValues: ['p', 'span', 'div', 'label', 'small', 'strong'],
      default: 'p',
    },
    size: {
      kind: 'enum',
      enumValues: ['figure', 'lg', 'md', 'sm', 'xs', 'inherit'],
      default: 'md',
      description:
        "figure is a large number outside stat (the title size of the type scale); inherit takes the parent's size and line height",
    },
    tone: { kind: 'enum', enumValues: textTones, default: 'default' },
    weight: { kind: 'enum', enumValues: ['regular', 'medium', 'semibold'], default: 'regular' },
    truncate: { kind: 'boolean', default: false, description: 'One line with an ellipsis' },
    lineClamp: { kind: 'number', description: 'Clamp to 1 to 10 lines with an ellipsis' },
    align: { kind: 'enum', enumValues: ['start', 'center', 'end'], default: 'start' },
    mono: { kind: 'boolean', default: false, description: "The design system's code family" },
    tabular: {
      kind: 'boolean',
      default: false,
      description: 'Tabular figures (font-variant-numeric: tabular-nums) for numbers that line up',
    },
    transform: {
      kind: 'enum',
      enumValues: ['none', 'uppercase', 'lowercase', 'capitalize'],
      default: 'none',
    },
    tracking: {
      kind: 'enum',
      enumValues: ['normal', 'wide'],
      default: 'normal',
      description: 'Letter spacing; wide is the eyebrow tracking (--tx-letter-spacing-wide)',
    },
    italic: { kind: 'boolean', default: false },
    strikethrough: { kind: 'boolean', default: false, description: 'Line-through' },
    for: { kind: 'string', description: 'With as="label": the id of the labelled control' },
    label: {
      kind: 'string',
      description: 'Plain text, escaped; replaces children when both are given',
    },
    class: { kind: 'string' },
    children: { kind: 'slot', description: 'The text' },
  }),
  examples: [
    {
      id: 'muted',
      title: 'Muted helper text',
      props: { size: 'sm', tone: 'muted', label: 'Updated an hour ago' },
    },
    {
      id: 'caption',
      title: 'Small print',
      props: { as: 'small', size: 'xs', tone: 'subtle', label: 'Prices exclude tax.' },
    },
    {
      id: 'eyebrow',
      title: 'Eyebrow (overline)',
      props: {
        as: 'span',
        size: 'xs',
        tone: 'muted',
        transform: 'uppercase',
        tracking: 'wide',
        label: 'Revenue',
      },
    },
    {
      id: 'figure',
      title: 'Large figure',
      props: { as: 'span', size: 'figure', tabular: true, label: '1,284' },
    },
    {
      id: 'inherit',
      title: 'Nested text that inherits',
      props: { as: 'span', size: 'inherit', tone: 'inherit', weight: 'semibold', label: 'Pro' },
    },
    {
      id: 'struck',
      title: 'Struck price',
      props: { as: 'span', strikethrough: true, tone: 'muted', label: '$48' },
    },
  ],
  related: ['heading', 'prose', 'inline-text', 'mark'],
});

/** Prose (ADR-032): long-form reading rhythm from the design system. */
export const proseManifest = /* @__PURE__ */ defineDisplayManifest({
  id: 'prose',
  package: PKG,
  label: 'Prose',
  summary:
    "Long-form text with the design system's reading rhythm: measure, spacing, headings, lists.",
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Articles, docs, descriptions and other long text written as markup'],
  dontUseWhen: ['One line or a short label (use text)', 'A block document (use document)'],
  a11y: 'Keeps the host markup and its semantics; a 65ch measure keeps lines readable.',
  props: propsFrom(prosePropNames, {
    as: { kind: 'enum', enumValues: ['div', 'article', 'section'], default: 'div' },
    size: { kind: 'enum', enumValues: ['md', 'lg'], default: 'md' },
    class: { kind: 'string' },
    children: { kind: 'slot', description: 'The long-form markup (paragraphs, headings, lists)' },
  }),
  examples: [{ id: 'article', title: 'Article body', props: { as: 'article', size: 'md' } }],
  related: ['heading', 'text'],
});

/** Box (ADR-032): padding, radius, border, elevation, surface and closed token fill. */
export const boxManifest = /* @__PURE__ */ defineDisplayManifest({
  id: 'box',
  package: PKG,
  label: 'Box',
  summary: 'A panel or region with layout options and token-based surface or color-reference fill.',
  tier: 'app',
  agentEmittable: false,
  useWhen: [
    'Frame a group of content as a bordered or filled panel',
    'Space and surface a region in a locked prototype, where visual utilities are refused',
  ],
  dontUseWhen: ['A clickable surface (use card with href)', 'Page layout (use a layout)'],
  a11y: 'Not interactive. Use as="section" or "aside" with a heading for a landmark-like region.',
  props: propsFrom(boxPropNames, {
    as: {
      kind: 'enum',
      enumValues: ['div', 'section', 'article', 'aside', 'header', 'footer'],
      default: 'div',
    },
    padding: { kind: 'enum', enumValues: ['none', 'sm', 'md', 'lg', 'xl'], default: 'md' },
    radius: { kind: 'enum', enumValues: ['none', 'sm', 'md', 'lg', 'xl', 'full'], default: 'md' },
    border: {
      kind: 'enum',
      enumValues: [
        'none',
        'default',
        'strong',
        'block-start',
        'block-end',
        'inline-start',
        'inline-end',
        'dashed',
      ],
      default: 'none',
      description:
        'All sides, one logical side (block-start, block-end, inline-start, inline-end), or dashed',
    },
    elevation: { kind: 'enum', enumValues: ['none', 'sm', 'md', 'lg'], default: 'none' },
    surface: {
      kind: 'enum',
      enumValues: boxSurfaces,
      default: 'transparent',
      description:
        'The surface (the variant axis): primary is solid, the semantic tones and primary-soft use soft token fills with AA ink, and translucent is glass for sticky headers',
    },
    fill: {
      kind: 'enum',
      enumValues: boxFills,
      default: 'none',
      description:
        'Optional closed token reference (chart-1 through chart-8 or a semantic color role); never a CSS color or arbitrary value',
    },
    class: { kind: 'string' },
    children: { kind: 'slot', description: 'The panel content' },
  }),
  examples: [
    {
      id: 'bordered',
      title: 'Bordered panel',
      props: { padding: 'lg', border: 'default', surface: 'default' },
    },
    {
      id: 'muted',
      title: 'Muted region',
      props: { padding: 'md', radius: 'lg', surface: 'muted' },
    },
    {
      id: 'app-header',
      title: 'App header (no card chrome)',
      props: {
        as: 'header',
        padding: 'md',
        radius: 'none',
        border: 'block-end',
        surface: 'default',
      },
    },
    {
      id: 'logo-tile',
      title: 'Brand logo tile',
      props: { padding: 'md', radius: 'lg', surface: 'primary' },
    },
    {
      id: 'page-canvas',
      title: 'Page canvas',
      props: { as: 'div', padding: 'lg', radius: 'none', surface: 'canvas' },
    },
    {
      id: 'sticky-header',
      title: 'Translucent sticky header',
      props: {
        as: 'header',
        padding: 'md',
        radius: 'none',
        border: 'block-end',
        surface: 'translucent',
      },
    },
    {
      id: 'dashed',
      title: 'Dashed panel',
      props: { padding: 'md', border: 'dashed', surface: 'default' },
    },
  ],
  related: ['card', 'heading', 'text'],
});

const SWATCH_COLORS = [
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
  'chart-6',
  'chart-7',
  'chart-8',
  'primary',
  'secondary',
  'success',
  'warning',
  'destructive',
  'info',
  'neutral',
] as const;

/** ColorSwatch (ADR-032): a closed token or data-viz color chip with contrast ink. */
export const colorSwatchManifest = /* @__PURE__ */ defineDisplayManifest({
  id: 'color-swatch',
  package: PKG,
  label: 'Color swatch',
  summary:
    'A chip of a closed palette, role or data-viz color with contrast ink from tokens. Never free CSS.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Show a named token or series color in a legend, key or palette'],
  dontUseWhen: ['A status label (use badge)', 'A long-form color name in a sentence (use text)'],
  a11y: 'Pair the fill with a text label; never convey the color by fill alone.',
  props: propsFrom(colorSwatchPropNames, {
    color: {
      kind: 'enum',
      enumValues: [...SWATCH_COLORS],
      default: 'primary',
      description: 'Closed color reference (chart-1…8 or a role token)',
    },
    size: { kind: 'enum', enumValues: ['sm', 'md', 'lg'], default: 'md' },
    label: { kind: 'string', description: 'Plain-text label, escaped' },
    class: { kind: 'string' },
    children: { kind: 'slot', description: 'Rich label content; replaced by a non-empty label' },
  }),
  examples: [
    { id: 'primary', title: 'Primary swatch', props: { color: 'primary', label: 'Primary' } },
    {
      id: 'series',
      title: 'Chart series',
      props: { color: 'chart-1', size: 'md', label: 'North' },
    },
  ],
  related: ['badge', 'box', 'text'],
});

/** Link (ADR-032): an inline sentence link with safeHref and a token underline. */
export const linkManifest = /* @__PURE__ */ defineDisplayManifest({
  id: 'link',
  package: PKG,
  label: 'Link',
  summary:
    'An inline sentence link. Underline and color come from link tokens; href is filtered by the URL policy.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['A word or phrase inside a sentence that navigates'],
  dontUseWhen: [
    'A button-shaped control (use button with href)',
    'A whole card (use card with href)',
  ],
  a11y: [
    'Renders one real link that wraps in the line',
    'http(s) destinations, external, and target=_blank add rel=noopener noreferrer',
    'A refused href renders as text, never a dead link',
  ],
  props: propsFrom(linkPropNames, {
    href: {
      kind: 'string',
      required: true,
      description: 'Destination (URL policy)',
      trust: 'developer',
    },
    hrefTrust: {
      kind: 'enum',
      enumValues: ['developer', 'untrusted'],
      default: 'developer',
    },
    external: {
      kind: 'boolean',
      default: false,
      description: 'Adds rel=noopener noreferrer (also added for http(s) and target=_blank)',
    },
    target: { kind: 'string', description: 'Link target; _blank always adds noopener noreferrer' },
    rel: {
      kind: 'string',
      description: 'Extra rel tokens; noopener/noreferrer are merged when needed',
    },
    label: { kind: 'string', description: 'Plain-text label, escaped' },
    class: { kind: 'string' },
    children: { kind: 'slot', description: 'Rich link text; replaced by a non-empty label' },
  }),
  examples: [
    {
      id: 'inline',
      title: 'Inline sentence link',
      props: { href: 'https://example.com/guide', label: 'the harbor guide' },
    },
    {
      id: 'external',
      title: 'External link',
      props: {
        href: 'https://example.com/docs',
        external: true,
        label: 'Docs',
      },
    },
  ],
  related: ['button', 'prose', 'text'],
});

export const cardManifest = /* @__PURE__ */ defineDisplayManifest({
  id: 'card',
  package: PKG,
  label: 'Card',
  summary: 'A surface for grouping related content with optional stretched-link behavior.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Group related content in a bordered surface', 'Make a whole tile a single link'],
  dontUseWhen: [
    'A single line of chrome (use badge or button)',
    'A data grid of many rows (use table)',
  ],
  a11y: [
    'When href is set, one real link covers the card; nested actions sit above it',
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
    linkLabel: { kind: 'string', description: 'Accessible name of the stretched primary link' },
    actions: {
      kind: 'slot',
      description: 'Secondary actions (pin, menu) above the stretched link',
    },
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

export const badgeManifest = /* @__PURE__ */ defineDisplayManifest({
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
    color: { kind: 'enum', enumValues: CATEGORY_COLOR_VALUES, default: 'none' },
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

export const tagManifest = /* @__PURE__ */ defineDisplayManifest({
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
    color: { kind: 'enum', enumValues: CATEGORY_COLOR_VALUES, default: 'none' },
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

export const chipManifest = /* @__PURE__ */ defineDisplayManifest({
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

export const tableManifest = /* @__PURE__ */ defineDisplayManifest({
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

export const alertManifest = /* @__PURE__ */ defineDisplayManifest({
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

export const calloutManifest = /* @__PURE__ */ defineDisplayManifest({
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

export const bannerManifest = /* @__PURE__ */ defineDisplayManifest({
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

export const statManifest = /* @__PURE__ */ defineDisplayManifest({
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
    value: {
      kind: 'string',
      required: true,
      description: 'The formatted value as display text, such as "$12.4k" or "98%".',
    },
    delta: { kind: 'string', description: 'The formatted change as display text, such as "+4%".' },
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

export const kpiManifest = /* @__PURE__ */ defineDisplayManifest({
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

export const emptyStateManifest = /* @__PURE__ */ defineDisplayManifest({
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

export const errorStateManifest = /* @__PURE__ */ defineDisplayManifest({
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

export const stepperManifest = /* @__PURE__ */ defineDisplayManifest({
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

export const timelineManifest = /* @__PURE__ */ defineDisplayManifest({
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

const avatarSizes = ['xs', 'sm', 'md', 'lg'] as const;

export const avatarGroupGridManifest = /* @__PURE__ */ defineDisplayManifest({
  id: 'avatar-group-grid',
  package: PKG,
  label: 'AvatarGroupGrid',
  summary: 'Up to four faces in one avatar circle, +N past four.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['A group chat shown as one avatar'],
  dontUseWhen: ['A row of people (use AvatarGroup)'],
  a11y: 'One image named by label or the member names.',
  props: propsFrom(avatarGroupGridPropNames, {
    items: { kind: 'array', required: true, description: '{ name, src?, srcset? }[]' },
    size: { kind: 'enum', enumValues: avatarSizes, default: 'md' },
    label: { kind: 'string', description: 'Accessible name' },
    overflowLabel: { kind: 'string', default: '+{n}' },
    class: { kind: 'string' },
  }),
  examples: [
    { id: 'chat', title: 'Group chat', props: { items: [{ name: 'Ada' }, { name: 'Lin' }] } },
  ],
});

const iconSizes = ['xs', 'sm', 'md', 'lg'] as const;
const iconTones = [
  'default',
  'primary',
  'success',
  'warning',
  'destructive',
  'info',
  'neutral',
] as const;
const feedbackSizes = ['sm', 'md', 'lg'] as const;
const feedbackTones = ['primary', 'success', 'warning', 'destructive', 'info', 'neutral'] as const;

/** One catalog id for every icon set (built-in texuli names and Lucide). */
export const iconManifest = /* @__PURE__ */ defineDisplayManifest({
  id: 'icon',
  package: PKG,
  label: 'Icon',
  summary: 'A glyph by name or Lucide component; allowing icon allows every icon set.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['A decorative or labelled glyph next to a control or a list row'],
  dontUseWhen: ['A pressable control (use icon-button)', 'Navigation chrome (use nav-icon)'],
  a11y: [
    'With a label it is an image; without a label it is decorative (aria-hidden).',
    'Unknown names render nothing.',
  ],
  props: propsFrom(iconPropNames, {
    icon: { kind: 'string', description: 'Built-in name, registered name, or a Lucide component' },
    size: { kind: 'enum', enumValues: iconSizes, default: 'md' },
    tone: { kind: 'enum', enumValues: iconTones, default: 'default' },
    label: { kind: 'string', description: 'Accessible name; omit for decorative' },
    class: { kind: 'string' },
  }),
  examples: [
    { id: 'search', title: 'Search glyph', props: { icon: 'search', label: 'Search' } },
    { id: 'muted', title: 'Muted chevron', props: { icon: 'chevron-down', tone: 'neutral' } },
  ],
  related: ['icon-button', 'nav-icon'],
});

export const avatarManifest = /* @__PURE__ */ defineDisplayManifest({
  id: 'avatar',
  package: PKG,
  label: 'Avatar',
  summary: 'A face or initials for one person, with an optional presence status.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Show who wrote a message, who owns a task, or who is in a thread'],
  dontUseWhen: ['A group of faces in one circle (use avatar-group-grid)'],
  a11y: ['Named by the person unless decorative.', 'Image URLs pass the untrusted image policy.'],
  props: propsFrom(avatarPropNames, {
    name: { kind: 'string', required: true, trust: 'untrusted' },
    src: { kind: 'string', trust: 'untrusted' },
    srcTrust: { kind: 'enum', enumValues: ['developer', 'untrusted'], default: 'untrusted' },
    srcset: { kind: 'string', trust: 'untrusted' },
    sizes: { kind: 'string' },
    size: { kind: 'enum', enumValues: avatarSizes, default: 'md' },
    tone: {
      kind: 'enum',
      enumValues: ['primary', 'success', 'warning', 'destructive', 'info', 'neutral'],
    },
    color: { kind: 'enum', enumValues: CATEGORY_COLOR_VALUES, default: 'none' },
    shape: { kind: 'enum', enumValues: ['circle', 'square'] },
    status: { kind: 'enum', enumValues: ['online', 'away', 'busy', 'offline'] },
    decorative: { kind: 'boolean', default: false },
    delayMs: { kind: 'number', default: 0 },
    initials: { kind: 'string' },
    class: { kind: 'string' },
  }),
  examples: [{ id: 'person', title: 'Named person', props: { name: 'Ada Example', size: 'md' } }],
  related: ['avatar-group-grid', 'list-item'],
});

export const skeletonManifest = /* @__PURE__ */ defineDisplayManifest({
  id: 'skeleton',
  package: PKG,
  label: 'Skeleton',
  summary: 'A placeholder bar or circle while content loads.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Reserve space for text or an avatar that has not arrived yet'],
  dontUseWhen: ['A determinate load (use progress)', 'A live status (use spinner)'],
  a11y: 'Decorative (aria-hidden); pair it with a live status elsewhere if the wait matters.',
  props: propsFrom(skeletonPropNames, {
    size: { kind: 'enum', enumValues: feedbackSizes, default: 'md' },
    circle: { kind: 'boolean', default: false },
    class: { kind: 'string' },
  }),
  examples: [
    { id: 'line', title: 'Text line', props: { size: 'md' } },
    { id: 'face', title: 'Avatar placeholder', props: { size: 'md', circle: true } },
  ],
  related: ['spinner', 'progress'],
});

export const spinnerManifest = /* @__PURE__ */ defineDisplayManifest({
  id: 'spinner',
  package: PKG,
  label: 'Spinner',
  summary: 'An indeterminate wait indicator, labelled or decorative.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Show that a short action is in progress'],
  dontUseWhen: ['A known percent (use progress)', 'A layout placeholder (use skeleton)'],
  a11y: 'With a label it is a live status; without a label it is decorative.',
  props: propsFrom(spinnerPropNames, {
    label: { kind: 'string' },
    size: { kind: 'enum', enumValues: feedbackSizes, default: 'md' },
    tone: { kind: 'enum', enumValues: feedbackTones, default: 'primary' },
    class: { kind: 'string' },
  }),
  examples: [{ id: 'saving', title: 'Saving', props: { label: 'Saving', size: 'sm' } }],
  related: ['progress', 'skeleton'],
});

export const progressManifest = /* @__PURE__ */ defineDisplayManifest({
  id: 'progress',
  package: PKG,
  label: 'Progress',
  summary: 'A linear or circular progress bar, determinate or indeterminate.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Show how far a task has gone, or that it is still running'],
  dontUseWhen: ['A short wait with no value (use spinner)'],
  a11y: 'A progressbar named by label or ariaLabel; null value is indeterminate.',
  props: propsFrom(progressPropNames, {
    value: { kind: 'number', default: 0, description: 'Current value; omit or null while unknown' },
    max: { kind: 'number', default: 100 },
    min: { kind: 'number', default: 0 },
    label: { kind: 'string' },
    ariaLabel: { kind: 'string' },
    showValue: { kind: 'boolean', default: false },
    tone: { kind: 'enum', enumValues: feedbackTones, default: 'primary' },
    size: { kind: 'enum', enumValues: feedbackSizes, default: 'md' },
    shape: { kind: 'enum', enumValues: ['linear', 'circular'], default: 'linear' },
    loadingLabel: { kind: 'string' },
    class: { kind: 'string' },
  }),
  examples: [
    { id: 'upload', title: 'Upload', props: { value: 40, label: 'Upload', showValue: true } },
  ],
  related: ['spinner', 'skeleton'],
});

export const carouselManifest = /* @__PURE__ */ defineDisplayManifest({
  id: 'carousel',
  package: PKG,
  label: 'Carousel',
  summary: 'A labelled region of slides with previous, next and a picker.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['A few slides the person pages through, such as quotes or screenshots'],
  dontUseWhen: ['A gallery of images with a lightbox (use media-image)', 'Tabs (use tabs)'],
  a11y: 'APG carousel: a named region, arrow keys, and a tablist when dots are shown.',
  props: propsFrom(carouselPropNames, {
    items: {
      kind: 'array',
      required: true,
      description: '{ id, label }[] in display order',
    },
    index: { kind: 'number', default: 0 },
    label: { kind: 'string' },
    showControls: { kind: 'boolean', default: true },
    showDots: { kind: 'boolean', default: true },
    controls: { kind: 'enum', enumValues: ['below', 'overlay'], default: 'below' },
    loop: { kind: 'boolean', default: true },
    class: { kind: 'string' },
  }),
  examples: [
    {
      id: 'quotes',
      title: 'Quotes',
      props: {
        label: 'Customer quotes',
        items: [
          { id: 'a', label: 'Ada Example' },
          { id: 'b', label: 'Lin Example' },
        ],
      },
    },
  ],
  related: ['card'],
});

export const separatorManifest = /* @__PURE__ */ defineDisplayManifest({
  id: 'separator',
  package: PKG,
  label: 'Separator',
  summary: 'A horizontal or vertical divider on the token scale.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Split two blocks of content visually'],
  dontUseWhen: ['A menu divider (use the menu separator)', 'A list item (use list-item)'],
  a11y: 'Decorative by default (hidden from assistive technology); set decorative false for a semantic boundary.',
  props: propsFrom(separatorPropNames, {
    orientation: { kind: 'enum', enumValues: ['horizontal', 'vertical'], default: 'horizontal' },
    decorative: { kind: 'boolean', default: true },
    variant: { kind: 'enum', enumValues: ['default', 'subtle', 'strong'], default: 'default' },
    class: { kind: 'string' },
  }),
  examples: [{ id: 'rule', title: 'Horizontal rule', props: { variant: 'subtle' } }],
  related: ['box'],
});

export const listItemManifest = /* @__PURE__ */ defineDisplayManifest({
  id: 'list-item',
  package: PKG,
  label: 'ListItem',
  summary: 'A list row with a title, optional description, icon and trailing meta.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['A settings row, an inbox row, or a navigation list of links'],
  dontUseWhen: ['A data table (use table)', 'A kanban card (use data-board)'],
  a11y: 'A listitem; with href it is a link, with onSelect a button. Trailing controls sit outside the main control.',
  props: propsFrom(listItemPropNames, {
    title: { kind: 'string', trust: 'untrusted' },
    description: { kind: 'string', trust: 'untrusted' },
    meta: { kind: 'string', trust: 'untrusted' },
    icon: { kind: 'string', description: 'Built-in or registered icon name' },
    href: { kind: 'string', trust: 'untrusted' },
    hrefTrust: { kind: 'enum', enumValues: ['developer', 'untrusted'], default: 'developer' },
    current: { kind: 'boolean', default: false },
    disabled: { kind: 'boolean', default: false },
    divided: { kind: 'boolean', default: false, description: 'Hairline under this row' },
    class: { kind: 'string' },
  }),
  examples: [
    {
      id: 'inbox',
      title: 'Inbox row',
      props: { title: 'Quarterly notes', description: 'Ada Example', meta: '2h', icon: 'info' },
    },
  ],
  related: ['icon', 'avatar', 'list'],
});

export const listManifest = /* @__PURE__ */ defineDisplayManifest({
  id: 'list',
  package: PKG,
  label: 'List',
  summary: 'A list of ListItem rows; divided draws a token hairline between them.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['A stack of settings, inbox or navigation rows'],
  dontUseWhen: ['A data table (use table)', 'Prose lists (use prose)'],
  a11y: 'A ul of listitems. Dividers are decorative.',
  props: propsFrom(listPropNames, {
    divided: { kind: 'boolean', default: false },
    class: { kind: 'string' },
    children: { kind: 'slot', description: 'ListItem rows' },
  }),
  examples: [{ id: 'inbox', title: 'Divided inbox', props: { divided: true } }],
  related: ['list-item'],
});

export const markManifest = /* @__PURE__ */ defineDisplayManifest({
  id: 'mark',
  package: PKG,
  label: 'Mark',
  summary: 'An inline highlight for search results, from role soft tokens.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Highlight a search match inside a title or body'],
  dontUseWhen: ['A status badge (use badge)', 'Struck text (use text strikethrough)'],
  a11y: 'A real mark element; the words still say the match. Forced colors use Highlight.',
  props: propsFrom(markPropNames, {
    tone: {
      kind: 'enum',
      enumValues: ['warning', 'primary', 'success', 'info'],
      default: 'warning',
    },
    label: { kind: 'string', description: 'Plain text, escaped' },
    class: { kind: 'string' },
    children: { kind: 'slot' },
  }),
  examples: [{ id: 'search', title: 'Search hit', props: { tone: 'warning', label: 'quarter' } }],
  related: ['text', 'heading'],
});

export const kbdManifest = /* @__PURE__ */ defineDisplayManifest({
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
export const inlineTextManifest = /* @__PURE__ */ defineDisplayManifest({
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

export const codeManifest = /* @__PURE__ */ defineDisplayManifest({
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

/** Tabs (ADR-032): a tab list with panels. App chrome; agents never emit it. */
export const tabsManifest = /* @__PURE__ */ defineDisplayManifest({
  id: 'tabs',
  package: PKG,
  label: 'Tabs',
  summary: 'A tab list that shows one panel at a time.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Switch between peer views of the same page'],
  dontUseWhen: [
    'A sequence of steps (use stepper or wizard)',
    'Mobile app destinations (use bottom-nav)',
  ],
  a11y: [
    'Tab list is labelled; arrow keys move among tabs; the selected tab is aria-selected',
    'Each tab names its panel',
  ],
  props: propsFrom(tabsPropNames, {
    items: {
      kind: 'array',
      required: true,
      description: 'Tabs: value, label, optional badge and panel',
    },
    value: { kind: 'string', description: 'The selected tab value' },
    onValueChange: { kind: 'event', description: 'Selected tab changed' },
    label: { kind: 'string', description: 'Accessible name of the tab list' },
    variant: { kind: 'enum', enumValues: [...tabsVariants], default: 'line' },
    orientation: { kind: 'enum', enumValues: ['horizontal', 'vertical'], default: 'horizontal' },
    activationMode: { kind: 'enum', enumValues: ['automatic', 'manual'], default: 'automatic' },
    loop: { kind: 'boolean', default: false },
    disabled: { kind: 'boolean', default: false },
    class: { kind: 'string' },
    content: { kind: 'slot', description: 'Panel body for each item' },
  }),
  examples: [
    {
      id: 'line',
      title: 'Line tabs',
      props: {
        variant: 'line',
        items: [
          { value: 'overview', label: 'Overview' },
          { value: 'activity', label: 'Activity' },
        ],
        value: 'overview',
      },
    },
  ],
  related: ['accordion', 'stepper'],
  events: ['select'],
});

/** Accordion (ADR-032): stacked disclosure. App chrome; agents never emit it. */
export const accordionManifest = /* @__PURE__ */ defineDisplayManifest({
  id: 'accordion',
  package: PKG,
  label: 'Accordion',
  summary: 'Stacked sections that expand and collapse one or more panels.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['FAQs and grouped detail the reader opens on demand'],
  dontUseWhen: ['Peer views of one page (use tabs)', 'A multi-step flow (use wizard)'],
  a11y: [
    'Each header is a button that names its panel; expanded state is exposed',
    'Heading level is set so the outline stays valid',
  ],
  props: propsFrom(accordionPropNames, {
    items: {
      kind: 'array',
      required: true,
      description: 'Sections: value, title, optional content',
    },
    type: { kind: 'enum', enumValues: ['single', 'multiple'], default: 'single' },
    value: { kind: 'unknown', description: 'Open value or values' },
    onValueChange: { kind: 'event', description: 'Open value changed' },
    collapsible: { kind: 'boolean', default: true },
    headingLevel: { kind: 'number', default: 3 },
    variant: { kind: 'enum', enumValues: [...accordionVariants], default: 'default' },
    disabled: { kind: 'boolean', default: false },
    class: { kind: 'string' },
    content: { kind: 'slot', description: 'Panel body for each item' },
  }),
  examples: [
    {
      id: 'faq',
      title: 'FAQ',
      props: {
        headingLevel: 3,
        items: [
          { value: 'hours', title: 'Hours', content: 'Weekdays 9–17.' },
          { value: 'fees', title: 'Fees', content: 'No booking fee.' },
        ],
      },
    },
  ],
  related: ['tabs', 'stepper'],
  events: ['collapse'],
});

/** Every display/feedback manifest in stable id order. */
export const DISPLAY_MANIFESTS: readonly CatalogManifest[] = /* @__PURE__ */ Object.freeze([
  accordionManifest,
  alertManifest,
  avatarManifest,
  avatarGroupGridManifest,
  badgeManifest,
  bannerManifest,
  boxManifest,
  calloutManifest,
  cardManifest,
  carouselManifest,
  chipManifest,
  codeManifest,
  colorSwatchManifest,
  emptyStateManifest,
  errorStateManifest,
  headingManifest,
  iconManifest,
  inlineTextManifest,
  kbdManifest,
  kpiManifest,
  linkManifest,
  listManifest,
  listItemManifest,
  markManifest,
  progressManifest,
  proseManifest,
  separatorManifest,
  skeletonManifest,
  spinnerManifest,
  statManifest,
  stepperManifest,
  tableManifest,
  tabsManifest,
  tagManifest,
  textManifest,
  timelineManifest,
]);

/** Map of component id → expected prop names for type/schema parity tests. */
export const DISPLAY_PROP_NAMES = /* @__PURE__ */ Object.freeze({
  accordion: accordionPropNames,
  alert: alertPropNames,
  avatar: avatarPropNames,
  'avatar-group-grid': avatarGroupGridPropNames,
  badge: badgePropNames,
  banner: bannerPropNames,
  box: boxPropNames,
  callout: calloutPropNames,
  card: cardPropNames,
  carousel: carouselPropNames,
  chip: chipPropNames,
  code: codePropNames,
  'color-swatch': colorSwatchPropNames,
  'empty-state': emptyStatePropNames,
  'error-state': errorStatePropNames,
  heading: headingPropNames,
  icon: iconPropNames,
  'inline-text': inlineTextPropNames,
  kbd: kbdPropNames,
  kpi: kpiPropNames,
  link: linkPropNames,
  list: listPropNames,
  'list-item': listItemPropNames,
  mark: markPropNames,
  progress: progressPropNames,
  prose: prosePropNames,
  separator: separatorPropNames,
  skeleton: skeletonPropNames,
  spinner: spinnerPropNames,
  stat: statPropNames,
  stepper: stepperPropNames,
  table: tablePropNames,
  tabs: tabsPropNames,
  tag: tagPropNames,
  text: textPropNames,
  timeline: timelinePropNames,
} as const);
