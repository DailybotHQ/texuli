// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Source guards for the CSS fixes of the component polish audit
 * (POLISH_AUDIT.md). Their layout behavior is measured in a browser by
 * tests/e2e/texuli-polish.spec.ts; these keep the rules from silently
 * regressing in a unit run.
 */

const css = (path: string) =>
  readFileSync(join(process.cwd(), 'packages/texuli/src/components', path), 'utf8');

/** The declarations of the first rule whose selector list is exactly `selector`. */
function rule(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|[\\s}])${escaped}\\s*\\{([^}]*)\\}`).exec(source);
  if (!match?.[1]) throw new Error(`no rule for ${selector}`);
  return match[1];
}

describe('polish audit CSS guards', () => {
  it('P1-03: the tabs scroller has no negative inline margin', () => {
    const scroller = rule(css('tabs-accordion/tabs-accordion.css'), '.tx-tabs__scroller');
    expect(scroller).not.toMatch(/margin-inline\s*:\s*-/);
  });

  it('P1-04: choice hit areas grow on the block axis only', () => {
    const source = css('choice/choice.css');
    expect(rule(source, '.tx-choice-control::before')).toMatch(/inset-inline:\s*0;/);
    expect(rule(source, '.tx-switch-control::before')).toMatch(/inset-inline:\s*0;/);
  });

  it('P1-05: horizontal slider parts flip their centering translate in RTL', () => {
    const source = css('slider/slider.css');
    for (const part of ['thumb', 'tick', 'mark-label']) {
      expect(rule(source, `.tx-slider--horizontal .tx-slider__${part}:dir(rtl)`), part).toMatch(
        /translate:\s*50%/
      );
    }
  });

  it('P1-06: slide content cannot size the carousel and its dots wrap', () => {
    const source = css('carousel/carousel.css');
    expect(rule(source, '.tx-carousel-viewport')).toMatch(/contain:\s*inline-size/);
    expect(rule(source, '.tx-carousel-dots')).toMatch(/flex-wrap:\s*wrap/);
  });

  it('P1-08: long rating scales wrap', () => {
    expect(rule(css('rating/rating.css'), '.tx-rating__stars')).toMatch(/flex-wrap:\s*wrap/);
  });

  it('P1-09: PIN cells shrink toward a floor instead of a fixed size', () => {
    const cell = rule(css('number-pin/number-pin.css'), '.tx-pin-input__cell');
    expect(cell).toMatch(/flex:\s*0 1 2\.75rem/);
    expect(cell).toMatch(/min-inline-size:\s*2rem/);
    expect(cell).not.toMatch(/(^|[\s;])inline-size:/);
  });

  it('P1-10: swatches keep their fill in forced colors', () => {
    const source = css('tags-color/tags-color.css');
    const forced = source.slice(source.indexOf('@media (forced-colors: active)'));
    expect(forced).toMatch(
      /\.tx-color-picker__swatch,\s*\.tx-color-picker__preview\s*\{[^}]*forced-color-adjust:\s*none/
    );
  });
});
