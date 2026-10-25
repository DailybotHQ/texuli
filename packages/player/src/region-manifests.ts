import type { CatalogManifest } from '@texuli/catalog/manifest';
import type { GrammarComponentMeta } from '@texuli/catalog/render/grammar';

/**
 * Host-owned regions (player design R21; audit G18, dispatched as Task 62).
 * A `host-region` node reserves a named place in the blueprint. The host
 * mounts its own component there (payment, sign-in), the player passes it
 * no blueprint data, and the blueprint never sees what the host renders. A
 * name the host does not provide paints the label as an inert placeholder.
 * The manifest lives in the player until the catalog adopts it.
 */
export const HOST_REGION_ID = 'host-region';

/** A region name: lowercase, digits and hyphens, at most 32 characters. */
export const HOST_REGION_NAME = /^[a-z][a-z0-9-]{0,31}$/;

export function isHostRegionName(value: unknown): value is string {
  return typeof value === 'string' && HOST_REGION_NAME.test(value);
}

export const hostRegionManifest: CatalogManifest = Object.freeze({
  id: HOST_REGION_ID,
  package: '@texuli/player',
  label: 'Host region',
  summary: 'Reserves a named place where the host app mounts its own component.',
  tier: 'content' as const,
  agentEmittable: true,
  useWhen: Object.freeze([
    'A step that needs sensitive input the agent must never emit (payment, sign-in)',
    'A place for host chrome that lives inside the document flow',
  ]),
  dontUseWhen: Object.freeze([
    'Content the agent can describe itself: use a content block',
    'Card numbers, passwords or one-time codes as props: those never appear in a blueprint',
  ]),
  a11y: Object.freeze([
    'The host component sits in a labelled group named by the label',
    'A region the host does not provide shows the label as visible text, not an empty box',
  ]),
  props: Object.freeze([
    {
      name: 'name',
      kind: 'string' as const,
      required: true,
      description: 'The region the host provides, such as "payment" (lowercase, digits, hyphens).',
    },
    {
      name: 'label',
      kind: 'string' as const,
      required: true,
      trust: 'untrusted' as const,
      description: 'What the region is for; its accessible name and its placeholder text.',
    },
  ]),
  examples: Object.freeze([
    {
      id: 'payment',
      title: 'Payment step',
      props: { name: 'payment', label: 'Payment details' },
    },
  ]),
  related: Object.freeze(['layout-stack']),
}) as CatalogManifest;

export const REGION_MANIFESTS: readonly CatalogManifest[] = Object.freeze([hostRegionManifest]);

/** A host region is interactive in the grammar: it never nests inside another interactive node. */
export const REGION_GRAMMAR_ROLES: readonly GrammarComponentMeta[] = Object.freeze([
  { id: HOST_REGION_ID, role: 'interactive' },
]);
