// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(process.cwd(), 'packages/editor/src/editor/editor.css'), 'utf8');

describe('editor theme contract', () => {
  it('makes the todo checkbox itself a 24px target (WCAG 2.5.8)', () => {
    // The checkbox sits inside the editor textbox, so axe measures the input's
    // own box: a larger wrapper or label does not satisfy target-size.
    expect(css).toMatch(
      /\.tx-editor-check input\s*\{[^}]*inline-size:\s*1\.5rem;[^}]*block-size:\s*1\.5rem;/
    );
  });

  it('uses the AA-gated link role for rendered links', () => {
    expect(css).toMatch(/\.tx-editor-link\s*\{[^}]*color:\s*var\(--tx-link, LinkText\)/);
  });
});
