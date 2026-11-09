/**
 * `ds.allow` (ADR-032): the `allow` section of a locked design system, from
 * the catalog. An agent picks a preset (`minimal`, a documented core, or
 * `all`, every catalog component) or names the components it needs, and
 * gets each one with the full variants, sizes, tones, densities, colors and states
 * the catalog declares, ready to narrow and paste into the document. Read
 * only; the catalog is the one `catalog.*` reads.
 */
import {
  allowPreset,
  fullAllowEntry,
  MINIMAL_PRESET_IDS,
  PRESET_NAMES,
  presetComponentsFromBuild,
} from '../ds-create/presets.ts';
import { loadOpsCatalog } from './catalog.ts';
import { defineOperation } from './registry.ts';
import { type Operation, OperationError } from './types.ts';

/** The most components one call may name (the allow section's own cap). */
export const DS_ALLOW_MAX_COMPONENTS = 256;

export const dsAllow: Operation = defineOperation({
  name: 'ds.allow',
  title: 'List allowed components for a locked design system',
  summary:
    'Build the allow section of a locked design system from the catalog: a preset (minimal, a documented core; all, every component) or the ids you name, each with every variant, size, tone, density, color and state the catalog declares. Narrow it, put it under "allow" and run ds.validate. Returns allow, count, unknown ids and the minimal preset ids.',
  input: {
    type: 'object',
    properties: {
      preset: {
        type: 'string',
        enum: [...PRESET_NAMES],
        default: 'minimal',
        description:
          'minimal (a documented core: actions, form controls, text and status, containers, overlays and page layouts) or all (every catalog component). Ignored when components is set.',
      },
      components: {
        type: 'array',
        items: { type: 'string', minLength: 1, maxLength: 48 },
        maxItems: DS_ALLOW_MAX_COMPONENTS,
        description:
          'Catalog component ids to allow, e.g. ["button", "card", "data-grid"] (find ids with catalog.search).',
      },
    },
    additionalProperties: false,
  },
  output: {
    type: 'object',
    properties: {
      allow: {
        type: 'object',
        description: 'Catalog id → { variants?, sizes?, tones?, densities?, colors?, states? }.',
      },
      count: { type: 'integer', minimum: 0 },
      unknown: { type: 'array', items: { type: 'string' } },
      minimal: { type: 'array', items: { type: 'string' } },
    },
    required: ['allow', 'count', 'unknown', 'minimal'],
  },
  annotations: { readOnly: true, destructive: false, idempotent: true, openWorld: false },
  runtime: 'edge',
  limits: { inputBytes: 32_768, timeMs: 10_000, items: DS_ALLOW_MAX_COMPONENTS },
  examples: [
    { title: 'The minimal preset', input: { preset: 'minimal' } },
    { title: 'Three named components', input: { components: ['button', 'card', 'data-grid'] } },
  ],
  async handler(input) {
    const { preset = 'minimal', components } = input as {
      preset?: 'all' | 'minimal';
      components?: string[];
    };
    if (preset !== 'all' && preset !== 'minimal')
      throw new OperationError('invalid-input', 'preset is minimal or all.');
    const build = await loadOpsCatalog();
    const catalog = presetComponentsFromBuild(build.catalog.entries);
    let allow: Record<string, unknown>;
    const unknown: string[] = [];
    if (components) {
      const byId = new Map(catalog.map((component) => [component.id, component]));
      allow = {};
      for (const id of [...new Set(components)].sort()) {
        const component = byId.get(id);
        if (component) allow[id] = fullAllowEntry(component);
        else unknown.push(id);
      }
    } else allow = allowPreset(catalog, preset);
    return { allow, count: Object.keys(allow).length, unknown, minimal: [...MINIMAL_PRESET_IDS] };
  },
});
