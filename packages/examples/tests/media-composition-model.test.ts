import { describe, expect, it } from 'vitest';
import { getExample, listExampleIds } from '../src/index.ts';

describe('media composition example registration', () => {
  it('registers and lazily loads the composition model example', async () => {
    expect(listExampleIds()).toContain('media-composition-model');
    const example = getExample('media-composition-model');
    expect(example?.component).toBe('media/compositionModel');
    expect(example?.tags).toEqual(expect.arrayContaining(['media', 'composition']));
    const loaded = await example!.load();
    expect(loaded.default).toBeTypeOf('function');
  });
});
