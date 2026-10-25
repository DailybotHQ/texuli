import { validateComposition } from '@texuli/media';
import { describe, expect, it } from 'vitest';
import { getExample, listExampleIds } from '../src/index.ts';
import { harborPoster, hostileScene } from '../src/media-composition-canvas/scenes.ts';

describe('media composition canvas example', () => {
  it('registers and lazily loads the canvas example', async () => {
    expect(listExampleIds()).toContain('media-composition-canvas');
    const example = getExample('media-composition-canvas');
    expect(example?.component).toBe('media/CompositionCanvas');
    expect(example?.tags).toEqual(expect.arrayContaining(['media', 'canvas', 'keyboard']));
    const loaded = await example!.load();
    expect(loaded.default).toBeTypeOf('function');
  });

  it('ships a poster that validates as untrusted data and a hostile scene that does not', () => {
    const poster = validateComposition(harborPoster);
    expect(poster.ok).toBe(true);
    if (poster.ok) expect(poster.composition.layers).toHaveLength(168);
    const hostile = validateComposition(hostileScene);
    expect(hostile.ok).toBe(false);
    if (!hostile.ok) expect(hostile.errors.map((issue) => issue.code)).toContain('unsafe-source');
  });
});
