import { describe, expect, it } from 'vitest';
import { parseTexuliBlocks } from '../src/content/index.ts';

describe('parseTexuliBlocks', () => {
  it('returns validated Texuli blocks from content data', () => {
    const result = parseTexuliBlocks([{ type: 'heading', text: 'Welcome', level: 1 }]);
    expect(result.success).toBe(true);
    if (result.success)
      expect(result.blocks[0]).toMatchObject({ type: 'heading', text: 'Welcome' });
  });

  it('rejects unknown block types and malformed entries', () => {
    expect(parseTexuliBlocks([{ type: 'raw-html', html: '<script>bad()</script>' }]).success).toBe(
      false
    );
    expect(parseTexuliBlocks({ type: 'text' }).success).toBe(false);
  });
});
