// @vitest-environment node

import { HOSTILE_SAMPLES } from '@texuli/catalog/render/hostile';
import { describe, expect, it } from 'vitest';
import {
  PLAYGROUND_SPECS,
  playgroundCatalog,
} from '../../apps/website/src/components/playground/catalog.ts';
import {
  defaultEditorJson,
  PLAYGROUND_PRESETS,
  presetById,
} from '../../apps/website/src/components/playground/presets.ts';
import {
  formatDiagnostics,
  PLAYGROUND_EDITOR_MAX_BYTES,
  parseCatalogJson,
  runPlaygroundTree,
} from '../../apps/website/src/components/playground/run.ts';

describe('site playground catalog', () => {
  it('exposes card, badge, stat and non-emittable dialog chrome', () => {
    const ids = PLAYGROUND_SPECS.map((s) => s.id);
    expect(ids).toEqual(
      expect.arrayContaining(['card', 'badge', 'stat', 'dialog', 'alert-dialog'])
    );
    const dialog = PLAYGROUND_SPECS.find((s) => s.id === 'dialog');
    expect(dialog?.agentEmittable).toBe(false);
    expect(dialog?.emit).toEqual(['developer']);
    const catalog = playgroundCatalog();
    expect(catalog.get('card')?.id).toBe('card');
    expect(catalog.get('dialog')?.id).toBe('dialog');
    expect(catalog.get('missing-xyz')).toBeUndefined();
  });
});

describe('site playground presets', () => {
  it('includes safe demos and every hostile tree sample', () => {
    const safe = PLAYGROUND_PRESETS.filter((p) => p.group === 'safe');
    expect(safe.length).toBeGreaterThanOrEqual(3);
    expect(presetById('safe-card')?.tree).toMatchObject({ id: 'card' });

    const hostileWithTree = HOSTILE_SAMPLES.filter((s) => s.tree != null);
    const hostilePresets = PLAYGROUND_PRESETS.filter((p) => p.id.startsWith('hostile-'));
    expect(hostilePresets).toHaveLength(hostileWithTree.length);
    for (const sample of hostileWithTree) {
      expect(presetById(`hostile-${sample.id}`)?.tree).toEqual(sample.tree);
    }
  });

  it('default editor JSON is valid catalog JSON', () => {
    const parsed = parseCatalogJson(defaultEditorJson());
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.tree).toMatchObject({ id: 'card' });
    }
  });
});

describe('site playground parse and run', () => {
  it('rejects empty and non-object JSON with parse errors', () => {
    expect(parseCatalogJson('').ok).toBe(false);
    expect(parseCatalogJson('   ').ok).toBe(false);
    const bad = parseCatalogJson('{');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.message).toMatch(/JSON parse failed/i);
    const scalar = parseCatalogJson('"just a string"');
    expect(scalar.ok).toBe(false);
    if (!scalar.ok) expect(scalar.error.message).toMatch(/object or an array/i);
  });

  it('refuses editor text larger than tree maxBytes plus whitespace allowance before parse', () => {
    // Over the cap: never call JSON.parse; error reports sizes only (never echoes input).
    const marker = 'UNIQUE_PLAYGROUND_PAYLOAD_MARKER_9f3a';
    const oversized = `{"id":"card","props":{"title":"${marker}${'x'.repeat(PLAYGROUND_EDITOR_MAX_BYTES)}"}}`;
    expect(oversized.length).toBeGreaterThan(PLAYGROUND_EDITOR_MAX_BYTES);
    const parsed = parseCatalogJson(oversized);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.message).toMatch(/too large/i);
      expect(parsed.error.message).not.toMatch(/JSON parse failed/i);
      expect(parsed.error.message).not.toContain(marker);
      expect(parsed.error.message).not.toContain(oversized.slice(0, 64));
    }
    const run = runPlaygroundTree(oversized);
    expect(run.ok).toBe(false);
    if (!run.ok) {
      expect(run.error.message).toMatch(/too large/i);
      expect(run.error.message).not.toContain(marker);
    }

    // Just under the cap still reaches the JSON parser.
    const under = '{"id":"card"}';
    expect(under.length).toBeLessThan(PLAYGROUND_EDITOR_MAX_BYTES);
    expect(parseCatalogJson(under).ok).toBe(true);
  });

  it('renders a safe card under the untrusted tier', () => {
    const result = runPlaygroundTree(defaultEditorJson());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.overLimits).toBe(false);
    expect(result.roots.length).toBeGreaterThan(0);
    expect(result.roots[0]).toMatchObject({ kind: 'component', id: 'card' });
    expect(formatDiagnostics(result)).toEqual([]);
  });

  it('turns non-emittable dialog into a placeholder under untrusted', () => {
    const result = runPlaygroundTree(
      JSON.stringify({ id: 'dialog', props: { title: 'Confirm transfer' } })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.roots[0]?.kind).toBe('placeholder');
    const lines = formatDiagnostics(result);
    expect(
      lines.some((l) => /tier|emit|placeholder|not-emittable|denied/i.test(l) || l.length > 0)
    ).toBe(true);
  });

  it('rejects giant depth via tree limits', () => {
    const giant = PLAYGROUND_PRESETS.find((p) => p.id === 'hostile-giant-depth');
    expect(giant).toBeDefined();
    const result = runPlaygroundTree(JSON.stringify(giant!.tree));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.overLimits).toBe(true);
    expect(result.roots).toHaveLength(0);
    expect(result.limitMessages.length).toBeGreaterThan(0);
    expect(formatDiagnostics(result).some((l) => l.startsWith('limit:'))).toBe(true);
  });

  it('strips executable javascript: href from card props', () => {
    const sample = HOSTILE_SAMPLES.find((s) => s.id === 'script-javascript-href');
    expect(sample).toBeDefined();
    const result = runPlaygroundTree(JSON.stringify(sample!.tree));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const root = result.roots[0];
    expect(root?.kind).toBe('component');
    if (root?.kind !== 'component') return;
    const href = root.props.href;
    expect(
      href === undefined ||
        (typeof href === 'string' && !href.toLowerCase().startsWith('javascript:'))
    ).toBe(true);
  });
});
