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

describe('navigation lane CSS guards (T-57)', () => {
  const family = [
    'navigation/navigation.css',
    'stepper/stepper.css',
    'tabs-accordion/tabs-accordion.css',
  ];

  it('no hardcoded hex or color-function token fallbacks in the navigation family', () => {
    for (const file of family) {
      const hits = css(file).match(/var\(--tx-[^)]*#[0-9a-fA-F]{3,8}\b[^)]*\)/g) ?? [];
      expect(hits, file).toEqual([]);
    }
  });

  it('navigation.css keeps active pagination and menu states visible under forced colors', () => {
    const source = css('navigation/navigation.css');
    const forced = source.slice(source.indexOf('@media (forced-colors: active)'));
    expect(forced).toMatch(
      /\.tx-pagination__button\[aria-current="page"\][^{]*\{[^}]*border-color:\s*Highlight/
    );
    expect(forced).toMatch(
      /\.tx-nav-menu__trigger\[data-state="open"\][^{]*\{[^}]*outline:\s*1px solid Highlight/
    );
  });

  it('breadcrumb links meet the 24px block-axis tap target', () => {
    const link = rule(css('navigation/navigation.css'), '.tx-breadcrumb__link');
    expect(link).toMatch(/display:\s*inline-flex/);
    expect(link).toMatch(/min-block-size:\s*1\.5rem/);
  });

  it('wizard direction chevrons flip in RTL', () => {
    const source = css('stepper/stepper.css');
    expect(source).toMatch(
      /\.tx-wizard:dir\(rtl\)\s+\.tx-wizard__chevron\s*\{[^}]*transform:\s*scaleX\(-1\)/
    );
  });

  it('the wizard panel shows the family focus ring on keyboard focus', () => {
    const source = css('stepper/stepper.css');
    const panel = rule(source, '.tx-wizard__panel:focus-visible');
    expect(panel).toMatch(
      /outline:\s*var\(--tx-focus-ring-width, 2px\) solid var\(--tx-ring, Highlight\)/
    );
  });

  it('the navigation menu indicator follows the block axis when vertical', () => {
    const vertical = rule(
      css('navigation/navigation.css'),
      '.tx-nav-menu__indicator[data-orientation="vertical"]'
    );
    expect(vertical).toMatch(
      /inset-block-start:\s*var\(--tx-navigation-menu-indicator-offset, 0\)/
    );
    expect(vertical).not.toMatch(
      /inset-inline-start:\s*var\(--tx-navigation-menu-indicator-offset/
    );
  });
});

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
    expect(cell).toMatch(/flex:\s*0 1 auto/);
    expect(cell).toMatch(/min-inline-size:\s*2rem/);
  });

  it('P1-10: swatches keep their fill in forced colors', () => {
    const source = css('tags-color/tags-color.css');
    const forced = source.slice(source.indexOf('@media (forced-colors: active)'));
    expect(forced).toMatch(
      /\.tx-color-picker__swatch,\s*\.tx-color-picker__preview\s*\{[^}]*forced-color-adjust:\s*none/
    );
  });
});
