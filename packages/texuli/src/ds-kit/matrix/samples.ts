/**
 * Built-in live samples for `texuli` catalog ids (kit API §5.2): catalog id → a lazy loader of
 * the real component, the props of a neutral sample (fictional text), and the props that set
 * each prop-backed state. Lazy, so the kit's own chunk stays small and only enabled
 * components load. Every component here paints its own root attributes (ADR-032 T3); the kit
 * adds none. Ids above `texuli`'s layer render through the host's `samples` snippets instead.
 */
import type { Component } from 'svelte';
import type { KitState } from '../shared/types.ts';

export interface KitBuiltinSample {
  /** The real component, loaded on demand. */
  readonly load: () => Promise<{ default: Component<Record<string, unknown>> }>;
  /** Props of the neutral sample. */
  readonly props: Readonly<Record<string, unknown>>;
  /** Text rendered as the component's children, when it takes children. */
  readonly text?: string;
  /** Props that put the sample in a prop-backed state. */
  readonly stateProps: Readonly<Partial<Record<KitState, Readonly<Record<string, unknown>>>>>;
}

type Loader = KitBuiltinSample['load'];
const lazy = (load: () => Promise<{ default: unknown }>): Loader => load as Loader;

const DISABLED = { disabled: { disabled: true } } as const;

/** The built-in samples, keyed by catalog id. */
export const KIT_BUILTIN_SAMPLES: Readonly<Record<string, KitBuiltinSample>> = Object.freeze({
  button: {
    load: lazy(() => import('../../components/button/Button.svelte')),
    props: {},
    text: 'Save changes',
    stateProps: { ...DISABLED, loading: { loading: true } },
  },
  badge: {
    load: lazy(() => import('../../components/badge/Badge.svelte')),
    props: { label: 'New' },
    stateProps: {},
  },
  chip: {
    load: lazy(() => import('../../components/badge/Chip.svelte')),
    props: { label: 'Filter' },
    stateProps: { selected: { selected: true } },
  },
  tag: {
    load: lazy(() => import('../../components/badge/Tag.svelte')),
    props: { label: 'Design' },
    stateProps: DISABLED,
  },
  card: {
    load: lazy(() => import('../../components/card/Card.svelte')),
    props: {},
    text: 'A card with a short line of text.',
    stateProps: {},
  },
  alert: {
    load: lazy(() => import('../../components/alert/Alert.svelte')),
    props: { title: 'Heads up', text: 'A short message for the reader.' },
    stateProps: {},
  },
  callout: {
    load: lazy(() => import('../../components/alert/Callout.svelte')),
    props: { title: 'Note', text: 'A short note beside the content.' },
    stateProps: {},
  },
  banner: {
    load: lazy(() => import('../../components/alert/Banner.svelte')),
    props: { title: 'Maintenance', text: 'A short page-wide notice.' },
    stateProps: {},
  },
  checkbox: {
    load: lazy(() => import('../../components/choice/Checkbox.svelte')),
    props: { label: 'Email me updates' },
    stateProps: {
      ...DISABLED,
      checked: { checked: true },
      invalid: { 'aria-invalid': 'true' },
    },
  },
  switch: {
    load: lazy(() => import('../../components/choice/Switch.svelte')),
    props: { label: 'Notifications' },
    stateProps: { ...DISABLED, checked: { checked: true } },
  },
  input: {
    load: lazy(() => import('../../components/input/Input.svelte')),
    props: { 'aria-label': 'Sample input', placeholder: 'name@example.com' },
    stateProps: {
      ...DISABLED,
      invalid: { 'aria-invalid': 'true' },
      readonly: { readonly: true, value: 'name@example.com' },
    },
  },
  textarea: {
    load: lazy(() => import('../../components/input/Textarea.svelte')),
    props: { 'aria-label': 'Sample text area', placeholder: 'A few words' },
    stateProps: { ...DISABLED, readonly: { readonly: true, value: 'A few words' } },
  },
  kbd: {
    load: lazy(() => import('../../components/kbd-code/Kbd.svelte')),
    props: {},
    text: 'Ctrl K',
    stateProps: {},
  },
  code: {
    load: lazy(() => import('../../components/kbd-code/Code.svelte')),
    props: {},
    text: 'npm run build',
    stateProps: {},
  },
  'empty-state': {
    load: lazy(() => import('../../components/empty/EmptyState.svelte')),
    props: { title: 'Nothing here yet', description: 'Items you add appear here.' },
    stateProps: {},
  },
});

/** The built-in sample of a catalog id, if the kit has one. */
export function builtinSample(id: string): KitBuiltinSample | undefined {
  return Object.hasOwn(KIT_BUILTIN_SAMPLES, id) ? KIT_BUILTIN_SAMPLES[id] : undefined;
}
