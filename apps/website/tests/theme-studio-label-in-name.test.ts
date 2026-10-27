/**
 * T-88 (routed from the T-90 screen-reader pass): WCAG 2.5.3 Label in Name
 * for the theme studio. Every labelled field whose control carries its own
 * `aria-label` must have a name that contains the visible label text, so a
 * speech-input user can say what they see ("click Color for light mode").
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  join(import.meta.dirname, '..', 'src', 'components', 'theme-studio', 'ThemeStudio.svelte'),
  'utf8'
);

/** `<label class="field">` blocks: the visible label text and the control's aria-label. */
function labelledFields(): Array<{ visible: string; name: string }> {
  const fields: Array<{ visible: string; name: string }> = [];
  for (const match of source.matchAll(/<label class="field[^"]*">([\s\S]*?)<\/label>/g)) {
    const block = match[1] ?? '';
    const visible = /<span class="field__label"[^>]*>([^<]+)<\/span>/.exec(block)?.[1];
    const name =
      /aria-label="([^"]+)"/.exec(block)?.[1] ?? /aria-label=\{`([^`]+)`\}/.exec(block)?.[1];
    if (visible && name) fields.push({ visible: visible.trim(), name: name.trim() });
  }
  return fields;
}

/** Svelte `{expr}` and template `${expr}` placeholders compare as one token. */
function normalize(text: string): string {
  return text
    .replace(/\$?\{[^}]+\}/g, '<x>')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

describe('theme studio label in name (WCAG 2.5.3)', () => {
  const fields = labelledFields();

  it('finds the labelled fields', () => {
    expect(fields.length).toBeGreaterThanOrEqual(5);
  });

  for (const { visible, name } of fields) {
    it(`"${visible}" is named with its visible label (name: "${name}")`, () => {
      expect(normalize(name)).toContain(normalize(visible));
    });
  }
});
