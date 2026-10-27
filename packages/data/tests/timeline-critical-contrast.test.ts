// T-87 (PLAN_006 a11y sweep, finding F8): the critical task bar's label
// must sit on the solid destructive fill. The progress overlay used to tint
// the whole bar with 25% of the label color, which pulled the background
// toward the text (axe color-contrast 4.21:1 light, 3.67:1 dark). CSS
// contracts are asserted against the component source, like
// timeline-audit.test.ts.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '../src/timeline/TimelineView.svelte'), 'utf8');
const style = source.slice(source.lastIndexOf('<style'));

/** The declarations of the first rule whose selector is exactly `selector`. */
function rule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  return match?.[2] ?? '';
}

describe('critical task bar contrast (F8)', () => {
  it('paints the bar with the destructive contract pair', () => {
    const bar = rule(style, '.task-bar.critical');
    expect(bar).toContain('background: var(--tx-tl-critical)');
    expect(bar).toContain('color: var(--tx-tl-critical-fg)');
    expect(source).toContain('--tx-tl-critical: var(--tx-destructive');
    expect(source).toContain('--tx-tl-critical-fg: var(--tx-destructive-foreground');
  });

  it('draws critical progress as an edge stripe, never a tint behind the label', () => {
    const progress = rule(style, '.critical .progress');
    expect(progress).not.toBe('');
    // A stripe pinned to the block end, a few pixels tall.
    expect(progress).toMatch(/inset-block:\s*auto 0/);
    expect(progress).toMatch(/block-size:\s*3px/);
    // Never a translucent mix over the fill the label reads against.
    expect(progress).not.toMatch(/color-mix|transparent/);
  });

  it('keeps the critical bar and its stripe visible under forced colors', () => {
    const forced = style.slice(style.indexOf('@media (forced-colors: active)'));
    const block = forced.slice(0, forced.indexOf('\n  }\n') + 4);
    expect(block).toContain('.task-bar.critical');
    expect(block).toMatch(/\.critical \.progress[^}]*forced-color-adjust:\s*none/);
    expect(block).toMatch(/\.critical \.progress[^}]*background:\s*CanvasText/);
  });
});
