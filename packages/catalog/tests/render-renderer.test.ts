// @vitest-environment node

import { CODE_BLOCK_TYPES, checkCodeBlock } from '@texuli/blocks/code/engine';
import { BLOCK_TYPES } from '@texuli/blocks/core';
import { DATA_BLOCK_TYPES } from '@texuli/blocks/data/engine';
import { DIAGRAM_BLOCK_TYPES } from '@texuli/blocks/diagram/engine';
import { EMBED_BLOCK_TYPES } from '@texuli/blocks/embed/engine';
import { checkInteractiveBlock, INTERACTIVE_BLOCK_TYPES } from '@texuli/blocks/interactive/engine';
import { checkMapBlock, MAP_BLOCK_TYPES } from '@texuli/blocks/map/engine';
import { MEDIA_BLOCK_TYPES } from '@texuli/blocks/media/engine';
import { checkStructureBlock, STRUCTURE_BLOCK_TYPES } from '@texuli/blocks/structure/engine';
import { TEXT_BLOCK_TYPES } from '@texuli/blocks/text/engine';
import { describe, expect, it } from 'vitest';
import { buildCatalog, isTierU } from '../src/build/build.ts';
import { discoverManifestGroups } from '../src/build/node.ts';
import { CHROME_GROUPS, isOverlayId, isShellId } from '../src/build/tiers.ts';
import { CONTENT_MANIFESTS, contentManifestsById } from '../src/manifests/content/index.ts';
import { createPlayer } from '../src/player/index.ts';
import { createArtifactFrame } from '../src/render/frame/index.ts';
import {
  BLOCK_FAMILY_TYPES,
  blockFamilyIdFor,
  FORBIDDEN_PROP_NAMES,
  looksLikeHtmlString,
  type RenderComponentSpec,
  type RenderNode,
  renderCatalogFromBuild,
  renderCatalogFromSpecs,
  renderCatalogTree,
  resolveTier,
  sanitizeProps,
} from '../src/render/renderer/index.ts';
import { validateDraft } from '../src/validate/index.ts';

const build = await buildCatalog(await discoverManifestGroups());

describe('renderer', () => {
  const card: RenderComponentSpec = {
    id: 'card',
    label: 'Card',
    agentEmittable: true,
    emit: ['developer', 'untrusted'],
    props: [
      {
        name: 'variant',
        kind: 'enum',
        enumValues: ['elevated', 'flat'],
        default: 'elevated',
      },
      { name: 'title', kind: 'string' },
      { name: 'count', kind: 'number' },
      { name: 'open', kind: 'boolean' },
      { name: 'meta', kind: 'object' },
      { name: 'tags', kind: 'array' },
      { name: 'onSelect', kind: 'event' },
      { name: 'header', kind: 'slot' },
    ],
  };

  const dialog: RenderComponentSpec = {
    id: 'dialog',
    label: 'Dialog',
    agentEmittable: false,
    emit: ['developer'],
    props: [{ name: 'title', kind: 'string', required: true }],
  };

  const catalog = renderCatalogFromSpecs([card, dialog]);

  describe('looksLikeHtmlString / forbidden props', () => {
    it('detects HTML-like strings and lists forbidden names', () => {
      expect(looksLikeHtmlString('<script>x</script>')).toBe(true);
      expect(looksLikeHtmlString('</div>')).toBe(true);
      expect(looksLikeHtmlString('a < b and c > d')).toBe(false);
      expect(looksLikeHtmlString('Score: 12')).toBe(false);
      expect(FORBIDDEN_PROP_NAMES.has('class')).toBe(true);
      expect(FORBIDDEN_PROP_NAMES.has('style')).toBe(true);
      expect(FORBIDDEN_PROP_NAMES.has('dangerouslySetInnerHTML')).toBe(true);
    });
  });

  describe('sanitizeProps', () => {
    it('HTML detection, forbidden names and sanitizeProps', () => {
      // strips class/style and unknown keys without dropping the node
      {
        const result = sanitizeProps(
          {
            variant: 'flat',
            class: 'evil',
            style: 'position:fixed',
            className: 'x',
            unknown: 1,
          },
          card.props,
          '0',
          'card'
        );
        expect(result.props).toEqual({ variant: 'flat' });
        expect(result.diagnostics.some((d) => d.code === 'forbidden-prop')).toBe(true);
        expect(result.diagnostics.some((d) => d.code === 'invalid-prop')).toBe(true);
      }
      expect(sanitizeProps({ variant: 1 }, card.props, '0', 'card').props).toBeNull();
      expect(sanitizeProps({}, dialog.props, '0', 'dialog').props).toBeNull();
      expect(sanitizeProps({ title: '<b>hi</b>' }, dialog.props, '0', 'dialog').props).toBeNull();
      // refuses event and slot values from the tree
      {
        const result = sanitizeProps(
          { variant: 'elevated', onSelect: () => undefined, header: 'x' },
          card.props,
          '0',
          'card'
        );
        expect(result.props).toEqual({ variant: 'elevated' });
        expect(result.diagnostics.filter((d) => d.code === 'invalid-prop').length).toBeGreaterThan(
          0
        );
      }
    });
  });

  describe('renderCatalogTree', () => {
    it('renderCatalogTree renders, placeholders, drops and freezes per the schema and the tier', () => {
      // renders a valid component and replaces unknown ids with placeholders
      {
        const { roots, diagnostics } = renderCatalogTree(
          {
            id: 'card',
            props: { variant: 'elevated', title: 'Hello' },
            children: [{ id: 'nope-component', props: { title: 'x' } }],
          },
          { catalog, tier: 'untrusted' }
        );

        expect(roots).toHaveLength(1);
        const root = roots[0]!;
        expect(root.kind).toBe('component');
        if (root.kind !== 'component') return;
        expect(root.id).toBe('card');
        expect(root.props).toEqual({ variant: 'elevated', title: 'Hello' });
        expect(root.children).toHaveLength(1);
        expect(root.children[0]).toEqual({
          kind: 'placeholder',
          id: 'nope-component',
          label: 'Unknown component “nope-component”',
          reason: 'unknown-id',
        });
        expect(diagnostics.some((d) => d.code === 'unknown-id')).toBe(true);
      }
      // drops schema-failed nodes and keeps siblings
      {
        const { roots, diagnostics } = renderCatalogTree(
          [
            { id: 'card', props: { variant: 'nope' } },
            { id: 'card', props: { variant: 'flat', count: 3 } },
          ],
          { catalog, tier: 'untrusted' }
        );

        expect(roots).toHaveLength(1);
        expect(roots[0]).toMatchObject({
          kind: 'component',
          id: 'card',
          props: { variant: 'flat', count: 3 },
        });
        expect(diagnostics.some((d) => d.code === 'schema-failure')).toBe(true);
      }
      // never forwards class or style even when declared-looking
      {
        const { roots } = renderCatalogTree(
          {
            id: 'card',
            props: {
              variant: 'flat',
              class: 'attack',
              style: 'display:none',
              title: 'Safe',
            },
          },
          { catalog, tier: 'untrusted' }
        );
        expect(roots[0]).toMatchObject({
          kind: 'component',
          props: { variant: 'flat', title: 'Safe' },
        });
        const props = roots[0] && roots[0].kind === 'component' ? roots[0].props : {};
        expect(props).not.toHaveProperty('class');
        expect(props).not.toHaveProperty('style');
      }
      // placeholders tier-denied components under untrusted
      {
        const { roots, diagnostics } = renderCatalogTree(
          { id: 'dialog', props: { title: 'Settings' } },
          { catalog, tier: 'untrusted' }
        );
        expect(roots[0]).toEqual({
          kind: 'placeholder',
          id: 'dialog',
          label: 'Dialog (not allowed)',
          reason: 'tier-denied',
        });
        expect(diagnostics.some((d) => d.code === 'tier-denied')).toBe(true);
      }
      // allows developer-tier catalog ids that untrusted cannot emit
      {
        const { roots } = renderCatalogTree(
          { id: 'dialog', props: { title: 'Settings' } },
          { catalog, tier: 'developer' }
        );
        expect(roots[0]).toMatchObject({
          kind: 'component',
          id: 'dialog',
          props: { title: 'Settings' },
        });
      }
      // drops nodes whose string props look like HTML
      {
        const { roots, diagnostics } = renderCatalogTree(
          { id: 'card', props: { title: '<img src=x onerror=alert(1)>' } },
          { catalog, tier: 'untrusted' }
        );
        expect(roots).toHaveLength(0);
        expect(diagnostics.some((d) => d.code === 'html-string')).toBe(true);
      }
      // accepts a list of roots and ignores invalid top-level entries
      {
        const { roots, diagnostics } = renderCatalogTree(
          [null, 'x', { id: 'card', props: { variant: 'flat' } }],
          { catalog, tier: 'untrusted' }
        );
        expect(roots).toHaveLength(1);
        expect(diagnostics.some((d) => d.code === 'invalid-node')).toBe(true);
      }
      // recurses children and freezes the result
      {
        const { roots } = renderCatalogTree(
          {
            id: 'card',
            props: { variant: 'elevated' },
            children: [
              {
                id: 'card',
                props: { title: 'Child', open: true, tags: ['a'], meta: { k: 1 } },
              },
            ],
          },
          { catalog, tier: 'untrusted' }
        );
        const root = roots[0];
        expect(root?.kind).toBe('component');
        if (root?.kind !== 'component') return;
        expect(root.children).toHaveLength(1);
        expect(Object.isFrozen(root)).toBe(true);
        expect(Object.isFrozen(root.props)).toBe(true);
        expect(Object.isFrozen(root.children)).toBe(true);
      }
    });
  });
});

describe('block family ids (G05)', () => {
  const catalog = renderCatalogFromBuild(build.catalog);

  /** One schema-valid block per type the audit found without a rendering id. */
  const AUDIT_G05_BLOCKS: Readonly<Record<string, Record<string, unknown>>> = {
    cta: { type: 'cta', actions: [{ label: 'Start a trial', href: 'https://example.com/signup' }] },
    cards: {
      type: 'cards',
      items: [{ title: 'Boards', body: 'See the week.', href: 'https://example.com/boards' }],
    },
    columns: {
      type: 'columns',
      columns: [[{ type: 'text', markdown: 'Left' }], [{ type: 'text', markdown: 'Right' }]],
    },
    tabs: {
      type: 'tabs',
      id: 'plans',
      label: 'Plans',
      panels: [
        { id: 'free', label: 'Free', blocks: [{ type: 'text', markdown: 'Up to five seats.' }] },
        { id: 'team', label: 'Team', blocks: [{ type: 'text', markdown: 'Up to fifty seats.' }] },
      ],
    },
    accordion: {
      type: 'accordion',
      items: [{ id: 'trial', title: 'Is there a free trial?', body: 'Yes, for 14 days.' }],
    },
    grid: { type: 'grid', cells: [{ title: 'Design', body: 'Tokens and themes.' }] },
    code: { type: 'code', lang: 'ts', code: 'const seats = 5;' },
    poll: {
      type: 'poll',
      id: 'q1',
      question: 'Which fictional harbor is busiest?',
      options: [
        { id: 'north', label: 'North Pier' },
        { id: 'south', label: 'South Basin' },
      ],
    },
    quiz: {
      type: 'quiz',
      title: 'Harbor basics',
      questions: [
        {
          id: 'q1',
          prompt: 'Which pier opens first?',
          options: [
            { id: 'north', label: 'North Pier' },
            { id: 'south', label: 'South Basin' },
          ],
          correctId: 'north',
        },
      ],
    },
    calculator: {
      type: 'calculator',
      title: 'Seat cost',
      inputs: [{ name: 'seats', label: 'Seats', default: 5, min: 1 }],
      formula: { op: 'mul', left: { op: 'var', name: 'seats' }, right: { op: 'num', value: 800 } },
      unit: 'cents',
      outputLabel: 'Monthly total',
    },
    checklist: {
      type: 'checklist',
      title: 'Launch checklist',
      items: [{ id: 'brief', label: 'Write the brief' }],
    },
    map: {
      type: 'map',
      label: 'North Pier depot',
      basemap: 'port-meridian',
      points: [{ id: 'depot', label: 'North Pier depot', lng: -18.6, lat: -30.4 }],
    },
  };

  const FAMILY_CHECKS: Readonly<Record<string, (block: unknown) => { ok: boolean }>> = {
    'blocks-structure': checkStructureBlock,
    'blocks-code': checkCodeBlock,
    'blocks-interactive': checkInteractiveBlock,
    'blocks-map': checkMapBlock,
  };

  describe('block family ids (G05)', () => {
    it('block family ids map every block type, ship self-valid examples, render through their own id and refuse mismatches', () => {
      expect(BLOCK_FAMILY_TYPES).toEqual({
        'blocks-text': [...TEXT_BLOCK_TYPES],
        'blocks-data': [...DATA_BLOCK_TYPES],
        'blocks-media': [...MEDIA_BLOCK_TYPES],
        'blocks-diagram': [...DIAGRAM_BLOCK_TYPES],
        'blocks-embed': [...EMBED_BLOCK_TYPES],
        'blocks-structure': [...STRUCTURE_BLOCK_TYPES],
        'blocks-code': [...CODE_BLOCK_TYPES],
        'blocks-interactive': [...INTERACTIVE_BLOCK_TYPES],
        'blocks-map': [...MAP_BLOCK_TYPES],
      });
      // gives every blocks-* family a content manifest, and every core block type an id
      {
        const manifestIds = CONTENT_MANIFESTS.map((m) => m.id).filter((id) =>
          id.startsWith('blocks-')
        );
        expect(manifestIds.sort()).toEqual(Object.keys(BLOCK_FAMILY_TYPES).sort());
        for (const type of BLOCK_TYPES) {
          expect(blockFamilyIdFor(type), type).toBeDefined();
        }
      }
      for (const id of ['blocks-structure', 'blocks-code', 'blocks-interactive', 'blocks-map']) {
        expect(catalog.get(id), id).toBeDefined();
        expect(isTierU(build.catalog, id), id).toBe(true);
      }
      for (const [id, check] of Object.entries(FAMILY_CHECKS)) {
        const manifest = contentManifestsById[id as keyof typeof contentManifestsById];
        for (const example of manifest.examples) {
          expect(check(example.props.block).ok, `${id} ${example.id}`).toBe(true);
        }
      }
      for (const [type, block] of Object.entries(AUDIT_G05_BLOCKS)) {
        const id = blockFamilyIdFor(type) as string;
        expect(FAMILY_CHECKS[id]?.(block).ok, `${type} is schema-valid`).toBe(true);
        const result = renderCatalogTree({ id, props: { block } }, { catalog, tier: 'untrusted' });
        expect(result.diagnostics).toEqual([]);
        expect(result.roots).toHaveLength(1);
        expect(result.roots[0]).toMatchObject({ kind: 'component', id });

        // Under blocks-text it is refused instead of painting the invalid notice.
        const refused = renderCatalogTree(
          {
            id: 'layout-doc',
            props: { title: 'Plans' },
            children: [{ id: 'blocks-text', props: { block } }],
          },
          { catalog, tier: 'untrusted' }
        );
        const doc = refused.roots[0];
        expect(doc?.kind === 'component' && doc.children, type).toEqual([]);
        const mismatch = refused.diagnostics.find((d) => d.code === 'block-family-mismatch');
        expect(mismatch, type).toMatchObject({ path: '0.children.0', id: 'blocks-text' });
        expect(mismatch?.message, type).toContain(`"${blockFamilyIdFor(type)}"`);
        expect(
          refused.diagnostics.map((d) => d.code),
          type
        ).toContain('schema-failure');
      }
      for (const block of [{ text: 'No type' }, { type: 'carousel', items: [] }]) {
        const result = renderCatalogTree(
          { id: 'blocks-structure', props: { block } },
          { catalog, tier: 'untrusted' }
        );
        expect(result.roots).toEqual([]);
        expect(result.diagnostics.map((d) => d.code)).toContain('block-family-mismatch');
      }
      // leaves non-block ids alone
      {
        const result = renderCatalogTree(
          { id: 'layout-card', props: { title: 'Summary' } },
          { catalog, tier: 'untrusted' }
        );
        expect(result.diagnostics).toEqual([]);
        expect(result.roots).toHaveLength(1);
      }
    });
  });
});

describe('tier semantics (D5)', () => {
  const entries = build.catalog.entries;
  const normative = renderCatalogFromBuild(build.catalog);
  const chrome = renderCatalogFromBuild(build.catalog, { developer: 'all' });

  /**
   * The agent-emittable ids, pinned. Changing this list is a deliberate
   * contract change (it was 36 when D5 was written; G05 added four block
   * families; G11 added deck-slide): update the docs with it.
   */
  const EMITTABLE_IDS = [
    'action-form',
    'blocks-code',
    'blocks-data',
    'blocks-diagram',
    'blocks-embed',
    'blocks-interactive',
    'blocks-map',
    'blocks-media',
    'blocks-structure',
    'blocks-text',
    'charts-area',
    'charts-bar',
    'charts-bubble',
    'charts-bullet',
    'charts-canvas-renderer',
    'charts-cartesian',
    'charts-combo',
    'charts-donut',
    'charts-funnel',
    'charts-gauge',
    'charts-geo-map',
    'charts-geo-point-map',
    'charts-heatmap',
    'charts-line',
    'charts-network',
    'charts-pie',
    'charts-progress-ring',
    'charts-sankey',
    'charts-scatter',
    'charts-sparkline',
    'charts-stacked-bar',
    'charts-sunburst',
    'charts-treemap',
    'chat-message',
    'chat-thread',
    'control-choice',
    'control-filter',
    'control-slider',
    'control-toggle',
    'data-board',
    'data-calendar',
    'data-cohort-table',
    'data-files',
    'data-filter-builder',
    'data-grid',
    'data-map',
    'data-notification-inbox',
    'data-timeline',
    'data-tree-view',
    'deck-slide',
    'flow-action',
    'flow-view',
    'form-field',
    'form-submit',
    'host-region',
    'layout-card',
    'layout-deck',
    'layout-doc',
    'layout-grid',
    'layout-page',
    'layout-row',
    'layout-split',
    'layout-stack',
    'layout-tile',
    'media-composition-canvas',
    'media-composition-svg',
    'media-image',
    'sortable-list',
    'workflow-graph',
  ];

  const emittable = new Set(EMITTABLE_IDS);
  const tierU = new Set(build.catalog.tiers.untrusted);

  /** Whether rendering `id` alone at `tier` is refused for its tier. */
  function tierDenied(catalog: typeof normative, id: string, tier: unknown): boolean {
    const result = renderCatalogTree({ id, props: {} }, { catalog, tier: tier as never });
    const root = result.roots[0] as RenderNode | undefined;
    return root?.kind === 'placeholder' && root.reason === 'tier-denied';
  }

  describe('the developer tier is the agent-emittable ids (D5)', () => {
    it('the developer tier is the pinned agent-emittable ids and holds Tier U, never app chrome', () => {
      // pins the agent-emittable ids, and the build tiers follow them
      {
        const fromManifests = entries.filter((e) => e.agentEmittable === true).map((e) => e.id);
        expect([...fromManifests].sort()).toEqual(EMITTABLE_IDS);
        expect([...build.catalog.tiers.developer].sort()).toEqual(EMITTABLE_IDS);
        expect(entries.length).toBeGreaterThan(EMITTABLE_IDS.length);
      }
      for (const id of tierU) expect(emittable.has(id), id).toBe(true);
      for (const entry of entries.filter((e) => emittable.has(e.id))) {
        expect(CHROME_GROUPS.includes(entry.group), entry.id).toBe(false);
        expect(isOverlayId(entry.id) || isShellId(entry.id), entry.id).toBe(false);
      }
      for (const { id } of entries) {
        expect(normative.allows?.(id, 'developer'), `${id} developer`).toBe(emittable.has(id));
        expect(normative.allows?.(id, 'untrusted'), `${id} untrusted`).toBe(tierU.has(id));
        expect(chrome.allows?.(id, 'developer'), `${id} developer: 'all'`).toBe(true);
        expect(chrome.allows?.(id, 'untrusted'), `${id} untrusted, developer: 'all'`).toBe(
          tierU.has(id)
        );
        expect(tierDenied(normative, id, 'developer'), `${id} renders at developer`).toBe(
          !emittable.has(id)
        );
        expect(tierDenied(normative, id, 'untrusted'), `${id} renders at untrusted`).toBe(
          !tierU.has(id)
        );
        expect(tierDenied(chrome, id, 'developer'), `${id} renders with developer: 'all'`).toBe(
          false
        );
      }
      for (const catalog of [normative, chrome]) {
        for (const tier of ['developer', 'untrusted'] as const) {
          expect(catalog.allows?.('not-a-component', tier)).toBe(false);
        }
      }
    });
  });

  describe('the tier is the host choice and fails closed', () => {
    const dialog = { id: 'dialog', props: { title: 'Delete every record?' } };
    const odd = [
      'Untrusted',
      'UNTRUSTED',
      'Developer',
      'DEVELOPER',
      'admin',
      '',
      ' developer',
      null,
      1,
    ];

    it('the tier is the host choice, exact, and fails closed everywhere', () => {
      expect(resolveTier('developer')).toBe('developer');
      expect(resolveTier('untrusted')).toBe('untrusted');
      expect(resolveTier(undefined)).toBe('untrusted');
      for (const value of odd) expect(resolveTier(value), String(value)).toBe('untrusted');
      for (const value of odd) {
        const tier = value as never;
        const at = JSON.stringify(value);
        // Even a host catalog that lets developers place chrome.
        expect(tierDenied(chrome, 'dialog', tier), at).toBe(true);
        const validation = validateDraft(dialog, { catalog: chrome, tier, frameRoots: false });
        expect(validation.tier, at).toBe('untrusted');
        expect(validation.ok, at).toBe(false);
        const player = createPlayer({
          blueprint: dialog,
          catalog: chrome,
          tier,
          frameRoots: false,
        });
        expect(player.receipt().tier, at).toBe('untrusted');
        expect(player.state.validation.ok, at).toBe(false);
        const frame = createArtifactFrame({
          label: 'Report',
          catalog: chrome,
          tree: dialog,
          tier,
          allowDeveloperTier: true,
        });
        expect(frame.roots[0], at).toMatchObject({ kind: 'placeholder', reason: 'tier-denied' });
      }
      // ignores a tier the envelope declares
      {
        const envelope = {
          kind: 'texuli.blueprint',
          version: 1,
          id: 'env-tier-001',
          tier: 'developer',
          tree: { id: 'layout-card', props: { title: 'Summary' } },
        };
        const result = validateDraft(envelope, { catalog: chrome, frameRoots: false });
        expect(result.tier).toBe('untrusted');
      }
      // keeps the developer tier for a host that asks for it exactly
      {
        const tree = { id: 'layout-card', props: { title: 'Summary' } };
        expect(validateDraft(tree, { catalog: normative, tier: 'developer' }).tier).toBe(
          'developer'
        );
        expect(tierDenied(chrome, 'dialog', 'developer')).toBe(false);
        expect(tierDenied(normative, 'dialog', 'developer')).toBe(true);
      }
    });
  });
});
