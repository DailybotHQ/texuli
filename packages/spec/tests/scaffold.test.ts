// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { SPEC_VERSION } from '../src/index.ts';

describe('@texuli/spec scaffold', () => {
  it('exports a semantic spec version', () => {
    expect(SPEC_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
