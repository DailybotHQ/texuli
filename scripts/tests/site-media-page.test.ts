// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  LAB_ANIMATION,
  LAB_COMPOSITION,
  LAB_IMAGE_SRC,
  LAB_UNSAFE_COMPOSITION,
  labCompositionsAreValid,
} from '../../apps/website/src/components/media-page/samples.ts';
import { validateAnimation } from '../../packages/media/src/animation/index.ts';
import { validateComposition } from '../../packages/media/src/composition-model/index.ts';

describe('media-page samples', () => {
  it('validates the lab composition and refuses the unsafe image layer', () => {
    const safe = validateComposition(LAB_COMPOSITION);
    expect(safe.ok).toBe(true);
    const unsafe = validateComposition(LAB_UNSAFE_COMPOSITION);
    expect(unsafe.ok).toBe(false);
    expect(labCompositionsAreValid().ok).toBe(true);
  });

  it('validates the lab animation against the composition', () => {
    const composition = validateComposition(LAB_COMPOSITION);
    expect(composition.ok).toBe(true);
    if (!composition.ok) return;
    const result = validateAnimation(LAB_ANIMATION, { composition: composition.composition });
    expect(result.ok).toBe(true);
  });

  it('uses a same-origin image path for the lab illustration', () => {
    expect(LAB_IMAGE_SRC.startsWith('/')).toBe(true);
    expect(LAB_IMAGE_SRC).toContain('media-lab');
  });
});
