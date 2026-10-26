// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
  join(process.cwd(), 'packages/texuli/src/components/field/field.css'),
  'utf8'
);

describe('disabled field contrast', () => {
  it('keeps disabled descriptions at the foreground token contrast without dimming the root', () => {
    expect(css).not.toMatch(/\.tx-field-root\[data-disabled\]\s*\{[^}]*opacity:/);
    expect(css).toMatch(
      /\.tx-field-root\[data-disabled\]\s+\.tx-description\s*\{[^}]*color:\s*var\(--tx-foreground,/
    );
    expect(css).toMatch(
      /\.tx-field-root\[data-disabled\]\s+\.tx-field-control\s*\{[^}]*opacity:\s*0\.6/
    );
  });
});
