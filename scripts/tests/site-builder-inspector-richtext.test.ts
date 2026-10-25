// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  BLOCK_CONTENT_LIMITS,
  validateTextBlock,
} from '../../apps/website/src/components/builder/inspector/text/model.ts';
import {
  readRichText,
  writeRichText,
} from '../../apps/website/src/components/builder/inspector/text/richtext.ts';

const MAX = BLOCK_CONTENT_LIMITS.markdown;

describe('builder rich text interchange', () => {
  it('round-trips the inline Markdown text blocks store', () => {
    for (const markdown of [
      'Fictional **launch** notes.',
      'Keep *this* and ~~that~~ with `code`.',
      'Read the [plan](https://example.com/plan).',
    ]) {
      const field = readRichText(markdown, MAX);
      expect(field.notes).toEqual([]);
      expect(writeRichText(field.doc)).toBe(markdown);
    }
  });

  it('keeps a refused link as text and says so', () => {
    const field = readRichText('Read [this](javascript:alert(1)) first.', MAX);
    expect(writeRichText(field.doc)).toBe('Read this first.');
    expect(field.notes).toHaveLength(1);
    expect(field.notes[0]).toMatch(/refused by the URL policy/);
  });

  it('caps the source at the field limit with a note', () => {
    const field = readRichText('a'.repeat(30), 10);
    expect(writeRichText(field.doc)).toBe('a'.repeat(10));
    expect(field.notes).toEqual(['Text past the field limit was left out of the editor.']);
  });

  it('treats raw HTML as literal text, never markup', () => {
    const field = readRichText('<img src=x onerror=alert(1)> hello', MAX);
    const saved = writeRichText(field.doc);
    expect(field.doc.blocks).toHaveLength(1);
    expect(field.doc.blocks[0]?.type).toBe('paragraph');
    expect(saved).toContain('hello');
  });

  it('writes Markdown the text block parser accepts', () => {
    const { doc } = readRichText('Fictional **launch** notes.', MAX);
    const markdown = writeRichText(doc);
    expect(validateTextBlock({ type: 'text', markdown })).toEqual([]);
  });
});
