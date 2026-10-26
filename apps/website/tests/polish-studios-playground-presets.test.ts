/**
 * T-82 — playground preset captions (punch-list row 5): every preset states
 * in one line what its run proves, every hostile corpus category has a
 * caption, and the preset JSON still runs through the playground pipeline.
 */

import type { HostileSample } from '@texuli/catalog/render/hostile';
import { HOSTILE_SAMPLES } from '@texuli/catalog/render/hostile';
import { describe, expect, it } from 'vitest';
import {
  HOSTILE_PROVES,
  PLAYGROUND_PRESETS,
  presetById,
} from '../src/components/playground/presets.ts';
import { formatDiagnostics, runPlaygroundTree } from '../src/components/playground/run.ts';

describe('playground presets', () => {
  it('gives every preset a one-line "what this proves" caption', () => {
    expect(PLAYGROUND_PRESETS.length).toBeGreaterThan(3);
    for (const preset of PLAYGROUND_PRESETS) {
      expect(preset.proves.trim().length, preset.id).toBeGreaterThan(10);
      expect(preset.proves, preset.id).not.toMatch(/TODO|TBD/);
    }
  });

  it('covers every hostile corpus category with a caption', () => {
    const categories = new Set<HostileSample['category']>(HOSTILE_SAMPLES.map((s) => s.category));
    for (const category of categories) {
      expect(HOSTILE_PROVES[category], `no caption for ${category}`).toBeTruthy();
    }
    // A new corpus category cannot ship without a caption: the map is total.
    expect(Object.keys(HOSTILE_PROVES).length).toBe(categories.size);
  });

  it('keeps hostile presets runnable, with a diagnostic or a placeholder to show', () => {
    const hostile = PLAYGROUND_PRESETS.filter((preset) => preset.id.startsWith('hostile-'));
    expect(hostile.length).toBeGreaterThan(10);
    let withFindings = 0;
    for (const preset of hostile) {
      const result = runPlaygroundTree(`${JSON.stringify(preset.tree, null, 2)}\n`);
      if (!result.ok) continue; // parse-level samples are covered by the corpus tests
      const lines = formatDiagnostics(result);
      if (lines.length > 0 || result.roots.some((root) => root.kind === 'placeholder')) {
        withFindings += 1;
      }
    }
    expect(withFindings).toBeGreaterThan(0);
  });

  it('resolves presets by id with the caption attached', () => {
    const preset = presetById('safe-card');
    expect(preset?.proves).toBeTruthy();
    expect(presetById('does-not-exist')).toBeUndefined();
  });
});
