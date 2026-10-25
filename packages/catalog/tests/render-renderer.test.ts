// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  FORBIDDEN_PROP_NAMES,
  looksLikeHtmlString,
  type RenderComponentSpec,
  renderCatalogFromSpecs,
  renderCatalogTree,
  sanitizeProps,
} from '../src/render/renderer/index.ts';

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
  it('strips class/style and unknown keys without dropping the node', () => {
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
  });

  it('drops the node on type failure, missing required, or HTML string', () => {
    expect(sanitizeProps({ variant: 1 }, card.props, '0', 'card').props).toBeNull();
    expect(sanitizeProps({}, dialog.props, '0', 'dialog').props).toBeNull();
    expect(sanitizeProps({ title: '<b>hi</b>' }, dialog.props, '0', 'dialog').props).toBeNull();
  });

  it('refuses event and slot values from the tree', () => {
    const result = sanitizeProps(
      { variant: 'elevated', onSelect: () => undefined, header: 'x' },
      card.props,
      '0',
      'card'
    );
    expect(result.props).toEqual({ variant: 'elevated' });
    expect(result.diagnostics.filter((d) => d.code === 'invalid-prop').length).toBeGreaterThan(0);
  });
});

describe('renderCatalogTree', () => {
  it('renders a valid component and replaces unknown ids with placeholders', () => {
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
  });

  it('drops schema-failed nodes and keeps siblings', () => {
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
  });

  it('never forwards class or style even when declared-looking', () => {
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
  });

  it('placeholders tier-denied components under untrusted', () => {
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
  });

  it('allows developer-tier catalog ids that untrusted cannot emit', () => {
    const { roots } = renderCatalogTree(
      { id: 'dialog', props: { title: 'Settings' } },
      { catalog, tier: 'developer' }
    );
    expect(roots[0]).toMatchObject({
      kind: 'component',
      id: 'dialog',
      props: { title: 'Settings' },
    });
  });

  it('drops nodes whose string props look like HTML', () => {
    const { roots, diagnostics } = renderCatalogTree(
      { id: 'card', props: { title: '<img src=x onerror=alert(1)>' } },
      { catalog, tier: 'untrusted' }
    );
    expect(roots).toHaveLength(0);
    expect(diagnostics.some((d) => d.code === 'html-string')).toBe(true);
  });

  it('accepts a list of roots and ignores invalid top-level entries', () => {
    const { roots, diagnostics } = renderCatalogTree(
      [null, 'x', { id: 'card', props: { variant: 'flat' } }],
      { catalog, tier: 'untrusted' }
    );
    expect(roots).toHaveLength(1);
    expect(diagnostics.some((d) => d.code === 'invalid-node')).toBe(true);
  });

  it('recurses children and freezes the result', () => {
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
  });
});
