/**
 * Playground render catalog: a closed set of specs that matches the hostile
 * corpus ids plus a few safe demo components. No Svelte mounts here — the
 * sink-free renderer only.
 */
import {
  type RenderCatalog,
  type RenderComponentSpec,
  renderCatalogFromSpecs,
} from '@texuli/catalog/render/renderer';

const stringProp = (name: string, extras: Partial<RenderComponentSpec['props'][number]> = {}) => ({
  name,
  kind: 'string' as const,
  ...extras,
});

const enumProp = (
  name: string,
  enumValues: readonly string[],
  extras: Partial<RenderComponentSpec['props'][number]> = {}
) => ({
  name,
  kind: 'enum' as const,
  enumValues,
  ...extras,
});

/** Specs used by the agent playground (untrusted tier by default). */
export const PLAYGROUND_SPECS: readonly RenderComponentSpec[] = Object.freeze([
  {
    id: 'card',
    label: 'Card',
    agentEmittable: true,
    emit: ['developer', 'untrusted'],
    props: [
      enumProp('variant', ['elevated', 'flat'], { default: 'elevated' }),
      stringProp('title'),
      stringProp('description'),
      stringProp('href', { trust: 'untrusted' }),
      stringProp('src', { trust: 'untrusted' }),
    ],
  },
  {
    id: 'badge',
    label: 'Badge',
    agentEmittable: true,
    emit: ['developer', 'untrusted'],
    props: [
      enumProp('variant', ['default', 'secondary', 'outline', 'neutral'], { default: 'secondary' }),
      stringProp('label', { required: true }),
    ],
  },
  {
    id: 'stat',
    label: 'Stat',
    agentEmittable: true,
    emit: ['developer', 'untrusted'],
    props: [stringProp('label', { required: true }), stringProp('value', { required: true })],
  },
  {
    id: 'dialog',
    label: 'Dialog',
    agentEmittable: false,
    emit: ['developer'],
    props: [stringProp('title', { required: true }), stringProp('description')],
  },
  {
    id: 'alert-dialog',
    label: 'Alert dialog',
    agentEmittable: false,
    emit: ['developer'],
    props: [stringProp('title', { required: true }), stringProp('confirmLabel')],
  },
]);

export function playgroundCatalog(): RenderCatalog {
  return renderCatalogFromSpecs([...PLAYGROUND_SPECS]);
}
