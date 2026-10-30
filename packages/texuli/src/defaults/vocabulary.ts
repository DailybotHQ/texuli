/**
 * The closed vocabulary of component defaults (ADR-020, token contract v2):
 * for every styled component with a `variant` or `size` prop, the values a
 * design system or agent may set as its default. CSS cannot express a default
 * variant or size, so `setDesignDefaults` carries them in a Svelte context.
 *
 * The lists are literal here, not imported from each family's variants
 * module, so this module pulls no component CSS; `tests/design-defaults.test.ts`
 * checks every list equals the family's exported constant.
 */

export const DESIGN_DEFAULTS_VOCABULARY = {
  accordion: { variant: ['default', 'bordered'] },
  avatar: { size: ['xs', 'sm', 'md', 'lg'] },
  badge: {
    variant: [
      'default',
      'secondary',
      'outline',
      'success',
      'warning',
      'destructive',
      'info',
      'neutral',
    ],
  },
  breadcrumb: { size: ['sm', 'md', 'lg'] },
  button: {
    variant: ['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'],
    size: ['sm', 'md', 'lg', 'icon'],
  },
  card: { variant: ['elevated', 'flat'] },
  chip: {
    variant: [
      'default',
      'secondary',
      'outline',
      'success',
      'warning',
      'destructive',
      'info',
      'neutral',
    ],
  },
  choice: { size: ['sm', 'md'] },
  code: { variant: ['inline', 'block'] },
  combobox: { variant: ['outline', 'soft'], size: ['sm', 'md', 'lg'] },
  command: { variant: ['outline', 'soft'], size: ['sm', 'md', 'lg'] },
  'copy-button': { size: ['sm', 'md'] },
  date: { size: ['sm', 'md'] },
  dialog: { size: ['sm', 'md', 'lg', 'xl'] },
  empty: { size: ['sm', 'md'] },
  'file-upload': { variant: ['default', 'compact'] },
  icon: { size: ['xs', 'sm', 'md', 'lg'] },
  'icon-button': {
    variant: ['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'],
    size: ['sm', 'md', 'lg', 'icon'],
  },
  label: { size: ['sm', 'md'] },
  menu: { variant: ['default', 'soft'], size: ['sm', 'md', 'lg'] },
  navigation: { size: ['sm', 'md', 'lg'] },
  'number-field': { size: ['sm', 'md', 'lg'] },
  pagination: { variant: ['outline', 'soft'], size: ['sm', 'md', 'lg'] },
  'pin-input': { size: ['sm', 'md', 'lg'] },
  popover: { variant: ['elevated', 'flat'], size: ['sm', 'md', 'lg'] },
  progress: { size: ['sm', 'md', 'lg'] },
  'radio-group': { variant: ['default', 'card'], size: ['sm', 'md'] },
  rating: { size: ['sm', 'md', 'lg'] },
  resizable: { variant: ['plain', 'bordered'] },
  'resizable-handle': { size: ['sm', 'md'] },
  'scroll-area': { size: ['sm', 'md', 'lg'] },
  select: { variant: ['outline', 'soft'], size: ['sm', 'md', 'lg'] },
  separator: { variant: ['default', 'subtle', 'strong'] },
  sheet: { size: ['sm', 'md', 'lg', 'xl'] },
  sidebar: { variant: ['default', 'inset'] },
  skeleton: { size: ['sm', 'md', 'lg'] },
  slider: { size: ['sm', 'md', 'lg'] },
  spinner: { size: ['sm', 'md', 'lg'] },
  stat: { variant: ['elevated', 'flat'] },
  table: { variant: ['plain', 'striped', 'grid'] },
  tabs: { variant: ['line', 'pills', 'enclosed'] },
  tag: {
    variant: [
      'default',
      'secondary',
      'outline',
      'success',
      'warning',
      'destructive',
      'info',
      'neutral',
    ],
  },
  toggle: { variant: ['default', 'outline'], size: ['sm', 'md', 'lg'] },
  'toggle-group': { variant: ['default', 'outline'], size: ['sm', 'md', 'lg'] },
  toolbar: { variant: ['default', 'outline', 'ghost'], size: ['sm', 'md'] },
  tree: { variant: ['default', 'bordered'] },
} as const satisfies Record<
  string,
  { readonly variant?: readonly string[]; readonly size?: readonly string[] }
>;

type Vocabulary = typeof DESIGN_DEFAULTS_VOCABULARY;

/** A component id with a default `variant` or `size` (`button`, `icon-button`, `select`). */
export type DesignDefaultsComponent = keyof Vocabulary;

/** The default props one component accepts: each a value from its closed list. */
export type ComponentDefaults<C extends DesignDefaultsComponent> = {
  -readonly [P in keyof Vocabulary[C]]?: Vocabulary[C][P] extends readonly (infer V)[] ? V : never;
};

/** Default `variant` and `size` per component, every field optional. */
export type DesignDefaults = { [C in DesignDefaultsComponent]?: ComponentDefaults<C> };

/** Every component id in the vocabulary, in alphabetical order. */
export const DESIGN_DEFAULTS_COMPONENTS = Object.keys(
  DESIGN_DEFAULTS_VOCABULARY
) as readonly DesignDefaultsComponent[];
