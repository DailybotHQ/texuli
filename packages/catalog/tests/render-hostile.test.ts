// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { resetArtifactFrameIds } from '../src/render/frame/index.ts';
import {
  assertInertRoots,
  hardenInertRoots,
  HOSTILE_SAMPLES,
  hostileSamplesJson,
  looksExecutable,
  runHostileCorpus,
  runHostileSample,
} from '../src/render/hostile/index.ts';
import {
  type RenderComponentSpec,
  type RenderNode,
  renderCatalogFromSpecs,
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
    { name: 'href', kind: 'string', trust: 'untrusted' },
    { name: 'src', kind: 'string', trust: 'untrusted' },
  ],
};

const dialog: RenderComponentSpec = {
  id: 'dialog',
  label: 'Dialog',
  agentEmittable: false,
  emit: ['developer'],
  props: [{ name: 'title', kind: 'string', required: true }],
};

const alertDialog: RenderComponentSpec = {
  id: 'alert-dialog',
  label: 'AlertDialog',
  agentEmittable: false,
  emit: ['developer'],
  props: [
    { name: 'title', kind: 'string', required: true },
    { name: 'confirmLabel', kind: 'string' },
  ],
};

const catalog = renderCatalogFromSpecs([card, dialog, alertDialog]);

afterEach(() => {
  resetArtifactFrameIds();
});

describe('hostile helpers', () => {
  it('detects executable strings and forbidden props in trees', () => {
    expect(looksExecutable('javascript:alert(1)')).toBe(true);
    expect(looksExecutable('https://example.com')).toBe(false);
    const bad: RenderNode[] = [
      {
        kind: 'component',
        id: 'card',
        props: { class: 'x', title: 'ok' },
        children: [],
      },
    ];
    expect(assertInertRoots(bad).some((f) => f.includes('class'))).toBe(true);
  });

  it('exports a frozen JSON-serializable corpus', () => {
    const json = hostileSamplesJson();
    expect(Array.isArray(json)).toBe(true);
    expect(JSON.parse(JSON.stringify(json))).toEqual(json);
    expect(HOSTILE_SAMPLES.length).toBeGreaterThanOrEqual(12);
  });

  it('hardenInertRoots judges srcset by the untrusted image policy, like the paint pass', () => {
    const hardened = hardenInertRoots([
      {
        kind: 'component',
        id: 'media-image',
        props: {
          srcset: 'http://evil.example/track.webp 1x',
          fallbackSrcset: 'https://example.com/a.webp 1x, https://example.com/a2x.webp 2x',
        },
        children: [],
      },
    ]);
    const node = hardened[0];
    expect(node?.kind).toBe('component');
    if (node?.kind === 'component') {
      expect(Object.hasOwn(node.props, 'srcset')).toBe(false);
      expect(node.props.fallbackSrcset).toBe(
        'https://example.com/a.webp 1x, https://example.com/a2x.webp 2x'
      );
    }
  });
});

describe('runHostileSample', () => {
  it('renders script URLs without executable props surviving', () => {
    const result = runHostileSample(
      HOSTILE_SAMPLES.find((s) => s.id === 'script-javascript-href')!,
      { catalog }
    );
    expect(result.inert).toBe(true);
    expect(result.failures).toEqual([]);
    // href may be dropped as invalid/unknown policy at host; never javascript:
    const roots = result.render?.roots ?? result.frame?.roots ?? [];
    for (const node of roots) {
      if (node.kind === 'component') {
        expect(String(node.props.href ?? '')).not.toMatch(/javascript:/i);
      }
    }
  });

  it('placeholders fake dialog chrome under untrusted', () => {
    const result = runHostileSample(HOSTILE_SAMPLES.find((s) => s.id === 'fake-dialog-overlay')!, {
      catalog,
    });
    expect(result.inert).toBe(true);
    expect(result.render?.roots[0]).toMatchObject({
      kind: 'placeholder',
      reason: 'tier-denied',
    });
  });

  it('scrubs bidi from frame labels', () => {
    const result = runHostileSample(HOSTILE_SAMPLES.find((s) => s.id === 'bidi-override-title')!, {
      catalog,
    });
    expect(result.inert).toBe(true);
    expect(result.frame?.label).not.toMatch(/[\u202a-\u202e\u200b-\u200f]/);
  });

  it('rejects giant trees at the limits gate', () => {
    const deep = runHostileSample(HOSTILE_SAMPLES.find((s) => s.id === 'giant-depth')!, {
      catalog,
    });
    expect(deep.inert).toBe(true);
    expect(deep.limits?.withinLimits).toBe(false);
    expect(deep.limits?.roots).toEqual([]);

    const wide = runHostileSample(HOSTILE_SAMPLES.find((s) => s.id === 'giant-breadth')!, {
      catalog,
    });
    expect(wide.inert).toBe(true);
    expect(wide.limits?.withinLimits).toBe(false);
  });

  it('drops HTML string props and strips class/style', () => {
    const html = runHostileSample(HOSTILE_SAMPLES.find((s) => s.id === 'html-string-prop')!, {
      catalog,
    });
    expect(html.inert).toBe(true);
    expect(html.render?.roots ?? []).toEqual([]);

    const styled = runHostileSample(
      HOSTILE_SAMPLES.find((s) => s.id === 'style-class-passthrough')!,
      { catalog }
    );
    expect(styled.inert).toBe(true);
    const root = styled.render?.roots[0];
    if (root?.kind === 'component') {
      expect(root.props.class).toBeUndefined();
      expect(root.props.style).toBeUndefined();
      expect(root.props.className).toBeUndefined();
    }
  });

  it('refuses script links in richtext', () => {
    const result = runHostileSample(
      HOSTILE_SAMPLES.find((s) => s.id === 'prompt-injection-richtext')!,
      { catalog }
    );
    expect(result.inert).toBe(true);
    expect(result.failures).toEqual([]);
  });
});

describe('runHostileCorpus', () => {
  it('marks the full corpus inert', () => {
    const report = runHostileCorpus({ catalog });
    if (!report.ok) {
      const detail = report.results
        .filter((r) => !r.inert)
        .map((r) => `${r.sample.id}: ${r.failures.join('; ')}`)
        .join('\n');
      throw new Error(`Hostile corpus failures:\n${detail}`);
    }
    expect(report.ok).toBe(true);
    expect(report.failureCount).toBe(0);
    expect(report.results.length).toBe(HOSTILE_SAMPLES.length);
  });
});
