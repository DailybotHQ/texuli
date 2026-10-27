// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Source guards for the T-53 forms audit (tex-forms lane).
 *
 * - Forced colors: box-shadow does not render under forced-colors, so focus
 *   rings that live only in box-shadow disappear exactly when high-contrast
 *   system themes are in play. Each guard pins an outline fallback (outlines
 *   survive forced colors) next to the box-shadow ring.
 * - Invalid chrome: Input/Textarea turn the border destructive on
 *   `aria-invalid`; the Select trigger and Combobox field must speak the
 *   same grammar.
 * - Tap targets: the combobox chip remove control keeps a 24px target.
 */

const css = (path: string) =>
  readFileSync(join(process.cwd(), 'packages/texuli/src/components', path), 'utf8');

/** The declarations of the first rule whose selector list contains `selector`. */
function rule(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|[\\s}])${escaped}\\s*(?:,[^{]*)?\\{([^}]*)\\}`).exec(source);
  if (!match?.[1]) throw new Error(`no rule containing ${selector}`);
  return match[1];
}

/** The forced-colors media block of a stylesheet (from its first occurrence). */
function forcedColors(source: string): string {
  const index = source.indexOf('@media (forced-colors: active)');
  if (index === -1) throw new Error('no forced-colors block');
  return source.slice(index);
}

describe('forms audit forced-colors guards (T-53)', () => {
  it('text fields keep a visible focus ring under forced colors', () => {
    const forced = forcedColors(css('input/field.css'));
    expect(rule(forced, '.tx-field:focus-visible')).toMatch(/outline:[^;}]*Highlight/);
    expect(rule(forced, '.tx-input-group:focus-within')).toMatch(/outline:[^;}]*Highlight/);
  });

  it('select trigger and highlighted items stay visible under forced colors', () => {
    const forced = forcedColors(css('select/select.css'));
    expect(rule(forced, '.tx-select-trigger:focus-visible')).toMatch(/outline:[^;}]*Highlight/);
    expect(rule(forced, '.tx-select-trigger[data-state="open"]')).toMatch(
      /outline:[^;}]*Highlight/
    );
    expect(rule(forced, '.tx-select-item[data-highlighted]')).toMatch(/outline:[^;}]*Highlight/);
  });

  it('combobox field keeps a visible focus ring under forced colors', () => {
    const forced = forcedColors(css('combobox/combobox.css'));
    expect(rule(forced, '.tx-combobox-field:focus-within')).toMatch(/outline:[^;}]*Highlight/);
    expect(rule(forced, '.tx-combobox-field[data-state="open"]')).toMatch(
      /outline:[^;}]*Highlight/
    );
  });
});

describe('forms audit invalid-chrome guards (T-53)', () => {
  it('the select trigger shows destructive chrome on aria-invalid like inputs', () => {
    const source = css('select/select.css');
    expect(rule(source, '.tx-select-trigger[aria-invalid="true"]')).toMatch(
      /border-color:[^;}]*--tx-destructive/
    );
    expect(rule(source, '.tx-select-trigger[aria-invalid="true"]:focus-visible')).toMatch(
      /--tx-destructive/
    );
  });

  it('the combobox field shows destructive chrome on an invalid input', () => {
    const source = css('combobox/combobox.css');
    expect(rule(source, '.tx-combobox-field:has([aria-invalid="true"])')).toMatch(
      /border-color:[^;}]*--tx-destructive/
    );
    expect(rule(source, '.tx-combobox-field:has([aria-invalid="true"]):focus-within')).toMatch(
      /--tx-destructive/
    );
  });
});

describe('forms audit tap-target guards (T-53)', () => {
  it('combobox chip remove keeps a 24px touch target', () => {
    const remove = rule(css('combobox/combobox.css'), '.tx-combobox-chip__remove');
    expect(remove).toMatch(/min-inline-size:\s*1\.5rem/);
    expect(remove).toMatch(/min-block-size:\s*1\.5rem/);
  });
});
